import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Auth } from '../../services/auth';
import { InspectionRecord } from '../../services/inspection';
import { OfflineDatabaseService } from './offline-database.service';

export type InspectionSyncState = 'idle' | 'offline' | 'syncing' | 'synced' | 'error';

interface OutboxEntry {
  record: InspectionRecord;
  ownerSubject: string | null;
  status: 'pending' | 'synced';
}

export interface InspectionOutboxItem {
  record: InspectionRecord;
  status: 'pending' | 'synced';
}

const INSPECTIONS_STORAGE_KEY = 'inspection-records';
const INSPECTION_OUTBOX_KEY = 'inspection-outbox';

@Injectable({ providedIn: 'root' })
export class InspectionSyncService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly database = inject(OfflineDatabaseService);
  private operationQueue: Promise<void> = Promise.resolve();
  private activeSync?: Promise<void>;
  private syncRequested = false;
  private remoteRecordsRevision = 0;
  readonly state = signal<InspectionSyncState>('idle');
  readonly pendingCount = signal(0);
  readonly error = signal<string | null>(null);
  readonly remoteError = signal<string | null>(null);
  readonly remoteLoading = signal(false);
  readonly remoteRecords = signal<InspectionRecord[]>([]);
  readonly outboxItems = signal<InspectionOutboxItem[]>([]);
  readonly clearedLocalIds = signal<string[]>([]);

  constructor() {
    effect(() => {
      const subject = this.auth.userSubject();
      if (subject) {
        void this.refreshRemoteRecords();
        void this.syncPending();
      } else {
        this.remoteRecords.set([]);
      }
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.syncPending());
    }
  }

  async restoreLocalRecords(records: InspectionRecord[]): Promise<void> {
    await this.serialize(async () => {
      const entries = await this.readOutbox();
      const byId = new Map(entries.map((entry) => [entry.record.id, entry]));
      for (const record of records) {
        if (!byId.has(record.id)) {
          byId.set(record.id, { record, ownerSubject: null, status: 'pending' });
        }
      }
      await this.database.writeMany([
        { key: INSPECTIONS_STORAGE_KEY, value: records },
        { key: INSPECTION_OUTBOX_KEY, value: [...byId.values()] },
      ]);
      this.publishEntries([...byId.values()]);
    });
    void this.syncPending();
  }

  async saveLocalRecords(records: InspectionRecord[], changedIds: string[]): Promise<void> {
    await this.serialize(async () => {
      const entries = await this.readOutbox();
      const byId = new Map(entries.map((entry) => [entry.record.id, entry]));
      const recordsById = new Map(records.map((record) => [record.id, record]));
      for (const id of changedIds) {
        const record = recordsById.get(id);
        if (!record) continue;
        const existing = byId.get(id);
        byId.set(id, {
          record,
          ownerSubject: existing?.ownerSubject ?? null,
          status: 'pending',
        });
      }
      const nextEntries = [...byId.values()];
      await this.database.writeMany([
        { key: INSPECTIONS_STORAGE_KEY, value: records },
        { key: INSPECTION_OUTBOX_KEY, value: nextEntries },
      ]);
      this.publishEntries(nextEntries);
    });
    void this.syncPending();
  }

  syncPending(): Promise<void> {
    if (this.activeSync) {
      if (this.auth.userSubject()) this.syncRequested = true;
      return this.activeSync;
    }
    const run = this.flushPending();
    const guarded = run.finally(() => {
      if (this.activeSync === guarded) {
        this.activeSync = undefined;
        if (this.syncRequested) {
          this.syncRequested = false;
          void this.syncPending();
        }
      }
    });
    this.activeSync = guarded;
    return guarded;
  }

  private async flushPending(): Promise<void> {
    const subject = this.auth.userSubject();
    if (!subject) {
      this.state.set('idle');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.state.set('offline');
      return;
    }

    this.state.set('syncing');
    this.error.set(null);
    try {
      while (true) {
        const entries = await this.serialize(() => this.readOutbox());
        this.publishEntries(entries);
        const alreadySynced = entries.find((entry) =>
          entry.status === 'synced' && entry.ownerSubject === subject);
        if (alreadySynced) {
          await this.clearSyncedLocalData(alreadySynced, subject);
          continue;
        }
        const pending = entries.find((entry) =>
          entry.status === 'pending' && (entry.ownerSubject === null || entry.ownerSubject === subject));
        if (!pending) {
          this.state.set(entries.some((entry) => entry.status === 'pending') ? 'idle' : 'synced');
          return;
        }

        const boundEntry = pending.ownerSubject === null
          ? await this.bindOwner(pending.record.id, subject)
          : pending;
        await this.upload(boundEntry);
        this.replaceRemoteRecord(boundEntry.record);
        await this.markSynced(boundEntry, subject);
        await this.clearSyncedLocalData(boundEntry, subject);
      }
    } catch (error: unknown) {
      this.state.set('error');
      this.error.set(this.describeSyncError(error));
    }
  }

  private async upload(entry: OutboxEntry): Promise<void> {
    const formData = new FormData();
    formData.append('inspection', new Blob([JSON.stringify(entry.record)], { type: 'application/json' }));
    for (const item of entry.record.checklist) {
      for (const evidence of item.evidence) {
        const blob = await this.database.read<Blob>(`inspection-evidence:${evidence.id}`)
          ?? await this.loadEvidence(entry.record.id, evidence.id);
        if (!blob) throw new Error(`Photo "${evidence.name}" is missing from local storage and the primary database; this inspection remains queued.`);
        formData.append('files', blob, evidence.id);
      }
    }
    if (this.auth.userSubject() !== entry.ownerSubject) {
      throw new Error('The signed-in account changed during sync; the inspection remains queued.');
    }
    await firstValueFrom(this.http.put(
      `${environment.apiBaseUrl}/inspections/${encodeURIComponent(entry.record.id)}`,
      formData,
    ));
  }

  async loadEvidence(inspectionId: string, evidenceId: string): Promise<Blob | undefined> {
    return firstValueFrom(this.http.get(
      `${environment.apiBaseUrl}/inspections/${encodeURIComponent(inspectionId)}/evidence/${encodeURIComponent(evidenceId)}`,
      { responseType: 'blob' },
    ));
  }

  async refreshRemoteRecords(): Promise<void> {
    const subject = this.auth.userSubject();
    if (!subject) {
      this.remoteError.set('Sign in to load reports from the primary database.');
      return;
    }
    await this.loadRemoteRecords(subject);
  }

  private async bindOwner(recordId: string, subject: string): Promise<OutboxEntry> {
    let bound: OutboxEntry | undefined;
    await this.serialize(async () => {
      const entries = await this.readOutbox();
      const updated = entries.map((entry) => {
        if (entry.record.id !== recordId || entry.status !== 'pending') return entry;
        bound = { ...entry, ownerSubject: subject };
        return bound;
      });
      await this.database.write(INSPECTION_OUTBOX_KEY, updated);
      this.publishEntries(updated);
    });
    if (!bound) throw new Error('The pending inspection was removed before sync.');
    return bound;
  }

  private async markSynced(uploaded: OutboxEntry, subject: string): Promise<void> {
    await this.serialize(async () => {
      const entries = await this.readOutbox();
      const updated = entries.map((entry) => {
        if (entry.record.id !== uploaded.record.id || entry.ownerSubject !== subject) return entry;
        return {
          ...entry,
          status: JSON.stringify(entry.record) === JSON.stringify(uploaded.record) ? 'synced' : 'pending',
        } satisfies OutboxEntry;
      });
      await this.database.write(INSPECTION_OUTBOX_KEY, updated);
      this.publishEntries(updated);
    });
  }

  private async clearSyncedLocalData(uploaded: OutboxEntry, subject: string): Promise<void> {
    await this.serialize(async () => {
      const entries = await this.readOutbox();
      const current = entries.find((entry) => entry.record.id === uploaded.record.id);
      if (!current || current.ownerSubject !== subject || current.status !== 'synced'
          || JSON.stringify(current.record) !== JSON.stringify(uploaded.record)) {
        this.publishEntries(entries);
        return;
      }

      const stored = await this.database.read<unknown>(INSPECTIONS_STORAGE_KEY);
      const records = Array.isArray(stored) ? stored as InspectionRecord[] : [];
      const localRecord = records.find((record) => record.id === uploaded.record.id);
      if (localRecord && JSON.stringify(localRecord) !== JSON.stringify(uploaded.record)) {
        const updated = entries.map((entry) => entry.record.id === uploaded.record.id
          ? { ...entry, record: localRecord, status: 'pending' as const }
          : entry);
        await this.database.write(INSPECTION_OUTBOX_KEY, updated);
        this.publishEntries(updated);
        return;
      }
      const remainingRecords = records.filter((record) => record.id !== uploaded.record.id);
      const remainingEntries = entries.filter((entry) => entry.record.id !== uploaded.record.id);
      const evidenceKeys = uploaded.record.checklist.flatMap((item) =>
        item.evidence.map((evidence) => `inspection-evidence:${evidence.id}`));
      await this.database.writeAndRemove([
        { key: INSPECTIONS_STORAGE_KEY, value: remainingRecords },
        { key: INSPECTION_OUTBOX_KEY, value: remainingEntries },
      ], evidenceKeys);
      this.publishEntries(remainingEntries);
      this.clearedLocalIds.update((ids) => [...new Set([...ids, uploaded.record.id])]);
    });
  }

  private async loadRemoteRecords(subject: string): Promise<void> {
    this.remoteLoading.set(true);
    this.remoteError.set(null);
    const revisionAtRequest = this.remoteRecordsRevision;
    try {
      const records = await firstValueFrom(this.http.get<InspectionRecord[]>(
        `${environment.apiBaseUrl}/inspections`,
      ));
      if (this.auth.userSubject() !== subject) return;
      if (this.remoteRecordsRevision === revisionAtRequest) {
        this.remoteRecords.set(records);
      } else {
        const latest = new Map(this.remoteRecords().map((record) => [record.id, record]));
        for (const record of records) {
          if (!latest.has(record.id)) latest.set(record.id, record);
        }
        this.remoteRecords.set([...latest.values()]);
      }
    } catch (error: unknown) {
      if (this.auth.userSubject() === subject) {
        this.remoteError.set(error instanceof Error ? error.message : 'Could not load inspections from the primary database.');
      }
    } finally {
      if (this.auth.userSubject() === subject) this.remoteLoading.set(false);
    }
  }

  private replaceRemoteRecord(record: InspectionRecord): void {
    this.remoteRecordsRevision++;
    this.remoteRecords.update((records) => [record, ...records.filter((item) => item.id !== record.id)]);
  }

  private describeSyncError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Could not reach the primary database API. Check that the backend is running and reachable.';
      }
      if (error.status === 401) {
        return 'Your sign-in has expired. Sign in again, then retry the queued inspection.';
      }

      const body = error.error as unknown;
      let serverMessage: string | null = typeof body === 'string' ? body : null;
      if (body && typeof body === 'object') {
        const response = body as Record<string, unknown>;
        for (const key of ['detail', 'message', 'error']) {
          if (typeof response[key] === 'string') {
            serverMessage = response[key];
            break;
          }
        }
      }
      return serverMessage
        ? `Primary database rejected the sync (HTTP ${error.status}): ${serverMessage}`
        : `Primary database returned HTTP ${error.status} while syncing.`;
    }

    return error instanceof Error ? error.message : 'An unexpected error occurred during inspection sync.';
  }

  private async readOutbox(): Promise<OutboxEntry[]> {
    const value = await this.database.read<unknown>(INSPECTION_OUTBOX_KEY);
    return Array.isArray(value) ? value as OutboxEntry[] : [];
  }

  private publishEntries(entries: OutboxEntry[]): void {
    this.pendingCount.set(entries.filter((entry) => entry.status === 'pending').length);
    this.outboxItems.set(entries.map(({ record, status }) => ({ record, status })));
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}
