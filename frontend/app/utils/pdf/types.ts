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
}

export interface PDFExportCallbacks {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

export interface PDFStyleConfig {
  fontSize: {
    header: number;
    body: number;
    small: number;
  };
  colors: {
    border: string;
    headerBg: string;
    text: string;
  };
  spacing: {
    cellPadding: string;
    tablePadding: string;
  };
}
