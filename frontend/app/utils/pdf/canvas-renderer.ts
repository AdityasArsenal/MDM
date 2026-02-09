/**
 * Canvas Renderer
 * Handles HTML to Canvas conversion
 */

import html2canvas from 'html2canvas';
import { DOMProcessor } from './dom-processor';

export interface CanvasOptions {
  scale?: number;
  width?: number;
  backgroundColor?: string;
}

export class CanvasRenderer {
  private static readonly DEFAULT_WIDTH = 794; // A4 width in pixels at 96 DPI
  private static readonly DEFAULT_SCALE = 2;

  static async render(
    element: HTMLElement,
    options: CanvasOptions = {}
  ): Promise<HTMLCanvasElement> {
    const {
      scale = this.DEFAULT_SCALE,
      width = this.DEFAULT_WIDTH,
      backgroundColor = '#ffffff',
    } = options;

    return html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor,
      windowWidth: width,
      width,
      height: element.scrollHeight,
      onclone: (clonedDoc) => DOMProcessor.processClonedDocument(clonedDoc),
    });
  }
}
