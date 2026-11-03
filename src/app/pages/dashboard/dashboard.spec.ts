import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { Dashboard } from './dashboard';
import { appConfig } from '../../app.config';
import { Auth } from '../../services/auth';
import { InspectionSyncService } from '../../core/services/inspection-sync.service';
import { InspectionRecord } from '../../services/inspection';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  const outboxRecord: InspectionRecord = {
    id: 'IN-local',
    asset: 'Local generator',
    assetType: 'Generator',
    location: 'Plant room',
    inspector: 'Taylor',
    date: 'Nov 2, 2026',
    status: 'In progress',
    defects: 0,
    criticalDefects: 0,
    checklist: [{ id: 'c1', section: 'Safety', label: 'Inspect guard', result: null, comment: '', evidence: [] }],
    checklistContext: [],
  };
  const inspectionSync = {
    pendingCount: signal(1),
    state: signal('idle'),
    error: signal(null),
    remoteError: signal(null),
    remoteRecords: signal<InspectionRecord[]>([]),
    clearedLocalIds: signal<string[]>([]),
    outboxItems: signal([{ record: outboxRecord, status: 'pending' as const }]),
    syncPending: vi.fn().mockResolvedValue(undefined),
    loadEvidence: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        ...appConfig.providers,
        { provide: Auth, useValue: { firstName: signal('Taylor Morgan'), userSubject: signal(null) } },
        { provide: InspectionSyncService, useValue: inspectionSync },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the signed-in user name in the greeting', () => {
    expect(fixture.nativeElement.textContent).toContain('Welcome, Taylor Morgan');
  });

  it('does not show fabricated trend or safety metrics', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).not.toContain('12.8%');
    expect(text).not.toContain('8.2%');
    expect(text).not.toContain('94%');
    expect(text).not.toContain('Across 3 locations');
  });

  it('lists queued local inspections and lets the user sync them manually', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Inspection outbox');
    expect(text).toContain('Local generator');
    expect(text).toContain('Plant room');

    fixture.nativeElement.querySelector('.outbox-panel button').click();

    expect(inspectionSync.syncPending).toHaveBeenCalledOnce();
  });
});
