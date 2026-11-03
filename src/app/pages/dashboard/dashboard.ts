import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { Inspection, InspectionRecord } from '../../services/inspection';
import { Auth } from '../../services/auth';
import { InspectionSyncService } from '../../core/services/inspection-sync.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, LucideDynamicIcon],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly inspectionService = inject(Inspection);
  private readonly auth = inject(Auth);
  readonly inspectionSync = inject(InspectionSyncService);
  readonly firstName = this.auth.firstName;
  readonly records = this.inspectionService.records;
  readonly total = computed(() => this.records().length);
  readonly completed = computed(() => this.records().filter((record) => record.status === 'Completed').length);
  readonly pending = computed(() => this.records().filter((record) => record.status === 'Scheduled' || record.status === 'In progress').length);
  readonly critical = computed(() => this.records().reduce((sum, record) => sum + record.criticalDefects, 0));
  readonly attentionRecords = computed(() => this.records().filter((record) => record.defects > 0));
  readonly locationCount = computed(() => new Set(this.records().map((record) => record.location.trim()).filter(Boolean)).size);

  syncOutbox(): void {
    void this.inspectionSync.syncPending();
  }

  evidenceCount(record: InspectionRecord): number {
    return record.checklist.reduce((total, item) => total + item.evidence.length, 0);
  }
}
