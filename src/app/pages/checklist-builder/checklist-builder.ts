import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { Router } from '@angular/router';
import { AssetTypeService } from '../../core/services/asset-type.service';
import { ChecklistTemplateService } from '../../core/services/checklist-template.service';
import {
  ChecklistTemplate,
  ChecklistTemplateSection,
  ChecklistTemplateSource,
  ChecklistTemplateStatus,
} from '../../core/models/checklist-template.model';

@Component({
  selector: 'app-checklist-builder',
  imports: [LucideDynamicIcon],
  templateUrl: './checklist-builder.html',
  styleUrl: './checklist-builder.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistBuilder {
  private readonly router = inject(Router);
  private readonly templateService = inject(ChecklistTemplateService);
  private readonly assetTypeService = inject(AssetTypeService);
  readonly query = signal('');
  readonly assetTypeFilter = signal('ALL');
  readonly statusFilter = signal<ChecklistTemplateStatus | 'ALL'>('ALL');
  readonly sourceFilter = signal<ChecklistTemplateSource | 'ALL'>('ALL');
  readonly selectedTemplate = signal<ChecklistTemplate | null>(null);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly message = signal<{ text: string; error: boolean } | null>(null);
  readonly assetTypes = this.assetTypeService.records;
  readonly categories = computed(() => [...new Set(this.assetTypes().map((assetType) => assetType.category))]);
  readonly templates = computed(() => this.templateService.getTemplates({
    search: this.query(),
    assetType: this.assetTypeFilter(),
    status: this.statusFilter(),
    source: this.sourceFilter(),
  }));
  startChecklistGeneration(): void {
    void this.router.navigate(['/inspections'], { queryParams: { create: true } });
  }

  preview(template: ChecklistTemplate): void {
    this.selectedTemplate.set(template);
  }

  closePreview(): void {
    this.selectedTemplate.set(null);
  }

  duplicate(template: ChecklistTemplate): void {
    try {
      const copy = this.templateService.duplicateTemplate(template.id);
      this.preview(copy);
      this.showMessage(`Created draft copy "${copy.title}".`, false);
    } catch (error: unknown) {
      this.showMessage(error instanceof Error ? error.message : 'The template could not be duplicated.', true);
    }
  }

  archive(template: ChecklistTemplate): void {
    try {
      this.templateService.archiveTemplate(template.id);
      this.showMessage(`Archived "${template.title}".`, false);
    } catch (error: unknown) {
      this.showMessage(error instanceof Error ? error.message : 'The template could not be archived.', true);
    }
  }

  requestDelete(template: ChecklistTemplate): void {
    this.pendingDeleteId.set(template.id);
  }

  cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  confirmDelete(template: ChecklistTemplate): void {
    try {
      this.templateService.deleteTemplate(template.id);
      this.pendingDeleteId.set(null);
      this.selectedTemplate.set(null);
      this.showMessage(`Deleted "${template.title}".`, false);
    } catch (error: unknown) {
      this.showMessage(error instanceof Error ? error.message : 'The template could not be deleted.', true);
    }
  }

  sourceLabel(source: ChecklistTemplateSource): string {
    if (source === 'SYSTEM') return 'System';
    if (source === 'AI_GENERATED') return 'AI generated';
    return 'Created by you';
  }

  countQuestions(sections: ChecklistTemplateSection[]): number {
    return sections.reduce((total, section) => total + section.items.length, 0);
  }

  private showMessage(text: string, error: boolean): void {
    this.message.set({ text, error });
  }
}
