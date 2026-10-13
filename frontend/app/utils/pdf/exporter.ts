/**
 * PDF Exporter
 * Main orchestrator for PDF export process
 */

import { RefObject } from 'react';
import { PDFExportOptions, PDFExportCallbacks } from './types';
import { PDFStyleManager } from './styles';
import { CanvasRenderer } from './canvas-renderer';
import { DOMProcessor } from './dom-processor';
import { PDFGenerator } from './pdf-generator';

export class PDFExporter {
  private styleManager: PDFStyleManager;

  constructor() {
    this.styleManager = new PDFStyleManager();
  }

  /**
   * Export HTML element to PDF.
   * The live page is never modified: styles, the 100% zoom, input/button replacement and row
   * measuring all happen in the html2canvas clone.
   */
  async export(
    elementRef: RefObject<HTMLElement | null>,
    options: PDFExportOptions,
    callbacks: PDFExportCallbacks = {}
  ): Promise<void> {
    const element = elementRef.current;

    if (!element) {
      callbacks.onError?.('No content found to export');
      return;
    }

    try {
      callbacks.onProgress?.(10);
      // Input values must be read from the live page (html2canvas only copies attributes)
      const inputs = DOMProcessor.collectInputs(element);

      callbacks.onProgress?.(30);
      const { canvas, layout } = await CanvasRenderer.render(element, {
        scale: options.scale || 2,
        minWidth: options.minRenderWidth,
        styles: this.styleManager,
        inputs,
      });

      callbacks.onProgress?.(70);
      const pdfGenerator = new PDFGenerator({
        orientation: options.orientation,
        format: options.format,
        margin: options.margin,
        quality: options.quality,
      });

      callbacks.onProgress?.(85);
      pdfGenerator.addCanvas(canvas, layout);
      pdfGenerator.save(options.fileName);

      callbacks.onProgress?.(100);
      callbacks.onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      callbacks.onError?.(errorMessage);
    }
  }
}
