import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Auth } from '../../services/auth';
import { InspectionRecord } from '../../services/inspection';
import { environment } from '../../../environments/environment';
import { OfflineDatabaseService } from './offline-database.service';
import { InspectionSyncService } from './inspection-sync.service';

describe('InspectionSyncService', () => {
  let service: InspectionSyncService;
  let http: HttpTestingController;
  const values = new Map<string, unknown>();
  const subject = signal<string | null>(null);
  const database = {
    read: vi.fn((key: string) => Promise.resolve(values.get(key))),
    write: vi.fn(async (key: string, value: unknown) => { values.set(key, value); }),
    writeMany: vi.fn(async (entries: Array<{ key: string; value: unknown }>) => {
      for (const entry of entries) values.set(entry.key, entry.value);
    }),
    writeAndRemove: vi.fn(async (entries: Array<{ key: string; value: unknown }>, keys: string[]) => {
      for (const entry of entries) values.set(entry.key, entry.value);
      for (const key of keys) values.delete(key);
    }),
    remove: vi.fn(async (key: string) => { values.delete(key); }),
  };
  const auth = { userSubject: subject };
  const record: InspectionRecord = {
    id: 'IN-sync-test',
    asset: 'Generator 1',
    assetType: 'Generator',
    location: 'Plant room',
    inspector: 'Taylor',
    date: 'Nov 2, 2026',
    status: 'Completed',
    defects: 0,
    criticalDefects: 0,
    checklist: [{
      id: 'c1',
      section: 'Condition',
      label: 'Inspect enclosure',
      result: 'pass',
      comment: '',
      evidence: [{ id: 'evidence-photo-1', name: 'enclosure.png', mediaType: 'image/png' }],
    }],
    checklistContext: [],
  };

  beforeEach(() => {
    values.clear();
    subject.set(null);
    vi.stubGlobal('navigator', { onLine: true });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Auth, useValue: auth },
        { provide: OfflineDatabaseService, useValue: database },
      ],
    });
    service = TestBed.inject(InspectionSyncService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  it('queues local inspections, binds them to the first signed-in account, and syncs record plus photo', async () => {
    const photo = new Blob(['photo bytes'], { type: 'image/png' });
    values.set('inspection-evidence:evidence-photo-1', photo);
    await service.restoreLocalRecords([record]);

    expect(service.pendingCount()).toBe(1);
    expect(service.state()).toBe('idle');

    subject.set('inspector@example.com');
    let remoteRequest = undefined as ReturnType<typeof http.expectOne> | undefined;
    await vi.waitFor(() => {
      remoteRequest = http.expectOne(`${environment.apiBaseUrl}/inspections`);
    });
    remoteRequest?.flush([]);
    let request = undefined as ReturnType<typeof http.expectOne> | undefined;
    await vi.waitFor(() => {
      request = http.expectOne(`${environment.apiBaseUrl}/inspections/${record.id}`);
    });
    if (!request) throw new Error('Inspection sync request was not sent.');
    expect(request.request.method).toBe('PUT');
    const body = request.request.body as FormData;
    expect(body.get('inspection')).toBeInstanceOf(Blob);
    expect((body.getAll('files')[0] as File).name).toBe('evidence-photo-1');
    request.flush({ clientId: record.id, updatedAt: new Date().toISOString() });
    await vi.waitFor(() => expect(service.state()).toBe('synced'));

    expect(service.pendingCount()).toBe(0);
    expect(service.state()).toBe('synced');
    expect(values.get('inspection-outbox')).toEqual([]);
    expect(values.get('inspection-records')).toEqual([]);
    expect(values.has('inspection-evidence:evidence-photo-1')).toBe(false);
    expect(service.outboxItems()).toEqual([]);
    expect(service.remoteRecords()).toEqual([record]);
  });

  it('keeps failed uploads queued for retry', async () => {
    const recordWithoutPhoto = { ...record, checklist: [{ ...record.checklist[0], evidence: [] }] };
    await service.restoreLocalRecords([recordWithoutPhoto]);
    subject.set('inspector@example.com');
    let remoteRequest = undefined as ReturnType<typeof http.expectOne> | undefined;
    await vi.waitFor(() => {
      remoteRequest = http.expectOne(`${environment.apiBaseUrl}/inspections`);
    });
    remoteRequest?.flush([]);

    let request = undefined as ReturnType<typeof http.expectOne> | undefined;
    await vi.waitFor(() => {
      request = http.expectOne(`${environment.apiBaseUrl}/inspections/${record.id}`);
    });
    if (!request) throw new Error('Inspection sync request was not sent.');
    request.flush({ error: 'unavailable' }, { status: 503, statusText: 'Service Unavailable' });
    await vi.waitFor(() => expect(service.state()).toBe('error'));

    expect(service.pendingCount()).toBe(1);
    expect(service.state()).toBe('error');
    expect(service.error()).toContain('HTTP 503');
    expect(values.get('inspection-records')).toEqual([recordWithoutPhoto]);
  });

  it('explains when the primary database API cannot be reached', async () => {
    const recordWithoutPhoto = { ...record, checklist: [{ ...record.checklist[0], evidence: [] }] };
    await service.restoreLocalRecords([recordWithoutPhoto]);
    subject.set('inspector@example.com');
    let remoteRequest = undefined as ReturnType<typeof http.expectOne> | undefined;
    await vi.waitFor(() => {
      remoteRequest = http.expectOne(`${environment.apiBaseUrl}/inspections`);
    });
    remoteRequest?.flush([]);
    let request = undefined as ReturnType<typeof http.expectOne> | undefined;
    await vi.waitFor(() => {
      request = http.expectOne(`${environment.apiBaseUrl}/inspections/${record.id}`);
    });
    if (!request) throw new Error('Inspection sync request was not sent.');
    request.error(new ProgressEvent('error'));
    await vi.waitFor(() => expect(service.state()).toBe('error'));

    expect(service.error()).toContain('Could not reach the primary database API');
    expect(service.pendingCount()).toBe(1);
  });
});
