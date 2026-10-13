/**
 * PDF Generator
 * Handles PDF document creation from canvas
 */

import jsPDF from 'jspdf';
import { planPages, CUT_PAD } from './paginate';
import { PDFLayout } from './types';

export interface PDFConfig {
  orientation: 'portrait' | 'landscape';
  format: 'a4' | 'letter';
  margin: number;
  quality: number;
}

/** Space under the table reserved for the page number, in mm */
const FOOTER_HEIGHT = 6;

export class PDFGenerator {
  private pdf: jsPDF;
  private config: PDFConfig;

  constructor(config: Partial<PDFConfig> = {}) {
    this.config = {
      orientation: config.orientation || 'landscape',
      format: config.format || 'a4',
      margin: config.margin ?? 8,
      quality: config.quality || 1.0,
    };

    this.pdf = new jsPDF({
      orientation: this.config.orientation,
      unit: 'mm',
      format: this.config.format,
      compress: true,
    });
  }

  /**
   * Add the rendered table: scaled to the page width, cut between rows, header repeated on
   * every page after the first, page number "n / N" at the bottom center.
   */
  addCanvas(canvas: HTMLCanvasElement, layout: PDFLayout): void {
    const pageWidth = this.pdf.internal.pageSize.getWidth();
    const pageHeight = this.pdf.internal.pageSize.getHeight();
    const { margin, quality } = this.config;

    const availableWidth = pageWidth - 2 * margin;
    const availableHeight = pageHeight - 2 * margin - FOOTER_HEIGHT;

    const mmPerPx = availableWidth / layout.width; // mm per CSS px of the rendered table
    const pxY = canvas.height / layout.height; // canvas px per CSS px

    const slices = planPages(layout, availableHeight / mmPerPx);
    const header = layout.header;

    slices.forEach((slice, index) => {
      if (index > 0) this.pdf.addPage();

      // Source ranges in canvas px. A page that is cut also shows the grid line below the cut;
      // a continuation page starts 1px lower because the repeated header already ends with that line.
      const bodyTop = slice.start + (slice.header ? CUT_PAD : 0);
      const bodyBottom = Math.min(slice.end + (slice.end < layout.height ? CUT_PAD : 0), layout.height);
      const bodyY = Math.round(bodyTop * pxY);
      const bodyH = Math.max(Math.round(bodyBottom * pxY) - bodyY, 1);

      let headerY = 0;
      let headerH = 0;
      if (slice.header && header) {
        headerY = Math.round(header.top * pxY);
        headerH = Math.min(Math.round((header.bottom + CUT_PAD) * pxY), canvas.height) - headerY;
      }

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = headerH + bodyH;
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      if (headerH > 0) {
        ctx.drawImage(canvas, 0, headerY, canvas.width, headerH, 0, 0, canvas.width, headerH);
      }
      ctx.drawImage(canvas, 0, bodyY, canvas.width, bodyH, 0, headerH, canvas.width, bodyH);

      const imageHeight = pageCanvas.height * (availableWidth / pageCanvas.width);
      const imgData = pageCanvas.toDataURL('image/png', quality);
      this.pdf.addImage(imgData, 'PNG', margin, margin, availableWidth, imageHeight, undefined, 'FAST');

      this.pdf.setFontSize(8);
      this.pdf.setTextColor(90);
      this.pdf.text(`${index + 1} / ${slices.length}`, pageWidth / 2, pageHeight - margin - 1.5, {
        align: 'center',
      });
    });
  }

  /**
   * Save PDF to file
   */
  save(fileName: string): void {
    this.pdf.save(fileName);
  }
}
