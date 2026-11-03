import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Inspection, InspectionRecord } from './inspection';
import { OfflineDatabaseService } from '../core/services/offline-database.service';
import { InspectionSyncService } from '../core/services/inspection-sync.service';

describe('Inspection', () => {
  let service: Inspection;
  const inspectionSync = {
    restoreLocalRecords: vi.fn().mockResolvedValue(undefined),
    saveLocalRecords: vi.fn().mockResolvedValue(undefined),
    syncPending: vi.fn().mockResolvedValue(undefined),
    remoteRecords: signal<InspectionRecord[]>([]),
    clearedLocalIds: signal<string[]>([]),
    loadEvidence: vi.fn().mockResolvedValue(undefined),
  };
  const offlineDatabase = {
    read: vi.fn().mockResolvedValue(undefined),
    write: vi.fn().mockResolvedValue(undefined),
    writeMany: vi.fn().mockResolvedValue(undefined),
    writeAndRemove: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    offlineDatabase.read.mockReset().mockResolvedValue(undefined);
    offlineDatabase.write.mockReset().mockResolvedValue(undefined);
    offlineDatabase.writeMany.mockReset().mockResolvedValue(undefined);
    offlineDatabase.remove.mockReset().mockResolvedValue(undefined);
    inspectionSync.restoreLocalRecords.mockReset().mockResolvedValue(undefined);
    inspectionSync.saveLocalRecords.mockReset().mockResolvedValue(undefined);
    inspectionSync.remoteRecords.set([]);
    inspectionSync.clearedLocalIds.set([]);
    TestBed.configureTestingModule({
      providers: [
        { provide: OfflineDatabaseService, useValue: offlineDatabase },
        { provide: InspectionSyncService, useValue: inspectionSync },
      ],
    });
    service = TestBed.inject(Inspection);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('starts without seeded inspection records', () => {
    expect(service.records()).toEqual([]);
  });

  it('removes a synced inspection from its local available records', async () => {
    const id = service.create({
      asset: 'Local test vehicle',
      assetType: 'Vehicle',
      location: 'Test location',
      inspector: 'Taylor',
      date: '2026-10-14',
    }, [{ title: 'Condition', items: ['Check lights'] }], []);

    await vi.waitFor(() => expect(service.isLocallyAvailable(id)).toBe(true));
    inspectionSync.clearedLocalIds.set([id]);
    await vi.waitFor(() => expect(service.isLocallyAvailable(id)).toBe(false));
    expect(service.records().some((record) => record.id === id)).toBe(false);
  });

  it('creates an inspection from user details and generated checklist labels', async () => {
    const id = service.create({
      asset: 'Loading dock lift',
      assetType: 'Hydraulic freight elevator',
      location: 'Warehouse B, Dock 2',
      inspector: 'Taylor Smith',
      date: '2026-10-14',
    }, [{
      title: 'Elevator operation',
      items: ['Test emergency stop', 'Inspect door sensors'],
    }], [
      { label: 'Manufacturer and model', value: 'LiftCo L300' },
    ]);

    expect(id.startsWith('IN-')).toBe(true);
    expect(service.records()).toEqual([{
      id,
      asset: 'Loading dock lift',
      assetType: 'Hydraulic freight elevator',
      location: 'Warehouse B, Dock 2',
      inspector: 'Taylor Smith',
      date: 'Oct 14, 2026',
      status: 'Scheduled',
      defects: 0,
      criticalDefects: 0,
      checklist: [
        { id: 'c1', section: 'Elevator operation', label: 'Test emergency stop', result: null, comment: '', evidence: [] },
        { id: 'c2', section: 'Elevator operation', label: 'Inspect door sensors', result: null, comment: '', evidence: [] },
      ],
      checklistContext: [
        { label: 'Manufacturer and model', value: 'LiftCo L300' },
      ],
    }]);
    await vi.waitFor(() => {
      expect(inspectionSync.saveLocalRecords).toHaveBeenCalledWith(service.records(), [id]);
    });
  });

  it('preserves checklist section order when grouping an inspection checklist', () => {
    const checklist = [
      { id: 'c1', section: 'Engine and Exhaust', label: 'Engine runs smoothly', result: null, comment: '', evidence: [] },
      { id: 'c2', section: 'Engine and Exhaust', label: 'Check exhaust smoke', result: null, comment: '', evidence: [] },
      { id: 'c3', section: 'Chassis and Frame', label: 'Inspect frame for cracks', result: null, comment: '', evidence: [] },
    ];

    expect(service.getChecklistSections(checklist)).toEqual([
      {
        title: 'Engine and Exhaust',
        items: checklist.slice(0, 2),
        startIndex: 0,
      },
      {
        title: 'Chassis and Frame',
        items: checklist.slice(2),
        startIndex: 2,
      },
    ]);
  });

  it('stores inspection evidence as an image blob in offline storage', async () => {
    const id = service.create({
      asset: 'Loading dock lift',
      assetType: 'Hydraulic freight elevator',
      location: 'Warehouse B, Dock 2',
      inspector: 'Taylor Smith',
      date: '2026-10-14',
    }, [{ title: 'Door safety', items: ['Check door interlock'] }], []);
    const file = new File(['image contents'], 'interlock.png', { type: 'image/png' });

    await service.addEvidence(id, 'c1', file);

    const item = service.records()[0].checklist[0];
    expect(item.evidence).toHaveLength(1);
    expect(item.evidence[0].name).toBe('interlock.png');
    expect(offlineDatabase.write).toHaveBeenCalledWith(
      expect.stringMatching(/^inspection-evidence:/),
      file,
    );
  });
});
