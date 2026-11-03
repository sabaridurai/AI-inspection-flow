import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideDynamicIcon } from '@lucide/angular';
import { CheckResult, Inspection, InspectionChecklistSection } from '../../services/inspection';

@Component({
  selector: 'app-inspection-details',
  imports: [DecimalPipe, RouterLink, LucideDynamicIcon],
  templateUrl: './inspection-details.html',
  styleUrl: './inspection-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectionDetails implements OnDestroy {
  readonly inspectionService = inject(Inspection);
  private readonly route = inject(ActivatedRoute);
  private readonly routeParams = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly inspectionId = computed(() => this.routeParams().get('id') ?? '');
  readonly record = computed(() => this.inspectionService.records().find((item) => item.id === this.inspectionId()));
  readonly checklistSections = computed(() => this.inspectionService.getChecklistSections(this.record()?.checklist ?? []));
  readonly activeSectionIndex = signal(0);
  private readonly resetActiveSection = effect(() => {
    this.inspectionId();
    this.activeSectionIndex.set(0);
  });
  readonly completedCount = computed(() => this.record()?.checklist.filter((item) => item.result !== null).length ?? 0);
  readonly evidenceCount = computed(() => this.record()?.checklist.reduce((total, item) => total + item.evidence.length, 0) ?? 0);
  readonly progress = computed(() => {
    const checklist = this.record()?.checklist ?? [];
    return checklist.length ? this.completedCount() / checklist.length * 100 : 0;
  });
  readonly saved = signal(false);
  readonly evidenceUrls = signal<Record<string, string>>({});
  readonly evidenceError = signal('');
  private readonly evidenceLoading = new Map<string, Promise<void>>();

  selectSection(index: number): void {
    if (index >= 0 && index < this.checklistSections().length) {
      this.activeSectionIndex.set(index);
    }
  }

  previousSection(): void {
    this.selectSection(this.activeSectionIndex() - 1);
  }

  nextSection(): void {
    this.selectSection(this.activeSectionIndex() + 1);
  }

  sectionCompletedCount(section: InspectionChecklistSection): number {
    return section.items.filter((item) => item.result !== null).length;
  }

  sectionProgress(section: InspectionChecklistSection): number {
    return section.items.length ? this.sectionCompletedCount(section) / section.items.length * 100 : 0;
  }

  onSectionKeydown(event: KeyboardEvent, index: number): void {
    const sectionCount = this.checklistSections().length;
    let nextIndex: number | undefined;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % sectionCount;
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + sectionCount) % sectionCount;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = sectionCount - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.selectSection(nextIndex);
    const tabs = (event.currentTarget as HTMLButtonElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.item(nextIndex)?.focus();
  }

  private readonly evidenceLoader = effect(() => {
    const ids = this.record()?.checklist.flatMap((item) => item.evidence.map((evidence) => evidence.id)) ?? [];
    for (const id of ids) {
      if (!(id in this.evidenceUrls()) && !this.evidenceLoading.has(id)) void this.loadEvidencePreview(id);
    }
  });

  setResult(itemId: string, result: CheckResult): void {
    this.inspectionService.updateResult(this.inspectionId(), itemId, result);
    this.saved.set(false);
  }

  updateComment(itemId: string, event: Event): void {
    this.inspectionService.updateComment(this.inspectionId(), itemId, (event.target as HTMLTextAreaElement).value);
    this.saved.set(false);
  }

  save(): void {
    this.inspectionService.save(this.inspectionId());
    this.saved.set(true);
  }

  async addEvidence(itemId: string, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.evidenceError.set('');
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        this.evidenceError.set('Choose an image file for inspection evidence.');
        continue;
      }
      try {
        await this.inspectionService.addEvidence(this.inspectionId(), itemId, file);
        this.saved.set(false);
      } catch (error: unknown) {
        this.evidenceError.set(error instanceof Error ? error.message : 'Could not save this image offline.');
      }
    }
  }

  async removeEvidence(itemId: string, evidenceId: string): Promise<void> {
    this.evidenceError.set('');
    try {
      await this.inspectionService.removeEvidence(this.inspectionId(), itemId, evidenceId);
      const url = this.evidenceUrls()[evidenceId];
      if (url) URL.revokeObjectURL(url);
      this.evidenceUrls.update((urls) => {
        const next = { ...urls };
        delete next[evidenceId];
        return next;
      });
      this.saved.set(false);
    } catch (error: unknown) {
      this.evidenceError.set(error instanceof Error ? error.message : 'Could not remove this image.');
    }
  }

  async printPdf(): Promise<void> {
    const ids = this.record()?.checklist.flatMap((item) => item.evidence.map((evidence) => evidence.id)) ?? [];
    await Promise.all(ids.map((id) => this.loadEvidencePreview(id)));
    globalThis.print();
  }

  ngOnDestroy(): void {
    for (const url of Object.values(this.evidenceUrls())) URL.revokeObjectURL(url);
    this.evidenceLoader.destroy();
  }

  private loadEvidencePreview(id: string): Promise<void> {
    if (id in this.evidenceUrls()) return Promise.resolve();
    const existingLoad = this.evidenceLoading.get(id);
    if (existingLoad) return existingLoad;

    const load = this.loadEvidenceBlob(id);
    this.evidenceLoading.set(id, load);
    return load;
  }

  private async loadEvidenceBlob(id: string): Promise<void> {
    try {
      const blob = await this.inspectionService.getEvidence(id);
      if (!blob) {
        this.evidenceError.set('An attached image could not be found in offline storage.');
        return;
      }
      this.evidenceUrls.update((urls) => ({ ...urls, [id]: URL.createObjectURL(blob) }));
    } catch (error: unknown) {
      this.evidenceError.set(error instanceof Error ? error.message : 'Could not load an image from offline storage.');
    } finally {
      this.evidenceLoading.delete(id);
    }
  }
}
