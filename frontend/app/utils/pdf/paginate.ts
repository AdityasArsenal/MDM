/**
 * Pagination planner
 * Pure function: decides which part of the rendered table goes on which page.
 * Pages are cut only at the given cut points (row boundaries), never through a row.
 */

import { PDFLayout, PDFPageSlice } from './types';

const EPS = 0.5;
/** Extra px drawn below a cut (its grid line) and trimmed above a continuation page; see pdf-generator */
export const CUT_PAD = 1;

/**
 * @param layout     measured layout (CSS px)
 * @param pageHeight height of the usable page area expressed in CSS px of the rendered table
 */
export function planPages(layout: PDFLayout, pageHeight: number): PDFPageSlice[] {
  const { height, header } = layout;
  const cuts = layout.cutPoints.filter((c) => c > EPS && c < height - EPS);
  const headerCost = header ? header.bottom - header.top + CUT_PAD : 0;
  const slices: PDFPageSlice[] = [];

  let y = 0;
  while (y < height - EPS) {
    // Repeat the header on every page after the first that starts below the header
    const repeat = !!header && slices.length > 0 && y >= header.bottom - EPS;
    const room = Math.max(pageHeight - (repeat ? headerCost : 0) - 2 * CUT_PAD, 1);

    let end: number;
    if (height - y <= room + EPS) {
      end = height;
    } else {
      let best = -1;
      for (const c of cuts) {
        if (c > y + EPS && c - y <= room) best = c;
        else if (c - y > room) break;
      }
      // A single row taller than a page cannot be kept whole: cut it hard
      end = best > 0 ? best : Math.min(y + room, height);
    }

    slices.push({ start: y, end, header: repeat });
    y = end;
  }

  return slices;
}
