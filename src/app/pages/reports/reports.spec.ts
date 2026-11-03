import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { jsPDF } from 'jspdf';

import { Reports } from './reports';
import { appConfig } from '../../app.config';
import { Inspection, InspectionRecord } from '../../services/inspection';
import { InspectionSyncService } from '../../core/services/inspection-sync.service';

const { pdfMock } = vi.hoisted(() => {
  const instance = {
    internal: { pageSize: { getWidth: vi.fn(() => 297), getHeight: vi.fn(() => 210) } },
    addPage: vi.fn(),
    getNumberOfPages: vi.fn(() => 1),
    setPage: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setDrawColor: vi.fn(),
    setFillColor: vi.fn(),
    setLineWidth: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    text: vi.fn(),
    line: vi.fn(),
    rect: vi.fn(),
    addImage: vi.fn(),
    save: vi.fn(),
  };
  return { pdfMock: instance };
});

vi.mock('jspdf', () => ({ jsPDF: vi.fn(function () { return pdfMock; }) }));

describe('Reports', () => {
  let component: Reports;
  let fixture: ComponentFixture<Reports>;
  const record: InspectionRecord = {
    id: 'IN-report-test',
    asset: 'Primary database generator',
    assetType: 'Generator',
    location: 'Plant room',
    inspector: 'Taylor',
    date: 'Nov 2, 2026',
    status: 'Completed',
    defects: 1,
    criticalDefects: 0,
    checklist: [{
      id: 'c1',
      section: 'Safety',
      label: 'Inspect guard',
      result: 'fail',
      comment: 'Guard is loose.',
      evidence: [{ id: 'evidence-report-1', name: 'guard.png', mediaType: 'image/png' }],
    }],
    checklistContext: [],
  };
  const inspectionSync = {
    remoteRecords: signal([record]),
    remoteLoading: signal(false),
    remoteError: signal(null),
    loadEvidence: vi.fn().mockResolvedValue(new Blob(['image'], { type: 'image/png' })),
    refreshRemoteRecords: vi.fn().mockResolvedValue(undefined),
  };
  const inspection = {
    getChecklistSections: vi.fn((items: InspectionRecord['checklist']) =>
      [{ title: 'Safety', items, startIndex: 0 }]),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reports],
      providers: [
        ...appConfig.providers,
        { provide: Inspection, useValue: inspection },
        { provide: InspectionSyncService, useValue: inspectionSync },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Reports);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lists reports from the primary database records', () => {
    fixture.detectChanges();

    expect(component.records()).toEqual([record]);
    expect(fixture.nativeElement.textContent).toContain('Primary database generator');
    expect(fixture.nativeElement.textContent).toContain('Download PDF');
  });

  it('shows checklist items by section with remarks and their evidence images', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:guard-image');
    fixture.detectChanges();

    component.toggleDetails(record);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Safety');
    expect(fixture.nativeElement.textContent).toContain('Inspect guard');
    expect(fixture.nativeElement.textContent).toContain('× Fail');
    expect(fixture.nativeElement.textContent).toContain('Guard is loose.');
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src')).toBe('blob:guard-image');
  });

  it('marks unavailable evidence as not captured in the checklist table', async () => {
    inspectionSync.loadEvidence.mockResolvedValueOnce(undefined);
    fixture.detectChanges();

    component.toggleDetails(record);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Not captured');
  });

  it('uses the reference report layout, grid styling, and pale-yellow table headers', async () => {
    vi.clearAllMocks();
    inspectionSync.loadEvidence.mockResolvedValueOnce(undefined);

    await component.downloadPdf(record);

    expect(jsPDF).toHaveBeenCalledWith({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });
    expect(pdfMock.setFillColor).toHaveBeenCalledWith(255, 255, 204);
    expect(pdfMock.setDrawColor).toHaveBeenCalledWith(0, 0, 0);
    expect(pdfMock.setFont).toHaveBeenCalledWith('helvetica', 'bold');
    expect(pdfMock.text).toHaveBeenCalledWith('INSPECTION REPORT', 148.5, 27, { align: 'center' });
    expect(pdfMock.text).toHaveBeenCalledWith('PAGE 1 OF 1', 282, 204, { align: 'right' });
  });

  it('includes checklist details and primary-database evidence images in the PDF', async () => {
    vi.clearAllMocks();
    vi.stubGlobal('Image', class {
      naturalWidth = 640;
      naturalHeight = 480;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,dGVzdA==');

    try {
      await component.downloadPdf(record);

      expect(component.reportError()).toBeNull();
      expect(inspectionSync.loadEvidence).toHaveBeenCalledWith(record.id, 'evidence-report-1');
      expect(pdfMock.addImage).toHaveBeenCalledWith(
        'data:image/jpeg;base64,dGVzdA==',
        'JPEG',
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        undefined,
        'FAST',
      );
      expect(pdfMock.splitTextToSize).toHaveBeenCalledWith('Guard is loose.', 81.44);
      expect(pdfMock.line).toHaveBeenCalled();
      expect(pdfMock.text).toHaveBeenCalledWith(
        'Evidence for "Inspect guard": guard.png',
        219.92,
        expect.any(Number),
      );
      expect(pdfMock.save).toHaveBeenCalledWith('primary-database-generator-in-report-test-report.pdf');
      expect(component.reportError()).toBeNull();
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });

  it('prints dynamic pass, fail, N/A, and not-captured checklist values', async () => {
    const dynamicRecord = {
      ...record,
      checklist: [
        { ...record.checklist[0], id: 'pass', label: 'Pass item', result: 'pass' as const, evidence: [] },
        { ...record.checklist[0], id: 'fail', label: 'Fail item', result: 'fail' as const, evidence: [] },
        { ...record.checklist[0], id: 'na', label: 'N/A item', result: 'na' as const, evidence: [] },
        { ...record.checklist[0], id: 'unchecked', label: 'Unchecked item', result: null, evidence: [] },
      ],
    };

    await component.downloadPdf(dynamicRecord);

    expect(pdfMock.splitTextToSize).toHaveBeenCalledWith('PASS', 28.04);
    expect(pdfMock.splitTextToSize).toHaveBeenCalledWith('FAIL', 28.04);
    expect(pdfMock.splitTextToSize).toHaveBeenCalledWith('N/A', 28.04);
    expect(pdfMock.splitTextToSize).toHaveBeenCalledWith('Not checked', 28.04);
    expect(pdfMock.splitTextToSize).toHaveBeenCalledWith('Not captured', 60.08);
  });
});
