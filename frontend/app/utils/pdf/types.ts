/**
 * PDF Export Types
 * Clean type definitions for PDF generation
 */

export interface PDFExportOptions {
  fileName: string;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'letter';
  scale?: number;
  quality?: number;
  margin?: number;
  /** Smallest width (CSS px) the table is rendered at. Wider tables render at their natural width. */
  minRenderWidth?: number;
}

export interface PDFExportCallbacks {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

export interface PDFStyleConfig {
  fontSize: {
    title: number;
    header: number;
    body: number;
  };
  colors: {
    /** Grid lines */
    border: string;
    /** Dark gray line between the main column groups (.grp-l / .grp-r) */
    separator: string;
    headerBg: string;
    text: string;
  };
  spacing: {
    cellPadding: string;
    tablePadding: string;
  };
  /** Width in px of the main column group separator lines */
  separatorWidth: number;
  /** Smallest render width in px */
  minRenderWidth: number;
}

/** Vertical range, in CSS px relative to the top of the rendered container */
export interface PDFRange {
  top: number;
  bottom: number;
}

/** What the clone measured, in CSS px, so the generator can paginate between rows */
export interface PDFLayout {
  width: number;
  height: number;
  /** Positions where the page may be cut (row boundaries that no rowSpan cell crosses), sorted */
  cutPoints: number[];
  /** thead of the main table; repeated at the top of every page that starts below it */
  header: PDFRange | null;
}

/** One output page: the source range [start, end) of the container, plus whether to repeat the header */
export interface PDFPageSlice {
  start: number;
  end: number;
  header: boolean;
}
