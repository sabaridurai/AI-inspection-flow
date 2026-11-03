import { Injectable, computed, inject, signal } from '@angular/core';
import { ASSET_TYPES_MOCK } from '../mock-data/asset-types.mock';
import { APPLICATION_DATA_SCHEMA_VERSION, ApplicationData } from '../models/application-data.model';
import { AssetTypeRecord } from '../models/asset-type.model';
import {
  ChecklistResponseType,
  ChecklistSeverity,
  ChecklistTemplate,
  ChecklistTemplateSource,
  ChecklistTemplateStatus,
} from '../models/checklist-template.model';
import { Defect } from '../models/defect.model';
import { InspectionRecord } from '../models/inspection.model';
import { StorageService } from './storage.service';
import { OfflineDatabaseService } from './offline-database.service';

export const APPLICATION_DATA_STORAGE_KEY = 'inspectra.application-data';
const OFFLINE_APPLICATION_DATA_KEY = 'application-data';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === 'string';
}

function isAssetType(value: unknown): value is AssetTypeRecord {
  return isObject(value)
    && hasString(value, 'id')
    && hasString(value, 'name')
    && hasString(value, 'category')
    && hasString(value, 'description')
    && typeof value['isCustom'] === 'boolean';
}

function isChecklistTemplate(value: unknown): value is ChecklistTemplate {
  if (!isObject(value) || !Array.isArray(value['sections'])) return false;
  if (!hasString(value, 'id') || !hasString(value, 'title') || !hasString(value, 'description')
    || !hasString(value, 'assetType') || !hasString(value, 'inspectionPurpose')
    || !hasString(value, 'createdAt') || !hasString(value, 'updatedAt')) return false;
  if (!['SYSTEM', 'AI_GENERATED', 'USER_CREATED'].includes(value['source'] as ChecklistTemplateSource)
    || !['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(value['status'] as ChecklistTemplateStatus)
    || typeof value['version'] !== 'number') return false;
  return value['sections'].every((section: unknown) => {
    if (!isObject(section) || !Array.isArray(section['items'])) return false;
    if (!hasString(section, 'id') || !hasString(section, 'title') || !hasString(section, 'description')
      || typeof section['displayOrder'] !== 'number') return false;
    return section['items'].every((item: unknown) => isObject(item)
      && hasString(item, 'id')
      && hasString(item, 'question')
      && hasString(item, 'instructions')
      && hasString(item, 'acceptanceCriteria')
      && ['PASS_FAIL_NA', 'YES_NO_NA', 'TEXT', 'NUMBER', 'SINGLE_SELECT', 'DATE', 'PHOTO'].includes(item['responseType'] as ChecklistResponseType)
      && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(item['severity'] as ChecklistSeverity)
      && typeof item['required'] === 'boolean'
      && typeof item['photoEvidenceRequired'] === 'boolean'
      && typeof item['displayOrder'] === 'number');
  });
}

function isInspectionAsset(value: unknown): boolean {
  return isObject(value)
    && hasString(value, 'assetType')
    && hasString(value, 'assetName')
    && hasString(value, 'assetId')
    && hasString(value, 'make')
    && hasString(value, 'model')
    && hasString(value, 'serialNumber')
    && (value['odometer'] === null || typeof value['odometer'] === 'number')
    && isObject(value['customDetails'])
    && Object.values(value['customDetails']).every((detail) => typeof detail === 'string');
}

function isInspectionResponse(value: unknown): boolean {
  return isObject(value)
    && hasString(value, 'id')
    && hasString(value, 'checklistItemId')
    && (value['value'] === null || typeof value['value'] === 'string'
      || typeof value['value'] === 'number' || typeof value['value'] === 'boolean')
    && hasString(value, 'notes')
    && Array.isArray(value['evidenceImageIds'])
    && value['evidenceImageIds'].every((id: unknown) => typeof id === 'string');
}

function isInspection(value: unknown): value is InspectionRecord {
  return isObject(value)
    && hasString(value, 'id')
    && hasString(value, 'title')
    && hasString(value, 'templateId')
    && hasString(value, 'templateTitle')
    && isChecklistTemplate(value['templateSnapshot'])
    && isInspectionAsset(value['asset'])
    && hasString(value, 'inspectorName')
    && hasString(value, 'inspectorEmail')
    && hasString(value, 'inspectionDate')
    && (value['completionDate'] === null || hasString(value, 'completionDate'))
    && ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'REQUIRES_REPAIR'].includes(value['status'] as string)
    && Array.isArray(value['responses'])
    && value['responses'].every(isInspectionResponse)
    && hasString(value, 'notes')
    && Array.isArray(value['defectIds'])
    && value['defectIds'].every((id: unknown) => typeof id === 'string')
    && hasString(value, 'createdAt')
    && hasString(value, 'updatedAt');
}

function isDefect(value: unknown): value is Defect {
  return isObject(value)
    && hasString(value, 'id')
    && hasString(value, 'inspectionId')
    && hasString(value, 'checklistItemId')
    && hasString(value, 'description')
    && ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(value['severity'] as ChecklistSeverity)
    && Array.isArray(value['evidenceImageIds'])
    && value['evidenceImageIds'].every((id: unknown) => typeof id === 'string')
    && hasString(value, 'recommendedAction')
    && ['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(value['status'] as string)
    && hasString(value, 'assignedTo')
    && (value['targetCompletionDate'] === null || hasString(value, 'targetCompletionDate'))
    && hasString(value, 'createdAt')
    && hasString(value, 'updatedAt');
}

export function isApplicationData(value: unknown): value is ApplicationData {
  return isObject(value)
    && value['schemaVersion'] === APPLICATION_DATA_SCHEMA_VERSION
    && Array.isArray(value['assetTypes'])
    && value['assetTypes'].every(isAssetType)
    && Array.isArray(value['templates'])
    && value['templates'].every(isChecklistTemplate)
    && Array.isArray(value['inspections'])
    && value['inspections'].every(isInspection)
    && Array.isArray(value['defects'])
    && value['defects'].every(isDefect)
    && Array.isArray(value['recentlyUsedTemplateIds'])
    && value['recentlyUsedTemplateIds'].every((id: unknown) => typeof id === 'string');
}

function createSeedData(): ApplicationData {
  return {
    schemaVersion: APPLICATION_DATA_SCHEMA_VERSION,
    assetTypes: ASSET_TYPES_MOCK.map((assetType) => ({ ...assetType })),
    templates: [],
    inspections: [],
    defects: [],
    recentlyUsedTemplateIds: [],
  };
}

function removeSystemTemplates(data: ApplicationData): ApplicationData {
  const templates = data.templates.filter((template) => template.source !== 'SYSTEM');
  if (templates.length === data.templates.length) return data;

  const templateIds = new Set(templates.map((template) => template.id));
  return {
    ...data,
    templates,
    recentlyUsedTemplateIds: data.recentlyUsedTemplateIds.filter((id) => templateIds.has(id)),
  };
}

@Injectable({ providedIn: 'root' })
export class ApplicationDataService {
  private readonly storage = inject(StorageService);
  private readonly offlineDatabase = inject(OfflineDatabaseService);
  private readonly dataState = signal<ApplicationData>(createSeedData());
  private readonly pendingUpdates: Array<(current: ApplicationData) => ApplicationData> = [];
  private hydrated = false;
  private persistenceQueue: Promise<void> = Promise.resolve();
  readonly data = this.dataState.asReadonly();
  readonly assetTypes = computed(() => this.dataState().assetTypes);
  readonly templates = computed(() => this.dataState().templates);
  readonly inspections = computed(() => this.dataState().inspections);
  readonly defects = computed(() => this.dataState().defects);
  readonly storageError = signal<string | null>(null);

  constructor() {
    const saved = this.storage.read(APPLICATION_DATA_STORAGE_KEY, isApplicationData);
    if (saved.status === 'valid') {
      const cleanData = removeSystemTemplates(saved.value);
      this.dataState.set(cleanData);
      if (cleanData !== saved.value) {
        const result = this.storage.write(APPLICATION_DATA_STORAGE_KEY, cleanData);
        this.storageError.set(result.error);
      }
    } else if (saved.status === 'missing') {
      const result = this.storage.write(APPLICATION_DATA_STORAGE_KEY, this.dataState());
      this.storageError.set(result.error);
    } else if (saved.status === 'invalid') {
      this.storageError.set(saved.error);
    } else {
      this.storageError.set(saved.error);
    }
    void this.restoreOfflineData(this.dataState());
  }

  update(update: (current: ApplicationData) => ApplicationData): void {
    const next = update(this.dataState());
    this.dataState.set(next);
    const result = this.storage.write(APPLICATION_DATA_STORAGE_KEY, next);
    if (result.error) this.storageError.set(result.error);
    if (this.hydrated) {
      this.persistOfflineData(next);
    } else {
      this.pendingUpdates.push(update);
    }
  }

  resetToSeed(): void {
    this.update(() => createSeedData());
  }

  private async restoreOfflineData(legacyData: ApplicationData): Promise<void> {
    try {
      const saved = await this.offlineDatabase.read<unknown>(OFFLINE_APPLICATION_DATA_KEY);
      const offlineData = isApplicationData(saved) ? removeSystemTemplates(saved) : legacyData;
      let restored = offlineData;
      const hadOfflineData = isApplicationData(saved);
      for (const update of this.pendingUpdates) restored = update(restored);
      this.pendingUpdates.length = 0;
      this.hydrated = true;
      this.dataState.set(restored);
      if (!hadOfflineData || restored !== saved) {
        await this.offlineDatabase.write(OFFLINE_APPLICATION_DATA_KEY, restored);
      }
      this.storageError.set(null);
    } catch (error: unknown) {
      this.hydrated = true;
      this.pendingUpdates.length = 0;
      this.storageError.set(error instanceof Error ? error.message : 'Could not load offline application data.');
    }
  }

  private persistOfflineData(data: ApplicationData): void {
    this.persistenceQueue = this.persistenceQueue
      .then(() => this.offlineDatabase.write(OFFLINE_APPLICATION_DATA_KEY, data))
      .then(() => this.storageError.set(null))
      .catch((error: unknown) => {
        this.storageError.set(error instanceof Error ? error.message : 'Could not save offline application data.');
      });
  }
}
