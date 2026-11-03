import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ApplicationDataService } from './core/services/application-data.service';
import { InspectionSyncService } from './core/services/inspection-sync.service';
import { Header } from './layout/header/header';
import { Sidebar } from './layout/sidebar/sidebar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Sidebar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly applicationData = inject(ApplicationDataService);
  private readonly inspectionSync = inject(InspectionSyncService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly navigationOpen = signal(false);
  readonly isLoginPage = signal(false);
  readonly storageError = this.applicationData.storageError.asReadonly();
  readonly syncState = this.inspectionSync.state.asReadonly();
  readonly pendingSyncCount = this.inspectionSync.pendingCount.asReadonly();
  readonly syncError = this.inspectionSync.error.asReadonly();

  constructor() {
    const updateLayout = (): void => {
      this.isLoginPage.set(this.router.routerState.snapshot.root.firstChild?.data['layout'] === 'auth');
    };

    updateLayout();
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(updateLayout);
  }

  toggleNavigation(): void {
    this.navigationOpen.update((open) => !open);
  }

  closeNavigation(): void {
    this.navigationOpen.set(false);
  }
}
