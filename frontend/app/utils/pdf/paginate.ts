/**
 * Pagination
 * Pure functions: split the measured table into row parts and column parts.
 * Both minimise the size of the largest part, because the whole export is printed at one scale.
 */

import { PDFColumnPart, PDFMeasure, PDFRowPart } from './types';

/** Extra px drawn below a cut (its grid line) and trimmed above a continuation page; see pdf-generator */
export const CUT_PAD = 1;

/**
 * Split a list of boundaries into `parts` consecutive segments so that the largest segment cost is
 * as small as possible. `points` are sorted boundaries (first and last included); a segment spans
 * two boundaries and costs `cost(fromIndex, toIndex)`. Returns the chosen boundary indices, or null
 * when there are not enough boundaries for that many parts.
 */
function minimaxSplit(
  points: number,
  parts: number,
  cost: (from: number, to: number, first: boolean) => number
): number[] | null {
  if (points - 1 < parts) return null;
  // best[k][j]: smallest possible tallest segment when the first j+1 boundaries are split into k segments
  const best: number[][] = [];
  const from: number[][] = [];
  for (let k = 0; k <= parts; k++) {
    best.push(new Array(points).fill(Infinity));
    from.push(new Array(points).fill(-1));
  }
  best[0][0] = 0;
  for (let k = 1; k <= parts; k++) {
    for (let j = k; j < points; j++) {
      for (let i = k - 1; i < j; i++) {
        const worst = Math.max(best[k - 1][i], cost(i, j, k === 1));
        if (worst < best[k][j]) {
          best[k][j] = worst;
          from[k][j] = i;
        }
      }
    }
  }
  const chosen = [points - 1];
  for (let k = parts, j = points - 1; k > 0; k--) {
    j = from[k][j];
    chosen.unshift(j);
  }
  return chosen;
}

/** Split the rows into `parts` pages at legal cuts. The header is repeated on every page but the first. */
export function splitRows(measure: PDFMeasure, parts: number): PDFRowPart[] | null {
  const { height, header } = measure;
  const cuts = measure.cutPoints.filter((c) => c > 0 && c < height);
  const points = [0, ...cuts, height];
  const headerCost = header ? header.bottom - header.top + CUT_PAD : 0;
  // A page that starts below the header repeats it; the first page contains it
  const pageHeight = (a: number, b: number, first: boolean) =>
    points[b] - points[a] + (first ? 0 : headerCost) + 2 * CUT_PAD;

  const chosen = minimaxSplit(points.length, parts, pageHeight);
  if (!chosen) return null;
  return chosen.slice(1).map((end, k) => ({
    start: points[chosen[k]],
    end: points[end],
    height: pageHeight(chosen[k], end, k === 0),
  }));
}

/**
 * Split the column groups into `parts` pages. The identifying columns (left of the first group)
 * are repeated on every page, so each page is as wide as them plus its groups.
 */
export function splitColumns(measure: PDFMeasure, parts: number): PDFColumnPart[] | null {
  const { units, width } = measure;
  if (parts === 1) return [{ units, width }];
  if (units.length < parts) return null;

  const idWidth = units[0].left;
  const chosen = minimaxSplit(units.length + 1, parts, (a, b) =>
    units.slice(a, b).reduce((sum, u) => sum + u.right - u.left, 0)
  );
  if (!chosen) return null;
  return chosen.slice(1).map((end, k) => {
    const part = units.slice(chosen[k], end);
    return { units: part, width: idWidth + part.reduce((sum, u) => sum + u.right - u.left, 0) };
  });
}
