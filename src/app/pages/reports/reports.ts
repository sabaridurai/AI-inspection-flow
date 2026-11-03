import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { jsPDF } from 'jspdf';
import { CheckResult, Inspection, InspectionRecord } from '../../services/inspection';
import { InspectionSyncService } from '../../core/services/inspection-sync.service';

const PAGE_MARGIN = 15;
const PAGE_TOP = 19;
const PAGE_BOTTOM = 17;
const TABLE_HEADER_FILL: [number, number, number] = [255, 255, 204];
const SECTION_BLUE: [number, number, number] = [95, 131, 248];
const SECTION_GREEN: [number, number, number] = [16, 84, 42];
const GRID_COLOR: [number, number, number] = [0, 0, 0];
const INK_COLOR: [number, number, number] = [30, 30, 30];

@Component({
  selector: 'app-reports',
  imports: [LucideDynamicIcon],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Reports implements OnDestroy {
  private readonly inspectionService = inject(Inspection);
  readonly inspectionSync = inject(InspectionSyncService);
  readonly records = this.inspectionSync.remoteRecords.asReadonly();
  readonly generatingId = signal<string | null>(null);
  readonly reportError = signal<string | null>(null);
  readonly expandedRecordId = signal<string | null>(null);
  readonly evidenceUrls = signal<Record<string, string>>({});
  readonly evidenceStates = signal<Record<string, 'loading' | 'ready' | 'missing'>>({});
  private readonly evidenceLoads = new Map<string, Promise<void>>();

  refresh(): void {
    void this.inspectionSync.refreshRemoteRecords();
  }

  checklistSections(record: InspectionRecord) {
    return this.inspectionService.getChecklistSections(record.checklist);
  }

  toggleDetails(record: InspectionRecord): void {
    if (this.expandedRecordId() === record.id) {
      this.expandedRecordId.set(null);
      return;
    }

    this.expandedRecordId.set(record.id);
    for (const item of record.checklist) {
      for (const evidence of item.evidence) void this.loadEvidencePreview(record.id, evidence.id);
    }
  }

  resultLabel(result: CheckResult): string {
    if (result === 'pass') return '✓ Pass';
    if (result === 'fail') return '× Fail';
    if (result === 'na') return 'N/A';
    return 'Not checked';
  }

  ngOnDestroy(): void {
    for (const url of Object.values(this.evidenceUrls())) URL.revokeObjectURL(url);
  }

  evidenceCount(record: InspectionRecord): number {
    return record.checklist.reduce((total, item) => total + item.evidence.length, 0);
  }


async downloadPdf(record: InspectionRecord): Promise<void> {
  if (this.generatingId()) return;

  this.generatingId.set(record.id);
  this.reportError.set(null);

  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 17;
    const contentWidth = pageWidth - margin * 2;
    const bottomLimit = pageHeight - 19;

    const navy: [number, number, number] = [31, 52, 78];
    const green: [number, number, number] = [48, 105, 78];
    const muted: [number, number, number] = [105, 119, 137];
    const border: [number, number, number] = [218, 225, 233];
    const light: [number, number, number] = [245, 247, 250];
    const red: [number, number, number] = [174, 65, 61];
    const amber: [number, number, number] = [157, 116, 48];

    const sections = this.inspectionService.getChecklistSections(record.checklist);

    const preparedEvidence = new Map<
      string,
      { dataUrl: string; width: number; height: number } | null
    >();

    await Promise.all(
      record.checklist.flatMap((item) =>
        item.evidence.map(async (evidence) => {
          try {
            const blob = await this.inspectionSync.loadEvidence(
              record.id,
              evidence.id
            );

            preparedEvidence.set(
              evidence.id,
              blob ? await this.toJpegDataUrl(blob) : null
            );
          } catch {
            preparedEvidence.set(evidence.id, null);
          }
        })
      )
    );

    let y = 0;

    const setFont = (size: number, bold = false): void => {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setFontSize(size);
    };

    const drawText = (
      value: string,
      x: number,
      top: number,
      width: number,
      size = 8,
      color: [number, number, number] = navy,
      bold = false
    ): number => {
      setFont(size, bold);
      pdf.setTextColor(...color);

      const lines = pdf.splitTextToSize(value || '—', width) as string[];
      const lineHeight = size * 0.48 + 1.2;

      pdf.text(lines, x, top + size * 0.35 + 1);

      return lines.length * lineHeight;
    };

    const drawHeader = (sectionName = 'INSPECTION REPORT'): void => {
      pdf.setFillColor(...navy);
      pdf.rect(0, 0, pageWidth, 2, 'F');

      setFont(8, true);
      pdf.setTextColor(...navy);
      pdf.text('AI INSPECTION', margin, 10);

      setFont(7);
      pdf.setTextColor(...muted);
      pdf.text(sectionName.toUpperCase(), pageWidth - margin, 10, {
        align: 'right',
      });

      pdf.setDrawColor(...border);
      pdf.setLineWidth(0.25);
      pdf.line(margin, 14, pageWidth - margin, 14);

      y = 22;
    };

    const drawFooter = (page: number, total: number): void => {
      pdf.setDrawColor(...border);
      pdf.setLineWidth(0.25);
      pdf.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);

      setFont(7);
      pdf.setTextColor(...muted);
      pdf.text(`Inspection ID: ${record.id}`, margin, pageHeight - 7);
      pdf.text(
        'CONFIDENTIAL INSPECTION REPORT',
        pageWidth / 2,
        pageHeight - 7,
        { align: 'center' }
      );
      pdf.text(`PAGE ${page} OF ${total}`, pageWidth - margin, pageHeight - 7, {
        align: 'right',
      });
    };

    const drawSectionTitle = (title: string): void => {
      pdf.setFillColor(...green);
      pdf.rect(margin, y, 1.2, 8, 'F');

      setFont(12, true);
      pdf.setTextColor(...navy);
      pdf.text(title.toUpperCase(), margin + 5, y + 5.5);

      y += 13;
    };

    const drawInfoCard = (
      label: string,
      value: string,
      x: number,
      top: number,
      width: number,
      height = 17
    ): void => {
      pdf.setFillColor(...light);
      pdf.setDrawColor(...border);
      pdf.setLineWidth(0.2);
      pdf.roundedRect(x, top, width, height, 1.5, 1.5, 'FD');

      setFont(6.5, true);
      pdf.setTextColor(...muted);
      pdf.text(label.toUpperCase(), x + 3, top + 5);

      setFont(9, true);
      pdf.setTextColor(...navy);

      const lines = pdf.splitTextToSize(value || '—', width - 6) as string[];
      pdf.text(lines.slice(0, 2), x + 3, top + 11);
    };

    const drawCell = (
      value: string,
      x: number,
      top: number,
      width: number,
      height: number,
      options: {
        fill?: [number, number, number];
        color?: [number, number, number];
        bold?: boolean;
        align?: 'left' | 'center';
        fontSize?: number;
      } = {}
    ): void => {
      pdf.setFillColor(...(options.fill ?? [255, 255, 255]));
      pdf.setDrawColor(...border);
      pdf.setLineWidth(0.2);
      pdf.rect(x, top, width, height, 'FD');

      setFont(options.fontSize ?? 7.5, options.bold ?? false);
      pdf.setTextColor(...(options.color ?? navy));

      const lines = pdf.splitTextToSize(value || '—', width - 5) as string[];
      const lineHeight = 3.6;
      const textHeight = lines.length * lineHeight;
      const textY = top + Math.max(3.5, (height - textHeight) / 2 + 2.5);

      if (options.align === 'center') {
        pdf.text(lines, x + width / 2, textY, { align: 'center' });
      } else {
        pdf.text(lines, x + 2.5, textY);
      }
    };

    const addContentPage = (sectionName: string): void => {
      pdf.addPage();
      drawHeader(sectionName);
    };

    const addDetailPage = (sectionName: string): void => {
      addContentPage(sectionName);
      drawSectionTitle(`${sectionName} — Continued`);
      drawChecklistHeader();
    };

    const columnWidths = [
      contentWidth * 0.34,
      contentWidth * 0.12,
      contentWidth * 0.28,
      contentWidth * 0.26,
    ];

    const drawChecklistHeader = (): void => {
      const labels = ['DESCRIPTION', 'RESULT', 'REMARKS', 'EVIDENCE'];
      let x = margin;

      labels.forEach((label, index) => {
        drawCell(label, x, y, columnWidths[index], 8, {
          fill: navy,
          color: [255, 255, 255],
          bold: true,
          fontSize: 7,
          align: index === 1 ? 'center' : 'left',
        });

        x += columnWidths[index];
      });

      y += 8;
    };

    // ========================================================
    // PAGE 1 — COVER PAGE
    // ========================================================

    pdf.setFillColor(...navy);
    pdf.rect(0, 0, pageWidth, 48, 'F');

    pdf.setFillColor(...green);
    pdf.rect(0, 48, pageWidth, 2, 'F');

    setFont(9, true);
    pdf.setTextColor(220, 230, 239);
    pdf.text('AI INSPECTION PLATFORM', margin, 16);

    setFont(25, true);
    pdf.setTextColor(255, 255, 255);
    pdf.text('INSPECTION REPORT', margin, 31);

    setFont(10);
    pdf.setTextColor(222, 231, 239);
    pdf.text('Inspection record and findings', margin, 39);

    y = 65;

    setFont(9, true);
    pdf.setTextColor(...muted);
    pdf.text('ASSET / EQUIPMENT', margin, y);

    setFont(22, true);
    pdf.setTextColor(...navy);
    const assetLines = pdf.splitTextToSize(record.asset, contentWidth) as string[];
    pdf.text(assetLines, margin, y + 11);

    y += Math.max(25, assetLines.length * 9 + 12);

    pdf.setDrawColor(...border);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 12;

    drawSectionTitle('Inspection information');

    const info = [
      ['INSPECTION ID', record.id],
      ['ASSET TYPE', record.assetType],
      ['LOCATION', record.location],
      ['INSPECTOR', record.inspector],
      ['INSPECTION DATE', record.date],
      ['INSPECTION STATUS', record.status],
    ];

    const gap = 4;
    const cardWidth = (contentWidth - gap * 2) / 3;

    info.forEach(([label, value], index) => {
      const row = Math.floor(index / 3);
      const column = index % 3;

      drawInfoCard(
        label,
        value,
        margin + column * (cardWidth + gap),
        y + row * 23,
        cardWidth,
        19
      );
    });

    y += 55;

    drawSectionTitle('Report overview');

    const summaryWidth = (contentWidth - gap * 3) / 4;

    const summaryItems = [
      ['CHECKLIST ITEMS', String(record.checklist.length)],
      ['DEFECTS', String(record.defects)],
      ['CRITICAL DEFECTS', String(record.criticalDefects)],
      ['EVIDENCE PHOTOS', String(this.evidenceCount(record))],
    ];

    summaryItems.forEach(([label, value], index) => {
      const x = margin + index * (summaryWidth + gap);

      drawInfoCard(label, value, x, y, summaryWidth, 22);
    });

    setFont(7);
    pdf.setTextColor(...muted);
    pdf.text(
      'This report contains inspection information, checklist results, remarks and available evidence.',
      margin,
      pageHeight - 18
    );

    // ========================================================
    // PAGE 2 — REPORT INDEX
    // ========================================================

    addContentPage('Report contents');

    drawSectionTitle('Report contents');

    const indexItems = [
      '01   Inspection overview',
      '02   Inspection information',
      '03   Inspection summary',
      ...sections.map(
        (section, index) =>
          `${String(index + 4).padStart(2, '0')}   ${section.title} — Detailed checklist`
      ),
      `${String(sections.length + 4).padStart(2, '0')}   Supporting evidence`,
    ];

    const indexX = margin + 5;
    const indexWidth = contentWidth - 10;

    indexItems.forEach((item, index) => {
      const rowHeight = 12;

      if (y + rowHeight > bottomLimit) {
        addContentPage('Report contents');
      }

      pdf.setFillColor(index % 2 === 0 ? 247 : 255, index % 2 === 0 ? 249 : 255, index % 2 === 0 ? 251 : 255);
      pdf.setDrawColor(...border);
      pdf.roundedRect(indexX, y, indexWidth, rowHeight, 1, 1, 'FD');

      setFont(8.5, index < 3);
      pdf.setTextColor(...navy);
      pdf.text(item, indexX + 5, y + 7.5);

      y += rowHeight + 3;
    });

    // ========================================================
    // PAGE 3 — EXECUTIVE SUMMARY
    // ========================================================

    addContentPage('Executive summary');

    drawSectionTitle('Executive summary');

    const summaryCards = [
      { label: 'TOTAL CHECKLIST ITEMS', value: record.checklist.length, color: navy },
      { label: 'PASSED ITEMS', value: record.checklist.filter((i) => i.result === 'pass').length, color: green },
      { label: 'FAILED ITEMS', value: record.checklist.filter((i) => i.result === 'fail').length, color: red },
      { label: 'NOT CHECKED', value: record.checklist.filter((i) => i.result === null).length, color: amber },
    ];

    summaryCards.forEach((card, index) => {
      const width = (contentWidth - gap * 3) / 4;
      const x = margin + index * (width + gap);

      pdf.setFillColor(...light);
      pdf.setDrawColor(...border);
      pdf.roundedRect(x, y, width, 24, 1.5, 1.5, 'FD');

      setFont(7, true);
      pdf.setTextColor(...muted);
      pdf.text(card.label, x + 3, y + 7);

      setFont(17, true);
      pdf.setTextColor(...card.color);
      pdf.text(String(card.value), x + 3, y + 18);
    });

    y += 34;

    drawSectionTitle('Inspection details');

    const details = [
      ['Asset', record.asset],
      ['Asset type', record.assetType],
      ['Inspection ID', record.id],
      ['Location', record.location],
      ['Inspector', record.inspector],
      ['Date', record.date],
      ['Status', record.status],
    ];

    const detailLabelWidth = 42;
    const detailValueWidth = contentWidth - detailLabelWidth;

    details.forEach(([label, value]) => {
      const lines = pdf.splitTextToSize(value || '—', detailValueWidth - 6) as string[];
      const height = Math.max(9, lines.length * 3.7 + 4);

      drawCell(label.toUpperCase(), margin, y, detailLabelWidth, height, {
        fill: light,
        bold: true,
        fontSize: 7,
        color: muted,
      });

      drawCell(value, margin + detailLabelWidth, y, detailValueWidth, height, {
        fontSize: 8,
      });

      y += height;
    });

    y += 8;

    drawSectionTitle('Result distribution');

    const total = Math.max(record.checklist.length, 1);
    const passCount = record.checklist.filter((i) => i.result === 'pass').length;
    const failCount = record.checklist.filter((i) => i.result === 'fail').length;
    const naCount = record.checklist.filter((i) => i.result === 'na').length;
    const uncheckedCount = record.checklist.filter((i) => i.result === null).length;

    const barX = margin;
    const barY = y;
    const barWidth = contentWidth;
    const barHeight = 9;

    const resultParts = [
      { value: passCount, color: green },
      { value: failCount, color: red },
      { value: naCount, color: [137, 149, 164] as [number, number, number] },
      { value: uncheckedCount, color: [213, 176, 105] as [number, number, number] },
    ];

    let barOffset = 0;

    resultParts.forEach((part) => {
      const width = (part.value / total) * barWidth;

      if (width > 0) {
        pdf.setFillColor(...part.color);
        pdf.rect(barX + barOffset, barY, width, barHeight, 'F');
        barOffset += width;
      }
    });

    y += 16;

    const legend = [
      ['Pass', passCount, green],
      ['Fail', failCount, red],
      ['N/A', naCount, [137, 149, 164] as [number, number, number]],
      ['Not checked', uncheckedCount, [213, 176, 105] as [number, number, number]],
    ] as const;

    let legendX = margin;

    legend.forEach(([label, value, color]) => {
      pdf.setFillColor(...color);
      pdf.circle(legendX + 1.5, y, 1.5, 'F');

      setFont(7);
      pdf.setTextColor(...muted);
      pdf.text(`${label}: ${value}`, legendX + 5, y + 1);

      legendX += 48;
    });

    // ========================================================
    // CHECKLIST DETAIL PAGES
    // ========================================================

    for (const section of sections) {
      addContentPage('Detailed inspection findings');

      drawSectionTitle(section.title);
      drawChecklistHeader();

      let rowIndex = 0;

      for (const item of section.items) {
        const availableEvidence = item.evidence.filter((evidence) =>
          preparedEvidence.get(evidence.id)
        );

        const missingCount = item.evidence.length - availableEvidence.length;

        const evidenceText = [
          ...availableEvidence.map((evidence) => evidence.name),
          ...(missingCount ? [`${missingCount} unavailable`] : []),
          ...(!item.evidence.length ? ['Not captured'] : []),
        ].join(', ');

        const cells = [
          item.label,
          this.pdfResultLabel(item.result),
          item.comment.trim() || '—',
          evidenceText,
        ];

        const wrapped = cells.map((text, index) =>
          pdf.splitTextToSize(text, columnWidths[index] - 5) as string[]
        );

        const rowHeight = Math.max(
          11,
          ...wrapped.map((lines) => lines.length * 3.6 + 5)
        );

        if (y + rowHeight > bottomLimit) {
          addDetailPage(section.title);
        }

        let x = margin;

        wrapped.forEach((lines, index) => {
          const fill: [number, number, number] =
            rowIndex % 2 === 0 ? [255, 255, 255] : light;

          let textColor: [number, number, number] = navy;

          if (index === 1 && item.result === 'pass') textColor = green;
          if (index === 1 && item.result === 'fail') textColor = red;
          if (index === 1 && item.result === 'na') textColor = muted;

          drawCell(lines.join('\n'), x, y, columnWidths[index], rowHeight, {
            fill,
            color: textColor,
            bold: index === 1,
            align: index === 1 ? 'center' : 'left',
            fontSize: 7.5,
          });

          x += columnWidths[index];
        });

        y += rowHeight;
        rowIndex++;

        // Evidence photographs appear below their checklist item.
        for (const evidence of availableEvidence) {
          const image = preparedEvidence.get(evidence.id);
          if (!image) continue;

          const imageWidth = Math.min(52, columnWidths[3] - 10);
          const imageHeight = Math.min(
            36,
            imageWidth * (image.height / image.width)
          );

          const blockHeight = imageHeight + 13;

          if (y + blockHeight > bottomLimit) {
            addDetailPage(section.title);
          }

          const imageX =
            margin +
            columnWidths[0] +
            columnWidths[1] +
            columnWidths[2] +
            3;

          setFont(7, true);
          pdf.setTextColor(...muted);
          pdf.text(
            `EVIDENCE: ${evidence.name}`,
            imageX,
            y + 3
          );

          pdf.setDrawColor(...border);
          pdf.rect(imageX, y + 5, imageWidth + 2, imageHeight + 2);

          pdf.addImage(
            image.dataUrl,
            'JPEG',
            imageX + 1,
            y + 6,
            imageWidth,
            imageHeight,
            undefined,
            'FAST'
          );

          y += blockHeight;
        }
      }

      y += 7;
    }

    // ========================================================
    // SUPPORTING EVIDENCE SUMMARY
    // ========================================================

    const allEvidence = record.checklist.flatMap((item) =>
      item.evidence.map((evidence) => ({
        evidence,
        itemLabel: item.label,
      }))
    );

    if (allEvidence.length) {
      addContentPage('Supporting evidence');
      drawSectionTitle('Supporting evidence');

      for (const entry of allEvidence) {
        const image = preparedEvidence.get(entry.evidence.id);

        if (!image) continue;

        const imageWidth = 55;
        const imageHeight = Math.min(
          38,
          imageWidth * (image.height / image.width)
        );

        if (y + imageHeight + 17 > bottomLimit) {
          addContentPage('Supporting evidence');
          drawSectionTitle('Supporting evidence — Continued');
        }

        setFont(8, true);
        pdf.setTextColor(...navy);
        pdf.text(entry.itemLabel, margin, y + 3);

        setFont(7);
        pdf.setTextColor(...muted);
        pdf.text(entry.evidence.name, margin, y + 8);

        pdf.setDrawColor(...border);
        pdf.rect(margin, y + 11, imageWidth + 2, imageHeight + 2);

        pdf.addImage(
          image.dataUrl,
          'JPEG',
          margin + 1,
          y + 12,
          imageWidth,
          imageHeight,
          undefined,
          'FAST'
        );

        y += imageHeight + 19;
      }
    }

    // ========================================================
    // PAGE NUMBERS AND FOOTERS
    // ========================================================

    const totalPages = pdf.getNumberOfPages();

    for (let page = 1; page <= totalPages; page++) {
      pdf.setPage(page);

      if (page > 1) {
        drawFooter(page, totalPages);
      } else {
        pdf.setDrawColor(...border);
        pdf.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);

        setFont(7);
        pdf.setTextColor(...muted);
        pdf.text(`Inspection ID: ${record.id}`, margin, pageHeight - 7);
        pdf.text(
          `PAGE ${page} OF ${totalPages}`,
          pageWidth - margin,
          pageHeight - 7,
          { align: 'right' }
        );
      }
    }

    pdf.save(
      `${this.fileName(record.asset)}-${record.id.toLowerCase()}-report.pdf`
    );
  } catch (error: unknown) {
    this.reportError.set(
      error instanceof Error
        ? error.message
        : 'Could not generate the PDF report.'
    );
  } finally {
    this.generatingId.set(null);
  }
}


  private fileName(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'inspection';
  }

  private pdfResultLabel(result: CheckResult): string {
    if (result === 'pass') return 'PASS';
    if (result === 'fail') return 'FAIL';
    if (result === 'na') return 'N/A';
    return 'Not checked';
  }

  private async toJpegDataUrl(blob: Blob): Promise<{ dataUrl: string; width: number; height: number }> {
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('An inspection evidence image could not be decoded for the PDF.'));
        image.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image processing is unavailable in this browser.');
      if (!image.naturalWidth || !image.naturalHeight) {
        throw new Error('An inspection evidence image has invalid dimensions and cannot be added to the PDF.');
      }
      context.drawImage(image, 0, 0);
      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.88),
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private loadEvidencePreview(inspectionId: string, evidenceId: string): Promise<void> {
    if (this.evidenceStates()[evidenceId] === 'ready' || this.evidenceStates()[evidenceId] === 'missing') {
      return Promise.resolve();
    }
    const existing = this.evidenceLoads.get(evidenceId);
    if (existing) return existing;

    this.evidenceStates.update((states) => ({ ...states, [evidenceId]: 'loading' }));
    const load = this.inspectionSync.loadEvidence(inspectionId, evidenceId)
      .then((blob) => {
        if (!blob) {
          this.evidenceStates.update((states) => ({ ...states, [evidenceId]: 'missing' }));
          return;
        }
        this.evidenceUrls.update((urls) => ({ ...urls, [evidenceId]: URL.createObjectURL(blob) }));
        this.evidenceStates.update((states) => ({ ...states, [evidenceId]: 'ready' }));
      })
      .catch(() => {
        this.evidenceStates.update((states) => ({ ...states, [evidenceId]: 'missing' }));
      })
      .finally(() => this.evidenceLoads.delete(evidenceId));
    this.evidenceLoads.set(evidenceId, load);
    return load;
  }
}
