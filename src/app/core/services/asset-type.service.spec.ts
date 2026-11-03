import { TestBed } from '@angular/core/testing';
import { AssetTypeService } from './asset-type.service';
import { APPLICATION_DATA_STORAGE_KEY } from './application-data.service';

describe('AssetTypeService', () => {
  let service: AssetTypeService;
  const storedValues = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storedValues.get(key) ?? null,
    setItem: (key: string, value: string) => storedValues.set(key, value),
    removeItem: (key: string) => storedValues.delete(key),
  };

  beforeEach(() => {
    storedValues.clear();
    vi.stubGlobal('localStorage', localStorageMock);
    localStorage.removeItem(APPLICATION_DATA_STORAGE_KEY);
    TestBed.configureTestingModule({});
    service = TestBed.inject(AssetTypeService);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('starts without seeded asset types', () => {
    expect(service.getAssetTypes()).toEqual([]);
  });

  it('creates, updates, and deletes custom asset types', () => {
    const created = service.createAssetType({ name: 'Inspection drone', category: 'Other', description: 'A custom asset.' });
    expect(service.getAssetTypeById(created.id)?.name).toBe('Inspection drone');

    service.updateAssetType(created.id, { name: 'Survey drone' });
    expect(service.getAssetTypeById(created.id)?.name).toBe('Survey drone');
    expect(service.deleteAssetType(created.id)).toBe(true);
    expect(service.getAssetTypeById(created.id)).toBeUndefined();
  });
});
