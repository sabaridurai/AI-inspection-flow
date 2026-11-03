import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideDynamicIcon } from '@lucide/angular';
import { Inspection } from '../../services/inspection';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, LucideDynamicIcon],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  host: {
    '(document:keydown.escape)': 'closeOnEscape()',
    '[class.navigation-open]': 'open()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  private readonly inspectionService = inject(Inspection);
  private readonly auth = inject(Auth);
  readonly open = input(false);
  readonly closeNavigation = output<void>();
  readonly inspectionCount = computed(() => this.inspectionService.records().length);
  readonly displayName = this.auth.displayName;
  readonly initials = this.auth.initials;

  closeOnEscape(): void {
    if (this.open()) {
      this.closeNavigation.emit();
    }
  }
}
