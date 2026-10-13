/**
 * PDF Styles
 * Builds the stylesheet that is injected into the html2canvas CLONE of the page (never into the live page).
 * It reproduces the on-screen "Shared table style" from globals.css: black 1px grid, dark gray 3px
 * separators between the main column groups (.grp-l / .grp-r), .merge-r / .merge-l remove the line
 * between two neighbouring cells, centered titles. The table is shrunk to its content so it can be
 * printed as large as possible: body cells never wrap, header cells wrap, and there is no outer box.
 */

import { PDFStyleConfig } from './types';

export const CONTAINER_CLASS = 'pdf-export-container';
export const SECONDARY_TABLE_CLASS = 'pdf-secondary-table';
/** Marks cells whose text contains Kannada, which is drawn a little larger than Latin text */
export const KANNADA_CLASS = 'pdf-kn';
/** Marks the cell of the table title row (month - table name) */
export const TITLE_CLASS = 'pdf-title';
/** Marks the body cells of every second date, which get a light gray background */
export const ALT_DATE_CLASS = 'pdf-alt';
const STYLE_ID = 'pdf-export-styles';

const DEFAULT_CONFIG: PDFStyleConfig = {
  fontSize: {
    title: 15,
    header: 12,
    headerKannada: 13,
    body: 11,
    bodyKannada: 12,
  },
  colors: {
    border: '#000',
    separator: '#6b7280',
    headerBg: '#d9d9d9',
    altDateBg: '#eeeeee',
    text: '#000',
  },
  cellPadding: 1.4,
  lineHeight: 1.15,
  separatorWidth: 3,
};

export class PDFStyleManager {
  private config: PDFStyleConfig;

  constructor(config?: Partial<PDFStyleConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get bodyFontPx(): number {
    return this.config.fontSize.body;
  }

  /** Add the stylesheet to a (cloned) document */
  applyTo(doc: Document): void {
    doc.getElementById(STYLE_ID)?.remove();
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = this.generateStyles();
    doc.head.appendChild(style);
  }

  private generateStyles(): string {
    const { fontSize, colors, cellPadding, lineHeight, separatorWidth } = this.config;
    const C = `.${CONTAINER_CLASS}`;

    return `
      /* As narrow as the content allows (min-content), with nothing around it: the page margin is added by the PDF */
      ${C} {
        display: block !important;
        position: static !important;
        float: none !important;
        transform: none !important;
        zoom: 1 !important;
        width: min-content !important;
        max-width: none !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
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
      ${C} [data-pdf-ignore],
      ${C} svg,
      ${C} .lucide {
        display: none !important;
      }

      /* No box around the table or the title: only the table's own grid remains */
      ${C} div,
      ${C} h3 {
        border: 0 !important;
        border-radius: 0 !important;
      }
      ${C} .p-4 {
        padding: 0 !important;
      }
      ${C} .mb-4 {
        margin-bottom: 6px !important;
      }
      ${C} h3 {
        margin: 0 0 3px !important;
        font-size: ${fontSize.body + 1}px !important;
        font-weight: 600 !important;
        text-align: center !important;
      }

      /* Tables are exactly as wide as their columns need */
      ${C} table {
        width: min-content !important;
        border-collapse: collapse !important;
        table-layout: auto !important;
        font-size: ${fontSize.body}px !important;
      }

      /* Small side tables (egg summary) use the full width of the main table instead of a narrow strip */
      ${C} table.${SECONDARY_TABLE_CLASS} {
        width: 100% !important;
      }

      /* Row and section borders (border-b on screen) would be drawn through rowSpan cells; the cell grid is enough */
      ${C} thead,
      ${C} tbody,
      ${C} tfoot,
      ${C} tr {
        border: 0 !important;
      }

      /* Grid: black everywhere. Widths from the screen layout (min-w-[120px]) would waste space.
         Padding is small and equal on every side so the text is as large as possible in its box. */
      ${C} th,
      ${C} td {
        border: 1px solid ${colors.border} !important;
        padding: ${cellPadding}px !important;
        text-align: center !important;
        vertical-align: middle !important;
        font-size: ${fontSize.body}px !important;
        line-height: ${lineHeight} !important;
        width: auto !important;
        min-width: 0 !important;
        max-width: none !important;
      }

      /* Body cells never wrap, so a column is as wide as its widest value; only headers are bold */
      ${C} td,
      ${C} td * {
        white-space: nowrap !important;
        font-weight: normal !important;
      }

      /* Header cells wrap between words only: a column is never narrower than a word of its name */
      ${C} thead th {
        white-space: normal !important;
        overflow-wrap: normal !important;
        word-break: normal !important;
        font-weight: bold !important;
        font-size: ${fontSize.header}px !important;
        background: ${colors.headerBg} !important;
      }
      ${C} tbody th,
      ${C} tfoot th {
        font-weight: bold !important;
        font-size: ${fontSize.header}px !important;
      }
      ${C} thead td {
        background: ${colors.headerBg} !important;
      }

      /* Every second date is shaded so a line of numbers is easier to follow */
      ${C} td.${ALT_DATE_CLASS} {
        background: ${colors.altDateBg} !important;
      }

      /* Kannada glyphs look smaller than Latin ones at the same size */
      ${C} th.${KANNADA_CLASS} {
        font-size: ${fontSize.headerKannada}px !important;
      }
      ${C} td.${KANNADA_CLASS} {
        font-size: ${fontSize.bodyKannada}px !important;
      }

      /* Table title row: the only place with some air around the text. The screen layout gives its
         wrappers fixed heights (for the toolbar), which are not needed here. */
      ${C} td.${TITLE_CLASS},
      ${C} td.${TITLE_CLASS} * {
        font-size: ${fontSize.title}px !important;
        font-weight: 600 !important;
        height: auto !important;
        min-height: 0 !important;
      }
      ${C} td.${TITLE_CLASS} {
        padding: 4px !important;
      }

      /* Main column group separators. Higher specificity than the th/td border above.
         The padding next to the thick line is doubled so the text does not sit against it. */
      ${C} .grp-l {
        border-left: ${separatorWidth}px solid ${colors.separator} !important;
        padding-left: ${cellPadding * 2}px !important;
      }
      ${C} .grp-r {
        border-right: ${separatorWidth}px solid ${colors.separator} !important;
        padding-right: ${cellPadding * 2}px !important;
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
