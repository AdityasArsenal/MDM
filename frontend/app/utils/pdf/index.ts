/**
 * PDF Export Module
 * Clean, modular PDF generation system
 */

import { RefObject } from 'react';
import { PDFExporter } from './exporter';
import { PDFExportOptions, PDFExportCallbacks } from './types';

// Singleton instance for reuse
let exporterInstance: PDFExporter | null = null;

function getExporter(): PDFExporter {
  if (!exporterInstance) {
    exporterInstance = new PDFExporter();
  }
  return exporterInstance;
}

/**
 * Export HTML element to PDF
 * 
 * @param elementRef - React ref to the element to export
 * @param fileName - Name of the PDF file
 * @param onSuccess - Success callback
 * @param onError - Error callback
 * @param options - Additional export options and callbacks
 */
export async function exportToPDF(
  elementRef: RefObject<HTMLElement | null>,
  fileName: string,
  onSuccess?: () => void,
  onError?: (error: string) => void,
  options: Partial<PDFExportOptions & PDFExportCallbacks> = {}
): Promise<void> {
  const exporter = getExporter();
  
  const exportOptions: PDFExportOptions = {
    fileName,
    orientation: options.orientation || 'portrait',
    format: options.format || 'a4',
    scale: options.scale || 2,
    quality: options.quality || 1.0,
    margin: options.margin || 10,
  };

  const callbacks: PDFExportCallbacks = {
    onSuccess,
    onError,
    onProgress: options.onProgress,
  };

  await exporter.export(elementRef, exportOptions, callbacks);
}

// Re-export types for convenience
export type { PDFExportOptions, PDFExportCallbacks } from './types';
