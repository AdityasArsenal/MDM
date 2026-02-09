/**
 * PDF Exporter
 * Main orchestrator for PDF export process
 */

import { RefObject } from 'react';
import { PDFExportOptions, PDFExportCallbacks } from './types';
import { PDFStyleManager } from './styles';
import { CanvasRenderer } from './canvas-renderer';
import { PDFGenerator } from './pdf-generator';

export class PDFExporter {
  private styleManager: PDFStyleManager;
  private originalClassName: string = '';
  private originalTheme: string | null = null;

  constructor() {
    this.styleManager = new PDFStyleManager();
  }

  /**
   * Export HTML element to PDF
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
      this.prepareDOM(element);

      callbacks.onProgress?.(30);
      await this.waitForRender();

      callbacks.onProgress?.(50);
      const canvas = await CanvasRenderer.render(element, {
        scale: options.scale || 2,
        width: 794,
      });

      callbacks.onProgress?.(70);
      const pdfGenerator = new PDFGenerator({
        orientation: options.orientation,
        format: options.format,
        margin: options.margin,
        quality: options.quality,
      });

      callbacks.onProgress?.(85);
      pdfGenerator.addCanvas(canvas);
      pdfGenerator.save(options.fileName);

      callbacks.onProgress?.(100);
      callbacks.onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      callbacks.onError?.(errorMessage);
    } finally {
      this.cleanup(element);
    }
  }

  /**
   * Prepare DOM for PDF rendering
   */
  private prepareDOM(element: HTMLElement): void {
    this.originalTheme = document.documentElement.getAttribute('data-theme');
    this.originalClassName = element.className;

    document.documentElement.setAttribute('data-theme', 'light');
    this.styleManager.inject();
    element.className = `${this.originalClassName} pdf-export-container`;
  }

  /**
   * Wait for DOM to render with new styles
   */
  private async waitForRender(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 500));
  }

  /**
   * Cleanup DOM after export
   */
  private cleanup(element: HTMLElement): void {
    element.className = this.originalClassName;
    
    if (this.originalTheme) {
      document.documentElement.setAttribute('data-theme', this.originalTheme);
    }
    
    this.styleManager.remove();
  }
}
