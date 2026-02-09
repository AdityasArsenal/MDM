/**
 * PDF Generator
 * Handles PDF document creation from canvas
 */

import jsPDF from 'jspdf';

export interface PDFConfig {
  orientation: 'portrait' | 'landscape';
  format: 'a4' | 'letter';
  margin: number;
  quality: number;
}

export class PDFGenerator {
  private pdf: jsPDF;
  private config: PDFConfig;

  constructor(config: Partial<PDFConfig> = {}) {
    this.config = {
      orientation: config.orientation || 'portrait',
      format: config.format || 'a4',
      margin: config.margin || 10,
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
   * Add canvas to PDF with automatic pagination
   */
  addCanvas(canvas: HTMLCanvasElement): void {
    const pdfWidth = this.pdf.internal.pageSize.getWidth();
    const pdfHeight = this.pdf.internal.pageSize.getHeight();
    const { margin, quality } = this.config;

    const availableWidth = pdfWidth - 2 * margin;
    const availableHeight = pdfHeight - 2 * margin;

    const canvasAspectRatio = canvas.width / canvas.height;
    const scaleFactor = availableWidth / canvas.width;
    const scaledHeight = canvas.height * scaleFactor;

    // Single page - fits on one page
    if (scaledHeight <= availableHeight) {
      this.addSinglePage(canvas, availableWidth, scaledHeight, margin, quality);
    } else {
      // Multi-page - needs pagination
      this.addMultiplePages(canvas, availableWidth, availableHeight, margin, scaleFactor, quality);
    }
  }

  /**
   * Add single page content
   */
  private addSinglePage(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    margin: number,
    quality: number
  ): void {
    const imgData = canvas.toDataURL('image/png', quality);
    const pdfWidth = this.pdf.internal.pageSize.getWidth();
    const pdfHeight = this.pdf.internal.pageSize.getHeight();
    
    const x = (pdfWidth - width) / 2;
    const y = (pdfHeight - height) / 2;
    
    this.pdf.addImage(imgData, 'PNG', x, y, width, height);
  }

  /**
   * Add multi-page content with pagination
   */
  private addMultiplePages(
    canvas: HTMLCanvasElement,
    availableWidth: number,
    availableHeight: number,
    margin: number,
    scaleFactor: number,
    quality: number
  ): void {
    const scaledHeight = canvas.height * scaleFactor;
    const pagesNeeded = Math.ceil(scaledHeight / availableHeight);

    for (let page = 0; page < pagesNeeded; page++) {
      if (page > 0) {
        this.pdf.addPage();
      }

      const sourceY = (page * availableHeight) / scaleFactor;
      const sourceHeight = Math.min(
        availableHeight / scaleFactor,
        canvas.height - sourceY
      );

      const pageCanvas = this.createPageCanvas(canvas, sourceY, sourceHeight);
      const pageImgData = pageCanvas.toDataURL('image/png', quality);
      const pageHeight = Math.min(availableHeight, scaledHeight - page * availableHeight);

      this.pdf.addImage(pageImgData, 'PNG', margin, margin, availableWidth, pageHeight);
    }
  }

  /**
   * Create canvas for a single page slice
   */
  private createPageCanvas(
    sourceCanvas: HTMLCanvasElement,
    sourceY: number,
    sourceHeight: number
  ): HTMLCanvasElement {
    const pageCanvas = document.createElement('canvas');
    const ctx = pageCanvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    pageCanvas.width = sourceCanvas.width;
    pageCanvas.height = sourceHeight * (sourceCanvas.width / sourceCanvas.width);

    const sourceYPixels = sourceY * (sourceCanvas.height / sourceCanvas.height);
    const sourceHeightPixels = sourceHeight * (sourceCanvas.height / sourceCanvas.height);

    ctx.drawImage(
      sourceCanvas,
      0, sourceYPixels,
      sourceCanvas.width, sourceHeightPixels,
      0, 0,
      pageCanvas.width, pageCanvas.height
    );

    return pageCanvas;
  }

  /**
   * Save PDF to file
   */
  save(fileName: string): void {
    this.pdf.save(fileName);
  }
}
