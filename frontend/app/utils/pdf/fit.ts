/**
 * Export plan
 * Pure functions: choose orientation and the split into pages so the table prints as large as
 * possible with as few pages as possible, and choose the html2canvas scale for a sharp result.
 */

import { splitColumns, splitRows } from './paginate';
import { PDFColumnPart, PDFFormat, PDFMeasure, PDFOrientation, PDFPlan, PDFRowPart } from './types';

const PAGE_MM: Record<PDFFormat, { short: number; long: number }> = {
  a4: { short: 210, long: 297 },
  letter: { short: 215.9, long: 279.4 },
};

/** 20px */
export const DEFAULT_MARGIN_MM = (20 * 25.4) / 96;
/** Space under the table reserved for the page number when there is more than one page, in mm */
const FOOTER_MM = 6;

/** Fewest pages that reach 10pt body text; if even 4 pages cannot, the fewest that reach 9pt */
const TARGET_PT = [10, 9];
/** 10pt is a target, not a cliff: 9.9pt is not worth an extra page */
const PT_TOLERANCE = 0.2;
const MAX_PAGES = 4;

const PT_PER_MM = 72 / 25.4;
const TARGET_DPI = 300;
const MIN_SCALE = 2;
const MAX_SCALE = 4;
/** Browsers fail on canvases over about 16k px per side */
const MAX_CANVAS_SIDE = 12000;

function pageSizeMm(format: PDFFormat, orientation: PDFOrientation): { width: number; height: number } {
  const { short, long } = PAGE_MM[format];
  return orientation === 'landscape' ? { width: long, height: short } : { width: short, height: long };
}

function evaluate(
  rows: PDFRowPart[],
  columns: PDFColumnPart[],
  orientation: PDFOrientation,
  options: { format: PDFFormat; margin: number; bodyPx: number }
): PDFPlan {
  const { format, margin, bodyPx } = options;
  const page = pageSizeMm(format, orientation);
  const pages = rows.length * columns.length;
  const areaWidth = page.width - 2 * margin;
  const areaHeight = page.height - 2 * margin - (pages > 1 ? FOOTER_MM : 0);
  const contentWidth = Math.max(...columns.map((c) => c.width));
  const contentHeight = Math.max(...rows.map((r) => r.height));
  // One scale for every page: the biggest page decides
  const mmPerPx = Math.min(areaWidth / contentWidth, areaHeight / contentHeight);
  return { orientation, rows, columns, mmPerPx, bodyPt: bodyPx * mmPerPx * PT_PER_MM };
}

/**
 * Choose how to print the measured table: one page if the body text reaches 10pt, otherwise the
 * fewest pages (at most 4, split by rows and/or by column groups) that reach 10pt, then 9pt.
 */
export function planExport(
  measure: PDFMeasure,
  options: { format: PDFFormat; margin: number; bodyPx: number; orientation?: PDFOrientation }
): PDFPlan {
  const orientations: PDFOrientation[] = options.orientation ? [options.orientation] : ['portrait', 'landscape'];

  const candidates: PDFPlan[] = [];
  for (let r = 1; r <= MAX_PAGES; r++) {
    const rows = splitRows(measure, r);
    if (!rows) continue;
    for (let c = 1; r * c <= MAX_PAGES; c++) {
      const columns = splitColumns(measure, c);
      if (!columns) continue;
      orientations.forEach((o) => candidates.push(evaluate(rows, columns, o, options)));
    }
  }

  const pagesOf = (p: PDFPlan) => p.rows.length * p.columns.length;
  const largest = (plans: PDFPlan[]) => plans.reduce((a, b) => (b.mmPerPx > a.mmPerPx * 1.001 ? b : a));

  for (const target of TARGET_PT) {
    for (let pages = 1; pages <= MAX_PAGES; pages++) {
      const reaching = candidates.filter((p) => pagesOf(p) === pages && p.bodyPt >= target - PT_TOLERANCE);
      if (reaching.length) return largest(reaching);
    }
  }
  // Not even 4 pages reach 9pt: use the most pages for the largest text
  const maxPages = Math.max(...candidates.map(pagesOf));
  return largest(candidates.filter((p) => pagesOf(p) === maxPages));
}

/** html2canvas scale giving about 300 DPI at the final printed size, within safe canvas limits */
export function renderScale(plan: PDFPlan, measure: PDFMeasure): number {
  const dpiScale = (TARGET_DPI / 25.4) * plan.mmPerPx;
  const limit = MAX_CANVAS_SIDE / Math.max(measure.width, measure.height);
  return Math.max(1, Math.min(Math.max(MIN_SCALE, Math.min(MAX_SCALE, dpiScale)), limit));
}
