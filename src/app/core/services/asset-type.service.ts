import { Injectable, computed, inject } from '@angular/core';
import { AssetTypeRecord, NewAssetType } from '../models/asset-type.model';
import { ApplicationDataService } from './application-data.service';

function createId(): string {
  return `asset-type-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

@Injectable({ providedIn: 'root' })
export class AssetTypeService {
  private readonly applicationData = inject(ApplicationDataService);
  readonly records = computed(() => this.applicationData.assetTypes());

  getAssetTypes(): AssetTypeRecord[] {
    return this.records();
  }

  getAssetTypeById(id: string): AssetTypeRecord | undefined {
    return this.records().find((assetType) => assetType.id === id);
  }

  createAssetType(data: NewAssetType): AssetTypeRecord {
    const name = data.name.trim();
    const category = data.category.trim();
    if (!name || !category) throw new Error('An asset type name and category are required.');
    if (this.records().some((assetType) => assetType.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error(`The asset type "${name}" already exists.`);
    }

    const assetType: AssetTypeRecord = { id: createId(), name, category, description: data.description.trim(), isCustom: true };
    this.applicationData.update((current) => ({ ...current, assetTypes: [...current.assetTypes, assetType] }));
    return assetType;
  }

  updateAssetType(id: string, changes: Partial<NewAssetType>): AssetTypeRecord {
    const existing = this.getAssetTypeById(id);
    if (!existing) throw new Error(`Asset type "${id}" was not found.`);
    if (!existing.isCustom) throw new Error('System asset types cannot be edited. Create a custom asset type instead.');
    const name = changes.name?.trim() ?? existing.name;
    const category = changes.category?.trim() ?? existing.category;
    if (!name || !category) throw new Error('An asset type name and category are required.');
    if (this.records().some((assetType) => assetType.id !== id && assetType.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error(`The asset type "${name}" already exists.`);
    }

    const updated = { ...existing, name, category, description: changes.description?.trim() ?? existing.description };
    this.applicationData.update((current) => ({
      ...current,
      assetTypes: current.assetTypes.map((assetType) => assetType.id === id ? updated : assetType),
    }));
    return updated;
  }

  deleteAssetType(id: string): boolean {
    const existing = this.getAssetTypeById(id);
    if (!existing) return false;
    if (!existing.isCustom) throw new Error('System asset types cannot be deleted.');
    this.applicationData.update((current) => ({
      ...current,
      assetTypes: current.assetTypes.filter((assetType) => assetType.id !== id),
    }));
    return true;
  }
}
