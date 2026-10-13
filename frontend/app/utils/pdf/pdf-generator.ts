/**
 * PDF Generator
 * Composes each page from slices of the one rendered canvas: a row range (with the header
 * repeated) and a column range (identifying columns plus the page's column groups).
 */

import jsPDF from 'jspdf';
import { CUT_PAD } from './paginate';
import { PDFFormat, PDFMeasure, PDFPlan } from './types';

export interface PDFConfig {
  format: PDFFormat;
  /** mm */
  margin: number;
}

/** PNG is lossless and best for text; above this size a JPEG is used to keep the file small */
const MAX_PNG_BYTES = 6 * 1024 * 1024;
const JPEG_QUALITY = 0.92;
/** Half the width of the 3px .grp-l / .grp-r line, which is centered on a column boundary */
const SEPARATOR_HALF = 1.5;

/** A source range in CSS px of the rendered table */
interface Piece {
  from: number;
  to: number;
  /** The title row: shown over the page's own width instead of cropped by columns */
  title?: boolean;
}

function encode(canvas: HTMLCanvasElement): { data: string; format: 'PNG' | 'JPEG' } {
  const png = canvas.toDataURL('image/png');
  // base64 is 4 chars per 3 bytes
  if (png.length * 0.75 <= MAX_PNG_BYTES) return { data: png, format: 'PNG' };
  return { data: canvas.toDataURL('image/jpeg', JPEG_QUALITY), format: 'JPEG' };
}

export class PDFGenerator {
  private pdf: jsPDF;
  private config: PDFConfig;

  constructor(plan: PDFPlan, config: PDFConfig) {
    this.config = config;
    this.pdf = new jsPDF({
      orientation: plan.orientation,
      unit: 'mm',
      format: config.format,
      compress: true,
    });
  }

  /**
   * Row ranges of one page. The first page runs from the top (title and header included). Later
   * pages repeat the header; the title stays on the first page only.
   * A cut shows the grid line below it; a continuation page starts 1px lower because the
   * repeated header already ends with that line.
   */
  private rowPieces(measure: PDFMeasure, start: number, end: number, first: boolean, splitColumns: boolean): Piece[] {
    const { header, title, height } = measure;
    const bottom = end < height ? end + CUT_PAD : end;
    if (first) {
      // Over several column pages the title cell is wider than the page, so it is drawn on its own
      if (splitColumns && title) {
        return [
          { from: title.top, to: title.bottom, title: true },
          { from: title.bottom, to: bottom },
        ];
      }
      return [{ from: start, to: bottom }];
    }
    const bodyStart = Math.max(start, header?.bottom ?? title?.bottom ?? 0);
    const pieces: Piece[] = [];
    if (header) pieces.push({ from: header.top, to: header.bottom + CUT_PAD });
    pieces.push({ from: bodyStart + CUT_PAD, to: bottom });
    return pieces;
  }

  /** Column ranges of one page: everything left of the first group, then the page's groups side by side */
  private columnPieces(measure: PDFMeasure, units: PDFMeasure['units'], splitColumns: boolean): Piece[] {
    if (!splitColumns) return [{ from: 0, to: measure.width }];
    // Each piece starts with its own full separator line; the last one also closes the table
    const pieces: Piece[] = [{ from: 0, to: measure.units[0].left - SEPARATOR_HALF }];
    units.forEach((unit, i) => {
      const last = i === units.length - 1;
      pieces.push({
        from: unit.left - SEPARATOR_HALF,
        to: last ? Math.min(unit.right + SEPARATOR_HALF, measure.width) : unit.right - SEPARATOR_HALF,
      });
    });
    return pieces;
  }

  /** Add the rendered table, split as the plan says */
  addCanvas(canvas: HTMLCanvasElement, measure: PDFMeasure, plan: PDFPlan): void {
    const pageWidth = this.pdf.internal.pageSize.getWidth();
    const pageHeight = this.pdf.internal.pageSize.getHeight();
    const { margin } = this.config;
    const pages = plan.rows.length * plan.columns.length;
    const splitColumns = plan.columns.length > 1;
    const pxX = canvas.width / measure.width; // canvas px per CSS px
    const pxY = canvas.height / measure.height;

    let page = 0;
    plan.rows.forEach((rowPart, r) => {
      plan.columns.forEach((columnPart, c) => {
        if (page > 0) this.pdf.addPage();

        const first = r === 0 && c === 0;
        const rows = this.rowPieces(measure, rowPart.start, rowPart.end, first, splitColumns);
        const columns = this.columnPieces(measure, columnPart.units, splitColumns);

        const widthPx = columns.reduce((sum, p) => sum + Math.round((p.to - p.from) * pxX), 0);
        const heightPx = rows.reduce((sum, p) => sum + Math.round((p.to - p.from) * pxY), 0);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = widthPx;
        pageCanvas.height = heightPx;
        const ctx = pageCanvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, widthPx, heightPx);

        let dy = 0;
        rows.forEach((row) => {
          const sy = Math.round(row.from * pxY);
          const sh = Math.round((row.to - row.from) * pxY);
          if (row.title && measure.title) {
            // The page's width, centered on the title text, closed with a black line on each side
            const sx = Math.min(Math.max(Math.round(measure.title.center * pxX - widthPx / 2), 0), canvas.width - widthPx);
            ctx.drawImage(canvas, sx, sy, widthPx, sh, 0, dy, widthPx, sh);
            const line = Math.max(1, Math.round(pxX));
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, dy, line, sh);
            ctx.fillRect(widthPx - line, dy, line, sh);
          } else {
            let dx = 0;
            columns.forEach((col) => {
              const sx = Math.round(col.from * pxX);
              const sw = Math.round((col.to - col.from) * pxX);
              ctx.drawImage(canvas, sx, sy, sw, sh, dx, dy, sw, sh);
              dx += sw;
            });
          }
          dy += sh;
        });

        // One scale for every page; a single page is centered, several are top aligned
        const imageWidth = (widthPx / pxX) * plan.mmPerPx;
        const imageHeight = (heightPx / pxY) * plan.mmPerPx;
        const x = (pageWidth - imageWidth) / 2;
        const y = pages === 1 ? (pageHeight - imageHeight) / 2 : margin;
        const image = encode(pageCanvas);
        this.pdf.addImage(image.data, image.format, x, y, imageWidth, imageHeight, undefined, 'FAST');

        if (pages > 1) {
          this.pdf.setFontSize(8);
          this.pdf.setTextColor(90);
          this.pdf.text(`${page + 1} / ${pages}`, pageWidth / 2, pageHeight - margin - 1.5, {
            align: 'center',
          });
        }
        page++;
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
