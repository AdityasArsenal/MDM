/**
 * Canvas Renderer
 * Handles HTML to Canvas conversion
 */

import html2canvas from 'html2canvas';
import { DOMProcessor, InputSnapshot } from './dom-processor';
import { planExport, renderScale } from './fit';
import { PDFStyleManager } from './styles';
import { PDFFormat, PDFMeasure, PDFOrientation, PDFPlan } from './types';

export interface CanvasOptions {
  format: PDFFormat;
  /** mm */
  margin: number;
  orientation?: PDFOrientation;
  /** Forces the scale; by default about 300 DPI at the final printed size */
  scale?: number;
  styles: PDFStyleManager;
  inputs: InputSnapshot[];
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  measure: PDFMeasure;
  plan: PDFPlan;
}

type Html2CanvasOptions = NonNullable<Parameters<typeof html2canvas>[1]>;

/** The 1x1 gif html2canvas 1.4.1 uses to measure font baselines (its SMALL_IMAGE constant) */
const BASELINE_PROBE_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export class CanvasRenderer {
  private static readonly FALLBACK_SCALE = 3;

  static async render(element: HTMLElement, options: CanvasOptions): Promise<RenderResult> {
    const { styles, inputs, scale, format, margin, orientation } = options;
    // A holder object, because TypeScript does not see assignments made inside the onclone callback
    const measured: { value?: { measure: PDFMeasure; plan: PDFPlan } } = {};

    const html2canvasOptions: Html2CanvasOptions = {
      scale: scale ?? this.FALLBACK_SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      ignoreElements: (el) => el.hasAttribute?.('data-pdf-ignore'),
      onclone: (clonedDoc, clonedElement) => {
        const measure = DOMProcessor.processClonedDocument(clonedDoc, clonedElement, styles, inputs);
        const plan = planExport(measure, { format, margin, orientation, bodyPx: styles.bodyFontPx });
        measured.value = { measure, plan };
        // The scale depends on the measured size, which is only known here. html2canvas 1.4.1 reads
        // options.scale after onclone returns; if a future version stops doing that, the export just
        // keeps FALLBACK_SCALE.
        if (scale === undefined) html2canvasOptions.scale = renderScale(plan, measure);
      },
    };

    // html2canvas finds each font's baseline with a 1px probe image placed next to some text in the
    // LIVE page. Tailwind's preflight makes every img display: block, which drops the probe onto its
    // own line, so all text was drawn several px too low (digits touching the line below). Only the
    // probe image is matched here, and the rule is removed right after the render.
    const baselineFix = document.createElement('style');
    baselineFix.textContent = `img[src="${BASELINE_PROBE_SRC}"]{display:inline!important}`;
    document.head.appendChild(baselineFix);
    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(element, html2canvasOptions);
    } finally {
      baselineFix.remove();
    }

    if (!measured.value) {
      throw new Error('Could not measure the table for the PDF');
    }
    return { canvas, ...measured.value };
  }
}
