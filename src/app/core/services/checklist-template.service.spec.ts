import { TestBed } from '@angular/core/testing';
import { ChecklistTemplateService } from './checklist-template.service';
import { APPLICATION_DATA_STORAGE_KEY } from './application-data.service';

describe('ChecklistTemplateService', () => {
  let service: ChecklistTemplateService;
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
    service = TestBed.inject(ChecklistTemplateService);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('starts without built-in checklist templates', () => {
    expect(service.getTemplates()).toEqual([]);
  });

  it('filters templates by search, asset type, and source', () => {
    service.createTemplate({
      title: 'Truck pre-trip',
      description: 'Driver checks',
      assetType: 'Commercial truck',
      inspectionPurpose: 'Pre-trip',
      sections: [],
    });
    service.createTemplate({
      title: 'AI elevator checklist',
      description: 'Generated checklist',
      assetType: 'Passenger elevator',
      inspectionPurpose: 'Annual review',
      sections: [],
      source: 'AI_GENERATED',
    });

    expect(service.getTemplates({ search: 'pre-trip' }).map((template) => template.title)).toEqual(['Truck pre-trip']);
    expect(service.getTemplates({ assetType: 'Passenger elevator' })).toHaveLength(1);
    expect(service.getTemplates({ source: 'USER_CREATED' })).toHaveLength(1);
  });

  it('duplicates saved templates as editable copies', () => {
    const original = service.createTemplate({
      title: 'Elevator review',
      description: 'Routine review',
      assetType: 'Passenger elevator',
      inspectionPurpose: 'Annual review',
      sections: [],
      source: 'AI_GENERATED',
    });
    const copy = service.duplicateTemplate(original.id);

    expect(copy.source).toBe('AI_GENERATED');
    expect(copy.status).toBe('DRAFT');
    expect(copy.id).not.toBe(original.id);
    expect(() => service.updateTemplate(original.id, { title: 'Changed template' })).not.toThrow();
  });

  it('persists template changes through the shared application store', () => {
    const template = service.createTemplate({
      title: 'HVAC review',
      description: 'Routine review',
      assetType: 'Air handling unit',
      inspectionPurpose: 'Routine maintenance',
      sections: [],
    });
    service.archiveTemplate(template.id);

    expect(service.getTemplateById(template.id)?.status).toBe('ARCHIVED');
    expect(JSON.parse(localStorage.getItem(APPLICATION_DATA_STORAGE_KEY) ?? '{}').templates.some((entry: { id: string }) => entry.id === template.id)).toBe(true);
  });
});
