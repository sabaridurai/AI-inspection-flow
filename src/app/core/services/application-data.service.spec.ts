import { TestBed } from '@angular/core/testing';
import { ApplicationDataService, APPLICATION_DATA_STORAGE_KEY } from './application-data.service';
import { OfflineDatabaseService } from './offline-database.service';

describe('ApplicationDataService', () => {
  let offlineValues: Map<string, unknown>;
  let offlineDatabase: {
    read: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  const storedValues = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storedValues.get(key) ?? null,
    setItem: (key: string, value: string) => storedValues.set(key, value),
    removeItem: (key: string) => storedValues.delete(key),
  };
  const legacySystemTemplate = {
    id: 'tpl-vehicle-prepurchase',
    title: 'Vehicle pre-purchase inspection',
    description: 'Seed checklist',
    assetType: 'Passenger car',
    inspectionPurpose: 'Pre-purchase condition assessment',
    source: 'SYSTEM',
    version: 1,
    status: 'ACTIVE',
    sections: [],
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
  };
  const legacyData = {
    schemaVersion: 1,
    assetTypes: [],
    templates: [legacySystemTemplate],
    inspections: [],
    defects: [],
    recentlyUsedTemplateIds: [legacySystemTemplate.id],
  };

  beforeEach(() => {
    storedValues.clear();
    vi.stubGlobal('localStorage', localStorageMock);
    localStorage.removeItem(APPLICATION_DATA_STORAGE_KEY);
    offlineValues = new Map<string, unknown>();
    offlineDatabase = {
      read: vi.fn((key: string) => Promise.resolve(offlineValues.get(key))),
      write: vi.fn(async (key: string, value: unknown) => { offlineValues.set(key, value); }),
      remove: vi.fn(async () => {}),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: OfflineDatabaseService, useValue: offlineDatabase }],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('seeds and persists application data on first launch', () => {
    const service = TestBed.inject(ApplicationDataService);

    expect(service.templates()).toHaveLength(0);
    expect(service.assetTypes()).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem(APPLICATION_DATA_STORAGE_KEY) ?? '{}').schemaVersion).toBe(1);
  });

  it('restores saved changes after service recreation', () => {
    const service = TestBed.inject(ApplicationDataService);
    const templateId = 'user-template-id';
    service.update((current) => ({
      ...current,
      recentlyUsedTemplateIds: [templateId],
    }));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: OfflineDatabaseService, useValue: offlineDatabase }],
    });
    const restored = TestBed.inject(ApplicationDataService);

    expect(restored.data().recentlyUsedTemplateIds).toEqual([templateId]);
    expect(restored.storageError()).toBeNull();
  });

  it('uses seed data and surfaces an error for an unsupported stored schema', () => {
    localStorage.setItem(APPLICATION_DATA_STORAGE_KEY, JSON.stringify({ schemaVersion: 999 }));

    const service = TestBed.inject(ApplicationDataService);

    expect(service.templates()).toHaveLength(0);
    expect(service.storageError()).toContain('unsupported schema');
  });

  it('removes previously cached system templates from local and offline storage', async () => {
    localStorage.setItem(APPLICATION_DATA_STORAGE_KEY, JSON.stringify(legacyData));
    offlineValues.set('application-data', legacyData);

    const service = TestBed.inject(ApplicationDataService);

    expect(service.templates()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(APPLICATION_DATA_STORAGE_KEY) ?? '{}').templates).toEqual([]);

    await vi.waitFor(() => {
      expect(offlineValues.get('application-data')).toMatchObject({
        templates: [],
        recentlyUsedTemplateIds: [],
      });
    });
  });
});
