/**
 * PDF Styles
 * Builds the stylesheet that is injected into the html2canvas CLONE of the page (never into the live page).
 * It reproduces the on-screen "Shared table style" from globals.css: black 1px grid, dark gray 3px
 * separators between the main column groups (.grp-l / .grp-r), .merge-r / .merge-l remove the line
 * between two neighbouring cells, centered titles, tight padding.
 */

import { PDFStyleConfig } from './types';

export const CONTAINER_CLASS = 'pdf-export-container';
export const SECONDARY_TABLE_CLASS = 'pdf-secondary-table';
const STYLE_ID = 'pdf-export-styles';

const DEFAULT_CONFIG: PDFStyleConfig = {
  fontSize: {
    title: 15,
    header: 12,
    body: 11,
  },
  colors: {
    border: '#000',
    separator: '#6b7280',
    headerBg: '#f5f5f5',
    text: '#000',
  },
  spacing: {
    cellPadding: '3px 4px',
    tablePadding: '8px',
  },
  separatorWidth: 3,
  minRenderWidth: 1200,
};

export class PDFStyleManager {
  private config: PDFStyleConfig;

  constructor(config?: Partial<PDFStyleConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Smallest render width in px */
  get minRenderWidth(): number {
    return this.config.minRenderWidth;
  }

  /** Add the stylesheet to a (cloned) document */
  applyTo(doc: Document, minRenderWidth?: number): void {
    doc.getElementById(STYLE_ID)?.remove();
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = this.generateStyles(minRenderWidth ?? this.config.minRenderWidth);
    doc.head.appendChild(style);
  }

  private generateStyles(minWidth: number): string {
    const { fontSize, colors, spacing, separatorWidth } = this.config;
    const C = `.${CONTAINER_CLASS}`;

    return `
      ${C} {
        display: block !important;
        position: static !important;
        float: none !important;
        transform: none !important;
        zoom: 1 !important;
        width: max-content !important;
        min-width: ${minWidth}px !important;
        max-width: none !important;
        height: auto !important;
        margin: 0 !important;
        padding: ${spacing.tablePadding} !important;
        box-sizing: border-box !important;
        background: #fff !important;
        font-family: Arial, Helvetica, 'Noto Sans Kannada', 'Nirmala UI', Tunga, sans-serif;
      }

      /* No scroll containers: every row must be laid out and painted */
      ${C}, ${C} * {
        overflow: visible !important;
        max-height: none !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }

      ${C} * {
        color: ${colors.text} !important;
        background: transparent !important;
      }

      /* Sunday dates stay red as on screen */
      ${C} .text-red-600 {
        color: #dc2626 !important;
      }

      [data-pdf-ignore],
      ${C} [data-pdf-ignore] {
        display: none !important;
      }

      ${C} svg,
      ${C} .lucide {
        display: none !important;
      }

      ${C} .border {
        border-color: ${colors.border};
      }

      ${C} table {
        width: 100% !important;
        border-collapse: collapse !important;
        table-layout: auto !important;
        font-size: ${fontSize.body}px !important;
      }

      /* Small side tables (egg summary) keep their own width, centered */
      ${C} table.${SECONDARY_TABLE_CLASS} {
        width: auto !important;
        margin: 0 auto !important;
      }

      ${C} thead,
      ${C} tbody,
      ${C} tfoot,
      ${C} tr {
        border-color: ${colors.border};
      }

      /* Grid: black everywhere */
      ${C} th,
      ${C} td {
        border: 1px solid ${colors.border} !important;
        padding: ${spacing.cellPadding} !important;
        text-align: center !important;
        vertical-align: middle !important;
        font-size: ${fontSize.body}px !important;
        line-height: 1.25 !important;
      }

      ${C} th {
        font-weight: bold !important;
        font-size: ${fontSize.header}px !important;
      }

      ${C} thead th,
      ${C} thead td {
        background: ${colors.headerBg} !important;
      }

      ${C} tfoot td,
      ${C} tfoot th {
        font-weight: bold !important;
      }

      /* Table title row */
      ${C} .text-lg {
        font-size: ${fontSize.title}px !important;
        font-weight: 600 !important;
      }

      /* Main column group separators. Higher specificity than the th/td border above. */
      ${C} .grp-l {
        border-left: ${separatorWidth}px solid ${colors.separator} !important;
      }
      ${C} .grp-r {
        border-right: ${separatorWidth}px solid ${colors.separator} !important;
      }

      /* No line between two neighbouring cells (date/class, date/payer) */
      ${C} .merge-r {
        border-right-style: none !important;
      }
      ${C} .merge-l {
        border-left-style: none !important;
      }
    `;
  }
}
