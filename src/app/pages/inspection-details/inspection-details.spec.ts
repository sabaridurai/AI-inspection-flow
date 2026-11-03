import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { InspectionDetails } from './inspection-details';
import { appConfig } from '../../app.config';
import { InspectionRecord } from '../../services/inspection';

describe('InspectionDetails', () => {
  let component: InspectionDetails;
  let fixture: ComponentFixture<InspectionDetails>;
  const inspection: InspectionRecord = {
    id: 'IN-TEST',
    asset: 'Test vehicle',
    assetType: 'Vehicle',
    location: 'Test location',
    inspector: 'Test inspector',
    date: 'Nov 2, 2026',
    status: 'In progress',
    defects: 0,
    criticalDefects: 0,
    checklist: [
      { id: 'c1', section: 'Engine', label: 'Check engine', result: null, comment: '', evidence: [] },
      { id: 'c2', section: 'Brakes', label: 'Check brakes', result: null, comment: '', evidence: [] },
    ],
    checklistContext: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InspectionDetails],
      providers: appConfig.providers,
    })
    .overrideProvider(ActivatedRoute, {
      useValue: {
        paramMap: of(convertToParamMap({ id: inspection.id })),
        snapshot: { paramMap: convertToParamMap({ id: inspection.id }) },
      },
    })
    .compileComponents();

    fixture = TestBed.createComponent(InspectionDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
    component.inspectionService.records.set([inspection]);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows one checklist section at a time and switches sections from the tabs', () => {
    let activePanels = fixture.nativeElement.querySelectorAll('.checklist-group:not([hidden])');
    expect(activePanels.length).toBe(1);
    expect(activePanels[0].textContent).toContain('Check engine');

    fixture.nativeElement.querySelectorAll('.section-tab')[1].click();
    fixture.detectChanges();

    activePanels = fixture.nativeElement.querySelectorAll('.checklist-group:not([hidden])');
    expect(activePanels.length).toBe(1);
    expect(activePanels[0].textContent).toContain('Check brakes');
  });

  it('navigates between sections without passing the first or last section', () => {
    component.previousSection();
    expect(component.activeSectionIndex()).toBe(0);

    component.nextSection();
    expect(component.activeSectionIndex()).toBe(1);
    component.nextSection();
    expect(component.activeSectionIndex()).toBe(1);

    component.selectSection(0);
    expect(component.activeSectionIndex()).toBe(0);
  });

  it('updates section completion counts and progress after recording a result', () => {
    component.setResult('c1', 'pass');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.section-tab small').textContent.trim()).toBe('1/1');
    expect(fixture.nativeElement.querySelector('.section-progress').textContent.trim()).toBe('100%');
  });

  it('supports arrow-key navigation between section tabs', () => {
    const firstTab = fixture.nativeElement.querySelector('.section-tab');
    firstTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    expect(component.activeSectionIndex()).toBe(1);
    expect(fixture.nativeElement.ownerDocument.activeElement).toBe(fixture.nativeElement.querySelectorAll('.section-tab')[1]);
  });
});
