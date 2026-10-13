/**
 * Canvas Renderer
 * Handles HTML to Canvas conversion
 */

import html2canvas from 'html2canvas';
import { DOMProcessor, InputSnapshot } from './dom-processor';
import { PDFStyleManager } from './styles';
import { PDFLayout } from './types';

export interface CanvasOptions {
  scale?: number;
  /** Smallest render width in CSS px (wider tables render at their natural width) */
  minWidth?: number;
  backgroundColor?: string;
  styles?: PDFStyleManager;
  inputs?: InputSnapshot[];
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  layout: PDFLayout;
}

export class CanvasRenderer {
  private static readonly DEFAULT_SCALE = 2;
  /** Keep the canvas well under the browser limits (about 16k px per side) */
  private static readonly MAX_CANVAS_WIDTH = 12000;

  static async render(element: HTMLElement, options: CanvasOptions = {}): Promise<RenderResult> {
    const styles = options.styles ?? new PDFStyleManager();
    const minWidth = options.minWidth ?? styles.minRenderWidth;
    const inputs = options.inputs ?? DOMProcessor.collectInputs(element);
    const backgroundColor = options.backgroundColor ?? '#ffffff';

    // The live layout width is unaffected by the page's transform: scale. Only an estimate, used
    // for the iframe width and to cap the canvas size; the real size is measured in the clone.
    const estimatedWidth = Math.max(minWidth, element.scrollWidth);
    const scale = Math.max(
      1,
      Math.min(options.scale ?? this.DEFAULT_SCALE, this.MAX_CANVAS_WIDTH / estimatedWidth)
    );

    let layout: PDFLayout | null = null;

    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor,
      logging: false,
      windowWidth: Math.ceil(estimatedWidth),
      scrollX: 0,
      scrollY: 0,
      ignoreElements: (el) => el.hasAttribute?.('data-pdf-ignore'),
      onclone: (clonedDoc, clonedElement) => {
        layout = DOMProcessor.processClonedDocument(clonedDoc, clonedElement, styles, inputs, minWidth);
      },
    });

    if (!layout) {
      throw new Error('Could not measure the table for the PDF');
    }
    return { canvas, layout };
  }
}
