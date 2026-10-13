/**
 * PDF Export Types
 * Clean type definitions for PDF generation
 */

export type PDFOrientation = 'portrait' | 'landscape';
export type PDFFormat = 'a4' | 'letter';

export interface PDFExportOptions {
  fileName: string;
  /** Forces an orientation. By default the one that prints the table larger is chosen. */
  orientation?: PDFOrientation;
  format?: PDFFormat;
  /** Forces the html2canvas scale. By default it is chosen for about 300 DPI on paper. */
  scale?: number;
  /** Page margin in mm on every side (default 20px) */
  margin?: number;
}

export interface PDFExportCallbacks {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

export interface PDFStyleConfig {
  fontSize: {
    title: number;
    /** Latin column headers; Kannada headers and cells are a little larger */
    header: number;
    headerKannada: number;
    body: number;
    bodyKannada: number;
  };
  colors: {
    /** Grid lines */
    border: string;
    /** Dark gray line between the main column groups (.grp-l / .grp-r) */
    separator: string;
    headerBg: string;
    text: string;
  };
  /** Small and equal on every side, so the text is as large as possible in its box */
  cellPadding: string;
  lineHeight: number;
  /** Width in px of the main column group separator lines */
  separatorWidth: number;
}

/** Vertical range, in CSS px relative to the top of the rendered container */
export interface PDFRange {
  top: number;
  bottom: number;
}

/** Horizontal range, in CSS px relative to the left of the rendered container */
export interface PDFSpan {
  left: number;
  right: number;
}

/** What the clone measured, in CSS px. The plan and the page composition work from these numbers only. */
export interface PDFMeasure {
  width: number;
  height: number;
  /** Row boundaries where a page may end: no rowSpan cell crosses them, not in thead, not above tfoot */
  cutPoints: number[];
  /** Header rows (thead without the title row), repeated at the top of every page after the first */
  header: PDFRange | null;
  /** The title row; shown on the first page only. `center` is the x of its text. */
  title: (PDFRange & { center: number }) | null;
  /** Main column groups (.grp-l .. .grp-r), left to right. Everything left of the first one identifies the row. */
  units: PDFSpan[];
}

/** Rows [start, end) of one page. `height` includes the repeated header. */
export interface PDFRowPart {
  start: number;
  end: number;
  height: number;
}

/** The column groups of one page; the identifying columns are repeated on every page. */
export interface PDFColumnPart {
  units: PDFSpan[];
  width: number;
}

/** How the table is split over pages: rows.length x columns.length pages, in reading order */
export interface PDFPlan {
  orientation: PDFOrientation;
  rows: PDFRowPart[];
  columns: PDFColumnPart[];
  /** mm on paper per CSS px of the rendered table */
  mmPerPx: number;
  /** Printed size of the body text in pt */
  bodyPt: number;
}
