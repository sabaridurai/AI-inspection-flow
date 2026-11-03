import { Injectable, computed, inject } from '@angular/core';
import {
  ChecklistTemplate,
  ChecklistTemplateFilters,
  ChecklistTemplateSection,
  NewChecklistTemplate,
} from '../models/checklist-template.model';
import { ApplicationDataService } from './application-data.service';

function createId(): string {
  return `template-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function cloneSections(sections: ChecklistTemplateSection[], prefix: string): ChecklistTemplateSection[] {
  return sections.map((section, sectionIndex) => ({
    ...section,
    id: `${prefix}-section-${sectionIndex + 1}`,
    items: section.items.map((item, itemIndex) => ({
      ...item,
      id: `${prefix}-question-${sectionIndex + 1}-${itemIndex + 1}`,
    })),
  }));
}

@Injectable({ providedIn: 'root' })
export class ChecklistTemplateService {
  private readonly applicationData = inject(ApplicationDataService);
  readonly templates = computed(() => this.applicationData.templates());

  getTemplates(filters: ChecklistTemplateFilters = {}): ChecklistTemplate[] {
    const query = filters.search?.trim().toLocaleLowerCase() ?? '';
    return this.templates().filter((template) =>
      (!query || `${template.title} ${template.description} ${template.assetType} ${template.inspectionPurpose}`.toLocaleLowerCase().includes(query))
      && (!filters.assetType || filters.assetType === 'ALL' || template.assetType === filters.assetType)
      && (!filters.status || filters.status === 'ALL' || template.status === filters.status)
      && (!filters.source || filters.source === 'ALL' || template.source === filters.source));
  }

  getTemplateById(id: string): ChecklistTemplate | undefined {
    return this.templates().find((template) => template.id === id);
  }

  createTemplate(data: NewChecklistTemplate): ChecklistTemplate {
    const title = data.title.trim();
    if (!title) throw new Error('A template title is required.');
    const now = new Date().toISOString();
    const id = createId();
    const template: ChecklistTemplate = {
      id,
      title,
      description: data.description.trim(),
      assetType: data.assetType.trim(),
      inspectionPurpose: data.inspectionPurpose.trim(),
      source: data.source ?? 'USER_CREATED',
      version: 1,
      status: 'DRAFT',
      sections: cloneSections(data.sections, id),
      createdAt: now,
      updatedAt: now,
    };
    this.applicationData.update((current) => ({ ...current, templates: [template, ...current.templates] }));
    return template;
  }

  updateTemplate(id: string, changes: Partial<Omit<ChecklistTemplate, 'id' | 'source' | 'createdAt'>>): ChecklistTemplate {
    const existing = this.getTemplateById(id);
    if (!existing) throw new Error(`Checklist template "${id}" was not found.`);
    if (existing.source === 'SYSTEM') throw new Error('System templates are protected. Duplicate the template to edit it.');
    const updated: ChecklistTemplate = {
      ...existing,
      ...changes,
      id,
      source: existing.source,
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.applicationData.update((current) => ({
      ...current,
      templates: current.templates.map((template) => template.id === id ? updated : template),
    }));
    return updated;
  }

  duplicateTemplate(id: string): ChecklistTemplate {
    const original = this.getTemplateById(id);
    if (!original) throw new Error(`Checklist template "${id}" was not found.`);
    const duplicate = this.createTemplate({
      title: `${original.title} (Copy)`,
      description: original.description,
      assetType: original.assetType,
      inspectionPurpose: original.inspectionPurpose,
      sections: original.sections,
      source: original.source === 'AI_GENERATED' ? 'AI_GENERATED' : 'USER_CREATED',
    });
    return duplicate;
  }

  archiveTemplate(id: string): ChecklistTemplate {
    const template = this.getTemplateById(id);
    if (!template) throw new Error(`Checklist template "${id}" was not found.`);
    if (template.source === 'SYSTEM') throw new Error('System templates cannot be archived.');
    return this.updateTemplate(id, { status: 'ARCHIVED' });
  }

  markRecentlyUsed(id: string): void {
    if (!this.getTemplateById(id)) throw new Error(`Checklist template "${id}" was not found.`);
    this.applicationData.update((current) => ({
      ...current,
      recentlyUsedTemplateIds: [id, ...current.recentlyUsedTemplateIds.filter((templateId) => templateId !== id)].slice(0, 8),
    }));
  }

  deleteTemplate(id: string): boolean {
    const template = this.getTemplateById(id);
    if (!template) return false;
    if (template.source === 'SYSTEM') throw new Error('System templates are protected and cannot be deleted.');
    this.applicationData.update((current) => ({
      ...current,
      templates: current.templates.filter((item) => item.id !== id),
      recentlyUsedTemplateIds: current.recentlyUsedTemplateIds.filter((item) => item !== id),
    }));
    return true;
  }

  saveGeneratedTemplate(data: Omit<NewChecklistTemplate, 'source'>): ChecklistTemplate {
    return this.createTemplate({ ...data, source: 'AI_GENERATED' });
  }
}
