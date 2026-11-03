import { Injectable, effect, inject, signal } from '@angular/core';
import { ChecklistGenerationAnswer, ChecklistGenerationSection } from './ai';
import { OfflineDatabaseService } from '../core/services/offline-database.service';
import { InspectionSyncService } from '../core/services/inspection-sync.service';

export type InspectionStatus = 'In progress' | 'Scheduled' | 'Completed' | 'Needs review';
export type CheckResult = 'pass' | 'fail' | 'na' | null;

export interface InspectionEvidence {
  id: string;
  name: string;
  mediaType: string;
}

export interface ChecklistItem {
  id: string;
  section: string;
  label: string;
  result: CheckResult;
  comment: string;
  evidence: InspectionEvidence[];
}

export interface InspectionRecord {
  id: string;
  asset: string;
  assetType: string;
  location: string;
  inspector: string;
  date: string;
  status: InspectionStatus;
  defects: number;
  criticalDefects: number;
  checklist: ChecklistItem[];
  checklistContext: ChecklistGenerationAnswer[];
}

export interface NewInspection {
  asset: string;
  assetType: string;
  location: string;
  inspector: string;
  date: string;
}

export interface InspectionChecklistSection {
  title: string;
  items: ChecklistItem[];
  startIndex: number;
}

const INSPECTIONS_STORAGE_KEY = 'inspection-records';

@Injectable({
  providedIn: 'root',
})
export class Inspection {
  private readonly offlineDatabase = inject(OfflineDatabaseService);
  private readonly syncService = inject(InspectionSyncService);
  private readonly localRecords = signal<InspectionRecord[]>([]);
  readonly records = signal<InspectionRecord[]>([]);
  readonly persistenceState = signal<'loading' | 'saved' | 'saving' | 'error'>('loading');
  readonly persistenceError = signal<string | null>(null);
  private readonly pendingChanges: Array<(records: InspectionRecord[]) => InspectionRecord[]> = [];
  private hydrated = false;
  private persistenceQueue: Promise<void> = Promise.resolve();

  constructor() {
    effect(() => {
      const local = this.localRecords();
      const remote = this.syncService.remoteRecords();
      const clearedIds = new Set(this.syncService.clearedLocalIds());
      if (clearedIds.size && local.some((record) => clearedIds.has(record.id))) {
        this.localRecords.set(local.filter((record) => !clearedIds.has(record.id)));
        return;
      }
      const localIds = new Set(local.map((record) => record.id));
      this.records.set([...local, ...remote.filter((record) => !localIds.has(record.id))]);
    });
    void this.restoreRecords();
  }

  create(
    inspection: NewInspection,
    checklistSections: ChecklistGenerationSection[],
    checklistContext: ChecklistGenerationAnswer[],
  ): string {
    const id = `IN-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const [year, month, day] = inspection.date.split('-').map(Number);
    const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      .format(new Date(year, month - 1, day));
    let itemIndex = 0;
    const checklist = checklistSections.flatMap((section) => section.items.map((label) => ({
      id: `c${++itemIndex}`,
      section: section.title,
      label,
      result: null,
      comment: '',
      evidence: [],
    })));

    this.updateRecords((records) => [{
      ...inspection,
      date,
      id,
      status: 'Scheduled',
      defects: 0,
      criticalDefects: 0,
      checklist,
      checklistContext: [...checklistContext],
    }, ...records]);

    return id;
  }

  updateResult(inspectionId: string, itemId: string, result: CheckResult): void {
    this.updateRecords((records) => records.map((record) => record.id === inspectionId
      ? { ...record, checklist: record.checklist.map((item) => item.id === itemId ? { ...item, result } : item) }
      : record));
  }

  updateComment(inspectionId: string, itemId: string, comment: string): void {
    this.updateRecords((records) => records.map((record) => record.id === inspectionId
      ? { ...record, checklist: record.checklist.map((item) => item.id === itemId ? { ...item, comment } : item) }
      : record));
  }

  save(inspectionId: string): void {
    this.updateRecords((records) => records.map((record) => {
      if (record.id !== inspectionId) return record;
      const defects = record.checklist.filter((item) => item.result === 'fail').length;
      const complete = record.checklist.every((item) => item.result !== null);
      return { ...record, defects, status: complete ? (defects ? 'Needs review' : 'Completed') : 'In progress' };
    }));
  }

  async addEvidence(inspectionId: string, itemId: string, file: File): Promise<void> {
    const record = this.records().find((item) => item.id === inspectionId);
    const checklistItem = record?.checklist.find((item) => item.id === itemId);
    if (!checklistItem) throw new Error('The inspection checklist item could not be found.');

    const evidence: InspectionEvidence = {
      id: `evidence-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
      name: file.name,
      mediaType: file.type || 'application/octet-stream',
    };
    await this.offlineDatabase.write(this.evidenceStorageKey(evidence.id), file);
    this.updateRecords((records) => records.map((item) => item.id === inspectionId
      ? {
          ...item,
          checklist: item.checklist.map((check) => check.id === itemId
            ? { ...check, evidence: [...check.evidence, evidence] }
            : check),
        }
      : item));
  }

  async getEvidence(id: string): Promise<Blob | undefined> {
    const localEvidence = await this.offlineDatabase.read<Blob>(this.evidenceStorageKey(id));
    if (localEvidence) return localEvidence;
    const inspection = this.records().find((record) =>
      record.checklist.some((item) => item.evidence.some((evidence) => evidence.id === id)));
    if (!inspection) return undefined;
    return this.syncService.loadEvidence(inspection.id, id);
  }

  async removeEvidence(inspectionId: string, itemId: string, evidenceId: string): Promise<void> {
    await this.offlineDatabase.remove(this.evidenceStorageKey(evidenceId));
    this.updateRecords((records) => records.map((item) => item.id === inspectionId
      ? {
          ...item,
          checklist: item.checklist.map((check) => check.id === itemId
            ? { ...check, evidence: check.evidence.filter((evidence) => evidence.id !== evidenceId) }
            : check),
        }
      : item));
  }

  isLocallyAvailable(inspectionId: string): boolean {
    return this.localRecords().some((record) => record.id === inspectionId);
  }

  getChecklistSections(checklist: ChecklistItem[]): InspectionChecklistSection[] {
    const groups = new Map<string, ChecklistItem[]>();
    for (const item of checklist) {
      const items = groups.get(item.section) ?? [];
      items.push(item);
      groups.set(item.section, items);
    }

    let startIndex = 0;
    return [...groups].map(([title, items]) => {
      const section = { title, items, startIndex };
      startIndex += items.length;
      return section;
    });
  }

  private updateRecords(update: (records: InspectionRecord[]) => InspectionRecord[]): void {
    const previous = this.records();
    const next = update(previous);
    const previousById = new Map(previous.map((record) => [record.id, record]));
    const changedIds = next
      .filter((record) => previousById.get(record.id) !== record)
      .map((record) => record.id);
    this.records.set(next);
    const localById = new Map(this.localRecords().map((record) => [record.id, record]));
    const nextById = new Map(next.map((record) => [record.id, record]));
    for (const id of changedIds) {
      const changed = nextById.get(id);
      if (changed) localById.set(id, changed);
    }
    const nextLocal = [...localById.values()];
    this.localRecords.set(nextLocal);
    if (this.hydrated) {
      this.persistRecords(nextLocal, changedIds);
    } else {
      this.pendingChanges.push(update);
    }
  }

  private async restoreRecords(): Promise<void> {
    try {
      const saved = await this.offlineDatabase.read<unknown>(INSPECTIONS_STORAGE_KEY);
      let restored = Array.isArray(saved) ? saved as InspectionRecord[] : [];
      restored = restored.map((record) => ({
        ...record,
        checklist: record.checklist.map((item) => ({ ...item, evidence: item.evidence ?? [] })),
      }));
      for (const update of this.pendingChanges) restored = update(restored);
      const hadPendingChanges = this.pendingChanges.length > 0;
      this.pendingChanges.length = 0;
      this.localRecords.set(restored);
      this.records.set(restored);
      this.hydrated = true;
      if (hadPendingChanges) this.persistRecords(restored, restored.map((record) => record.id));
      else {
        await this.syncService.restoreLocalRecords(restored);
        this.persistenceState.set('saved');
      }
    } catch (error: unknown) {
      this.hydrated = true;
      this.pendingChanges.length = 0;
      this.persistenceState.set('error');
      this.persistenceError.set(error instanceof Error ? error.message : 'Could not load offline inspections.');
    }
  }

  private persistRecords(records: InspectionRecord[], changedIds: string[]): void {
    this.persistenceState.set('saving');
    this.persistenceQueue = this.persistenceQueue
      .then(() => this.syncService.saveLocalRecords(records, changedIds))
      .then(() => {
        this.persistenceState.set('saved');
        this.persistenceError.set(null);
      })
      .catch((error: unknown) => {
        this.persistenceState.set('error');
        this.persistenceError.set(error instanceof Error ? error.message : 'Could not save this inspection offline.');
      });
  }

  private evidenceStorageKey(id: string): string {
    return `inspection-evidence:${id}`;
  }
}
