import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideDynamicIcon } from '@lucide/angular';
import { finalize, Subscription } from 'rxjs';
import { Ai, ChecklistGenerationAnswer, ChecklistGenerationQuestion, ChecklistGenerationRequest, ChecklistGenerationSection } from '../../services/ai';
import { Inspection, InspectionStatus } from '../../services/inspection';
import { ChecklistTemplateService } from '../../core/services/checklist-template.service';
import { ChecklistResponseType, ChecklistSeverity } from '../../core/models/checklist-template.model';

@Component({
  selector: 'app-inspections',
  imports: [ReactiveFormsModule, RouterLink, LucideDynamicIcon],
  templateUrl: './inspections.html',
  styleUrl: './inspections.scss',
  host: { '(document:keydown.escape)': 'closeOnEscape()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inspections {
  private readonly inspectionService = inject(Inspection);
  private readonly aiService = inject(Ai);
  private readonly templateService = inject(ChecklistTemplateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly creating = signal(false);
  readonly generatedChecklist = signal<ChecklistGenerationSection[]>([]);
  readonly checklistQuestions = signal<ChecklistGenerationQuestion[]>([]);
  readonly checklistLoading = signal(false);
  readonly checklistGenerating = signal(false);
  readonly aiError = signal('');
  readonly selectedTemplateId = signal('');
  readonly templateTitle = signal('');
  readonly templateSaveMessage = signal('');
  private questionsSubscription?: Subscription;
  private checklistSubscription?: Subscription;
  readonly query = new FormControl('', { nonNullable: true });
  private readonly queryValue = toSignal(this.query.valueChanges, { initialValue: this.query.value });
  readonly statusFilter = signal<InspectionStatus | 'All statuses'>('All statuses');
  readonly statuses: Array<InspectionStatus | 'All statuses'> = ['All statuses', 'In progress', 'Scheduled', 'Completed', 'Needs review'];
  readonly inspectionForm = new FormGroup({
    asset: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    assetType: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    location: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    inspector: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    date: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly checklistContextForm = new FormRecord<FormControl<string>>({});
  private readonly assetTypeValue = toSignal(this.inspectionForm.controls.assetType.valueChanges, {
    initialValue: this.inspectionForm.controls.assetType.value,
  });
  readonly reusableTemplates = computed(() => this.templateService.getTemplates({
    assetType: this.assetTypeValue(),
    status: 'DRAFT',
  }).filter((template) => template.source !== 'SYSTEM'));
  readonly checklistReady = computed(() => {
    const sections = this.generatedChecklist();
    return sections.length > 0 && sections.every((section) =>
      section.title.trim() && section.items.length > 0 && section.items.every((item) => item.trim()));
  });
  readonly totalRecords = computed(() => this.inspectionService.records().length);
  readonly records = computed(() => {
    const query = this.queryValue().trim().toLowerCase();
    const status = this.statusFilter();
    return this.inspectionService.records().filter((record) =>
      (!query || `${record.id} ${record.asset} ${record.location} ${record.inspector}`.toLowerCase().includes(query)) &&
      (status === 'All statuses' || record.status === status));
  });

  constructor() {
    if (this.route.snapshot.queryParamMap.get('create') === 'true') {
      this.openCreateForm();
    }
  }

  openCreateForm(): void {
    this.cancelAiRequests();
    this.generatedChecklist.set([]);
    this.checklistQuestions.set([]);
    this.aiError.set('');
    this.selectedTemplateId.set('');
    this.templateTitle.set('');
    this.templateSaveMessage.set('');
    this.clearChecklistContext();
    this.inspectionForm.reset({ asset: '', assetType: '', location: '', inspector: '', date: '' });
    this.creating.set(true);
  }

  closeCreateForm(): void {
    this.cancelAiRequests();
    this.creating.set(false);
  }

  generateChecklist(): void {
    if (!this.checklistQuestions().length) return;
    if (this.checklistContextForm.invalid) {
      this.checklistContextForm.markAllAsTouched();
      return;
    }
    this.checklistSubscription?.unsubscribe();
    this.aiError.set('');
    this.generatedChecklist.set([]);
    this.templateSaveMessage.set('');
    this.checklistGenerating.set(true);
    this.checklistSubscription = this.aiService.generateChecklist(
      this.getChecklistGenerationRequest(),
      this.getChecklistContext(),
    ).pipe(
      finalize(() => this.checklistGenerating.set(false)),
    ).subscribe({
      next: (response) => {
        this.generatedChecklist.set(response.sections.map((section) => ({
          title: section.title,
          items: [...section.items],
        })));
        this.templateTitle.set(`${this.inspectionForm.controls.assetType.value.trim()} inspection checklist`);
      },
      error: (error: unknown) => this.aiError.set(this.getAiErrorMessage(error)),
    });
  }

  requestChecklistQuestions(): void {
    this.questionsSubscription?.unsubscribe();
    this.clearChecklistContext();
    this.checklistQuestions.set([]);
    this.generatedChecklist.set([]);
    this.aiError.set('');
    if (this.inspectionForm.invalid) {
      this.inspectionForm.markAllAsTouched();
      this.aiError.set('Please enter all required asset details before getting checklist questions.');
      return;
    }

    this.checklistLoading.set(true);
    this.questionsSubscription = this.aiService.getChecklistQuestions(
      this.getChecklistGenerationRequest(),
    ).pipe(
      finalize(() => this.checklistLoading.set(false)),
    ).subscribe({
      next: ({ questions }) => {
        for (const question of questions) {
          this.checklistContextForm.addControl(
            question.key,
            new FormControl('', { nonNullable: true, validators: [Validators.required] }),
          );
        }
        this.checklistQuestions.set(questions);
      },
      error: (error: unknown) => this.aiError.set(this.getAiErrorMessage(error)),
    });
  }

  createInspection(): void {
    if (this.inspectionForm.invalid || this.checklistContextForm.invalid || !this.checklistReady()) return;
    const id = this.inspectionService.create(
      this.inspectionForm.getRawValue(),
      this.generatedChecklist(),
      this.getChecklistContext(),
    );
    this.creating.set(false);
    void this.router.navigate(['/inspections', id]);
  }

  resetChecklist(): void {
    this.cancelAiRequests();
    this.checklistQuestions.set([]);
    this.generatedChecklist.set([]);
    this.aiError.set('');
    this.clearChecklistContext();
    this.selectedTemplateId.set('');
    this.templateSaveMessage.set('');
  }

  updateSectionTitle(sectionIndex: number, event: Event): void {
    const title = (event.target as HTMLInputElement).value;
    this.updateChecklist((sections) => sections.map((section, index) => index === sectionIndex
      ? { ...section, title }
      : section));
  }

  updateChecklistItem(sectionIndex: number, itemIndex: number, event: Event): void {
    const label = (event.target as HTMLInputElement).value;
    this.updateChecklist((sections) => sections.map((section, index) => index === sectionIndex
      ? { ...section, items: section.items.map((item, currentIndex) => currentIndex === itemIndex ? label : item) }
      : section));
  }

  addChecklistPoint(sectionIndex: number): void {
    this.updateChecklist((sections) => sections.map((section, index) => index === sectionIndex
      ? { ...section, items: [...section.items, ''] }
      : section));
  }

  removeChecklistPoint(sectionIndex: number, itemIndex: number): void {
    this.updateChecklist((sections) => sections.map((section, index) => index === sectionIndex
      ? { ...section, items: section.items.filter((_, currentIndex) => currentIndex !== itemIndex) }
      : section));
  }

  moveChecklistPoint(sectionIndex: number, itemIndex: number, event: Event): void {
    const targetIndex = Number((event.target as HTMLSelectElement).value);
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= this.generatedChecklist().length
      || targetIndex === sectionIndex) return;

    this.updateChecklist((sections) => {
      const next = sections.map((section) => ({ ...section, items: [...section.items] }));
      const [item] = next[sectionIndex].items.splice(itemIndex, 1);
      next[targetIndex].items.push(item);
      return next;
    });
  }

  addChecklistSection(): void {
    this.updateChecklist((sections) => [...sections, { title: '', items: [''] }]);
  }

  removeChecklistSection(sectionIndex: number): void {
    this.updateChecklist((sections) => sections.filter((_, index) => index !== sectionIndex));
  }

  saveGeneratedTemplate(): void {
    const title = this.templateTitle().trim();
    if (!title || !this.checklistReady()) {
      this.templateSaveMessage.set('Enter a template title and complete every checklist section and point.');
      return;
    }

    try {
      const sections = this.generatedChecklist().map((section, sectionIndex) => ({
        id: `section-${sectionIndex + 1}`,
        title: section.title.trim(),
        description: '',
        displayOrder: sectionIndex + 1,
        items: section.items.map((question, itemIndex) => ({
          id: `question-${sectionIndex + 1}-${itemIndex + 1}`,
          question: question.trim(),
          instructions: '',
          responseType: 'PASS_FAIL_NA' as ChecklistResponseType,
          severity: 'MEDIUM' as ChecklistSeverity,
          acceptanceCriteria: '',
          required: true,
          photoEvidenceRequired: false,
          displayOrder: itemIndex + 1,
        })),
      }));
      this.templateService.saveGeneratedTemplate({
        title,
        description: `Reusable AI-generated checklist for ${this.inspectionForm.controls.assetType.value.trim()}.`,
        assetType: this.inspectionForm.controls.assetType.value.trim(),
        inspectionPurpose: 'General inspection',
        sections,
      });
      this.templateSaveMessage.set('Saved to the reusable checklist library.');
    } catch (error: unknown) {
      this.templateSaveMessage.set(error instanceof Error ? error.message : 'Could not save this reusable checklist.');
    }
  }

  updateTemplateTitle(event: Event): void {
    this.templateTitle.set((event.target as HTMLInputElement).value);
    this.templateSaveMessage.set('');
  }

  applyReusableTemplate(): void {
    const template = this.templateService.getTemplateById(this.selectedTemplateId());
    if (!template) {
      this.aiError.set('Select a saved checklist template first.');
      return;
    }

    this.cancelAiRequests();
    this.checklistQuestions.set([]);
    this.clearChecklistContext();
    this.generatedChecklist.set(template.sections.map((section) => ({
      title: section.title,
      items: section.items.map((item) => item.question),
    })));
    this.templateTitle.set(template.title);
    this.templateSaveMessage.set(`Using saved checklist: ${template.title}`);
    this.aiError.set('');
  }

  private updateChecklist(update: (sections: ChecklistGenerationSection[]) => ChecklistGenerationSection[]): void {
    this.generatedChecklist.update((sections) => update(sections));
    this.templateSaveMessage.set('');
  }

  private getChecklistGenerationRequest(): ChecklistGenerationRequest {
    return this.inspectionForm.getRawValue();
  }

  private clearChecklistContext(): void {
    for (const key of Object.keys(this.checklistContextForm.controls)) {
      this.checklistContextForm.removeControl(key);
    }
  }

  private getChecklistContext(): ChecklistGenerationAnswer[] {
    return this.checklistQuestions().map((question) => ({
      label: question.label,
      value: this.checklistContextForm.controls[question.key].value.trim(),
    }));
  }

  private cancelAiRequests(): void {
    this.questionsSubscription?.unsubscribe();
    this.checklistSubscription?.unsubscribe();
    this.checklistLoading.set(false);
    this.checklistGenerating.set(false);
  }

  private getAiErrorMessage(error: unknown): string {

    console.log('AI error:', error);
    if (!(error instanceof HttpErrorResponse)) {
      return 'Checklist generation failed. Please try again.';
    }
    if (error.status === 0) {
      return 'Cannot reach the AI service. Check that the backend is running.';
    }
    if (error.status === 503) {
      return 'Groq AI is not configured. Set SPRING_AI_MODEL_CHAT=openai and GROQ_API_KEY in the backend terminal, then restart the backend.';
    }
    if (error.status === 502) {
      return this.getApiErrorMessage(error) ?? 'The AI provider returned an invalid response. Please try again.';
    }
    return this.getApiErrorMessage(error) ?? 'Checklist generation failed. Please try again.';
  }

  private getApiErrorMessage(error: HttpErrorResponse): string | null {
    const body: unknown = error.error;
    if (typeof body !== 'object' || body === null || !('error' in body)) return null;
    const message = body.error;
    return typeof message === 'string' && message.trim() ? message : null;
  }

  closeOnEscape(): void {
    if (this.creating()) this.closeCreateForm();
  }
}
