/**
 * DOM Processor
 * Prepares the html2canvas CLONE of the page for PDF rendering and measures it.
 * Nothing here touches the live page; columns are found by position and header text in the clone.
 */

import { PDFMeasure, PDFRange, PDFSpan } from './types';
import {
  PDFStyleManager,
  ALT_DATE_CLASS,
  CONTAINER_CLASS,
  KANNADA_CLASS,
  SECONDARY_TABLE_CLASS,
  TITLE_CLASS,
} from './styles';

const IGNORE_SELECTOR = '[data-pdf-ignore]';
const SELECTED_BUTTON_SELECTOR =
  'button.bg-blue-500, button.bg-orange-500, button.bg-green-500, button.bg-red-500, button.bg-purple-500, button[aria-pressed="true"]';
const KANNADA = /[\u0C80-\u0CFF]/;
/** Tolerance in px for collapsed borders and sub-pixel layout */
const EPS = 1.5;
/** Header cells use at most this many lines; a column grows until its header fits */
const MAX_HEADER_LINES = 3;
const HEADER_STEP = 4;
const HEADER_PASSES = 40;

export interface InputSnapshot {
  value: string;
  type: string;
}

interface GridCell {
  cell: HTMLTableCellElement;
  row: number;
  col: number;
}

const textOf = (el: Element) => (el.textContent || '').trim();

/** Every cell with its first row and column, taking rowSpan and colSpan into account */
function buildGrid(table: HTMLTableElement): GridCell[] {
  const busy: boolean[][] = [];
  const cells: GridCell[] = [];
  Array.from(table.rows).forEach((tr, row) => {
    busy[row] = busy[row] || [];
    let col = 0;
    Array.from(tr.cells).forEach((cell) => {
      while (busy[row][col]) col++;
      cells.push({ cell, row, col });
      for (let dr = 0; dr < cell.rowSpan; dr++) {
        busy[row + dr] = busy[row + dr] || [];
        for (let dc = 0; dc < cell.colSpan; dc++) busy[row + dr][col + dc] = true;
      }
      col += cell.colSpan;
    });
  });
  return cells;
}

/** Number of grid columns of a table (widest row, colspans counted) */
function columnCount(table: HTMLTableElement): number {
  let max = 0;
  Array.from(table.rows).forEach((row) => {
    const cols = Array.from(row.cells).reduce((sum, cell) => sum + (cell.colSpan || 1), 0);
    if (cols > max) max = cols;
  });
  return max;
}

/** The title row is a single cell across the whole table */
function isTitleRow(row: HTMLTableRowElement | undefined, columns: number): boolean {
  return !!row && row.cells.length === 1 && row.cells[0].colSpan >= columns;
}

/** Width of `text` in the font of `sample`, for sizing columns before the real layout */
function textWidth(container: HTMLElement, sample: HTMLElement, text: string): number {
  const style = container.ownerDocument.defaultView!.getComputedStyle(sample);
  const probe = container.ownerDocument.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;';
  probe.style.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  probe.textContent = text;
  container.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

/** Horizontal padding and borders of a cell */
function cellExtra(cell: HTMLElement): number {
  const style = cell.ownerDocument.defaultView!.getComputedStyle(cell);
  return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
}

/** Never lowers a column's minimum width; inline !important beats the stylesheet's min-width: 0 */
function raiseMinWidth(cell: HTMLElement, px: number): void {
  const current = parseFloat(cell.dataset.pdfMin || '0');
  if (px <= current) return;
  cell.dataset.pdfMin = String(px);
  cell.style.setProperty('min-width', `${px}px`, 'important');
}

/** Lines of text a cell currently shows */
function lineCount(cell: HTMLElement): number {
  const range = cell.ownerDocument.createRange();
  range.selectNodeContents(cell);
  const tops = Array.from(range.getClientRects())
    .filter((r) => r.width > 0)
    .map((r) => r.top)
    .sort((a, b) => a - b);
  return tops.reduce((lines, top, i) => (i === 0 || top - tops[i - 1] > 3 ? lines + 1 : lines), 0);
}

export class DOMProcessor {
  /**
   * Read the current input values from the LIVE page. html2canvas does not copy the value of
   * an <input> (only its attribute), and uncontrolled inputs change the property, not the attribute.
   */
  static collectInputs(container: Element): InputSnapshot[] {
    return Array.from(container.querySelectorAll('input'))
      .filter((input) => !input.closest(IGNORE_SELECTOR))
      .map((input) => ({ value: input.value, type: input.type }));
  }

  /**
   * Replace input elements with their values. Number inputs show 0 when empty; others show nothing.
   * Works for read-only and disabled inputs too.
   */
  private static replaceInputs(container: Element, snapshots: InputSnapshot[]): void {
    const doc = container.ownerDocument;
    Array.from(container.querySelectorAll('input')).forEach((input, index) => {
      const snap = snapshots[index];
      const type = snap?.type ?? input.type;
      if (type === 'hidden') {
        input.remove();
        return;
      }
      const raw = snap?.value ?? input.value;
      const span = doc.createElement('span');
      span.textContent = raw !== '' ? raw : type === 'number' ? '0' : '';
      input.parentNode?.replaceChild(span, input);
    });
  }

  /**
   * Replace button groups (meal type, yes/no) with the selected button's text.
   * A group with nothing selected becomes empty.
   */
  private static replaceButtonGroups(container: Element): void {
    const doc = container.ownerDocument;
    const groups = Array.from(container.querySelectorAll('.flex.flex-col.gap-1')).filter((group) =>
      group.querySelector('button')
    );
    groups.forEach((group) => {
      const selected = group.querySelector(SELECTED_BUTTON_SELECTOR);
      const span = doc.createElement('span');
      span.textContent = (selected?.textContent || '').replace(/[✓✔]/g, '').trim();
      group.parentNode?.replaceChild(span, group);
    });
  }

  /** The main table is the widest one (most columns, then most rows). Others get the secondary class. */
  private static findMainTable(container: Element): HTMLTableElement | null {
    const tables = Array.from(container.querySelectorAll('table'));
    let main: HTMLTableElement | null = null;
    let mainCols = -1;
    tables.forEach((table) => {
      const cols = columnCount(table);
      if (cols > mainCols || (cols === mainCols && main && table.rows.length > main.rows.length)) {
        main = table;
        mainCols = cols;
      }
    });
    tables.forEach((table) => {
      if (table !== main && columnCount(table) < mainCols) {
        table.classList.add(SECONDARY_TABLE_CLASS);
      }
    });
    return main;
  }

  /**
   * Shorter header: the date header becomes "D", and a header cell over an empty one spans both
   * rows (egg payer), so its text can wrap over two rows instead of widening the column.
   */
  private static shortenHeaders(main: HTMLTableElement): void {
    const thead = main.tHead;
    if (!thead || thead.rows.length === 0) return;
    const firstHeaderRow = isTitleRow(thead.rows[0], columnCount(main)) ? 1 : 0;
    const headerRows = thead.rows.length;

    const grid = buildGrid(main).filter((g) => g.row >= firstHeaderRow && g.row < headerRows);
    grid.forEach((top) => {
      if (top.cell.rowSpan !== 1 || !textOf(top.cell)) return;
      const below = grid.find(
        (g) =>
          g.row === top.row + 1 &&
          g.col === top.col &&
          g.cell.colSpan === top.cell.colSpan &&
          g.cell.rowSpan === 1 &&
          !textOf(g.cell)
      );
      if (below) {
        top.cell.rowSpan = 2;
        below.cell.remove();
      }
    });

    const date = buildGrid(main).find(
      (g) => g.col === 0 && g.row >= firstHeaderRow && g.row < headerRows && textOf(g.cell)
    );
    if (date) date.cell.textContent = 'D';
  }

  /** Mark title cells and the cells with Kannada text, which is drawn a little larger */
  private static markText(container: Element): void {
    container.querySelectorAll('table').forEach((table) => {
      const first = table.rows[0];
      if (isTitleRow(first, columnCount(table))) first.cells[0].classList.add(TITLE_CLASS);
    });
    container.querySelectorAll<HTMLElement>('td, th').forEach((cell) => {
      if (KANNADA.test(cell.textContent || '')) cell.classList.add(KANNADA_CLASS);
    });
  }

  /**
   * Minimum widths that keep a column readable when its values are short: the date column is
   * 2 digits, the egg M/F and the children count columns 3 digits. Everything else is as wide as
   * its widest value.
   */
  private static sizeColumns(container: HTMLElement, main: HTMLTableElement): void {
    const sample = main.tBodies[0]?.rows[0]?.cells[0] ?? main.rows[0]?.cells[0];
    if (!sample) return;
    // Padding differs per cell (doubled next to a separator line), so it is added per cell below
    const digits = (n: number) => textWidth(container, sample, '0'.repeat(n));
    const thead = main.tHead;
    const headerRows = thead ? thead.rows.length : 0;

    const threeDigitCols = new Set<number>();
    const grid = buildGrid(main);
    grid
      .filter((g) => g.row < headerRows && g.cell.colSpan === 1)
      .forEach((g) => {
        const text = textOf(g.cell);
        if (/^[MF]$/.test(text) || text.includes('ಮಕ್ಕಳ')) threeDigitCols.add(g.col);
      });

    grid.forEach((g) => {
      if (g.cell.colSpan !== 1) return;
      if (g.col === 0) raiseMinWidth(g.cell, digits(2) + cellExtra(g.cell));
      if (threeDigitCols.has(g.col)) raiseMinWidth(g.cell, digits(3) + cellExtra(g.cell));
    });
  }

  /**
   * Shade every second date. A date starts at each body row with a cell in the first column and
   * includes the rows that cell spans (meal and stock have two rows per date).
   */
  private static shadeAlternateDates(main: HTMLTableElement): void {
    const firstBodyRow = main.tHead ? main.tHead.rows.length : 0;
    const bodyRows = Array.from(main.tBodies).reduce((sum, body) => sum + body.rows.length, 0);
    const body = buildGrid(main).filter((g) => g.row >= firstBodyRow && g.row < firstBodyRow + bodyRows);
    const dateRows = body.filter((g) => g.col === 0).map((g) => g.row);
    body.forEach((g) => {
      const dateIndex = dateRows.filter((row) => row <= g.row).length - 1;
      if (dateIndex % 2 === 1) g.cell.classList.add(ALT_DATE_CLASS);
    });
  }

  /**
   * Header cells wrap between words (CSS keeps every word whole). A header with many words must
   * still not need more than MAX_HEADER_LINES lines, so its column is widened until it fits.
   */
  private static fitHeaders(container: HTMLElement): void {
    const heads = Array.from(container.querySelectorAll<HTMLTableCellElement>('thead th'));

    for (let pass = 0; pass < HEADER_PASSES; pass++) {
      const tooTall = heads.filter((th) => lineCount(th) > MAX_HEADER_LINES);
      if (tooTall.length === 0) break;
      // Measure first, then change: every width is read before the layout is touched
      const widths = tooTall.map((th) => th.getBoundingClientRect().width);
      tooTall.forEach((th, i) => raiseMinWidth(th, widths[i] + HEADER_STEP));
    }
  }

  /**
   * Measure the rendered container: its size, the legal row cuts, the header and title rows and
   * the main column groups.
   */
  private static measure(container: HTMLElement, main: HTMLTableElement | null): PDFMeasure {
    const base = container.getBoundingClientRect();
    const vertical = (el: Element): PDFRange => {
      const r = el.getBoundingClientRect();
      return { top: r.top - base.top, bottom: r.bottom - base.top };
    };
    const width = Math.ceil(base.width);
    const height = Math.ceil(base.height);

    const cells = Array.from(container.querySelectorAll('td, th')).map(vertical);
    const heads = Array.from(container.querySelectorAll('thead')).map(vertical);
    const feet = Array.from(container.querySelectorAll('tfoot')).map(vertical);
    const candidates: number[] = [];
    Array.from(container.querySelectorAll('tr')).forEach((tr) => {
      const r = vertical(tr);
      candidates.push(r.top, r.bottom);
    });

    // A page may end where no cell (rowSpan!) crosses, not inside a thead, and not right above a
    // tfoot (the totals always stay with at least one data row)
    const legal = (y: number) =>
      !cells.some((c) => c.top < y - EPS && c.bottom > y + EPS) &&
      !heads.some((h) => y > h.top + EPS && y <= h.bottom + EPS) &&
      !feet.some((f) => y > f.top - EPS && y <= f.bottom + EPS);

    const cutPoints: number[] = [];
    candidates
      .filter((y) => y > 0 && y < height && legal(y))
      .sort((a, b) => a - b)
      .forEach((y) => {
        if (cutPoints.length === 0 || y - cutPoints[cutPoints.length - 1] > 0.5) cutPoints.push(y);
      });

    let title: PDFMeasure['title'] = null;
    let header: PDFRange | null = null;
    const thead = main?.tHead;
    if (main && thead && thead.rows.length > 0) {
      const all = vertical(thead);
      const firstRow = thead.rows[0];
      if (isTitleRow(firstRow, columnCount(main))) {
        const rows = vertical(firstRow);
        const range = container.ownerDocument.createRange();
        range.selectNodeContents(firstRow.cells[0]);
        const text = range.getBoundingClientRect();
        const cell = firstRow.cells[0].getBoundingClientRect();
        const box = text.width > 0 ? text : cell;
        title = { ...rows, center: (box.left + box.right) / 2 - base.left };
      }
      const top = title ? title.bottom : all.top;
      if (all.bottom - top > 1) header = { top, bottom: all.bottom };
    }

    // Column groups: a group starts at a column whose cells carry .grp-l (the first column excluded)
    const units: PDFSpan[] = [];
    if (main) {
      const grid = buildGrid(main);
      const lefts = new Map<number, number>();
      grid.forEach(({ cell, col }) => {
        const x = cell.getBoundingClientRect().left - base.left;
        if (!lefts.has(col) || x < lefts.get(col)!) lefts.set(col, x);
      });
      const tableRight = Math.max(...grid.map((g) => g.cell.getBoundingClientRect().right)) - base.left;
      const starts = Array.from(new Set(grid.filter((g) => g.col > 0 && g.cell.classList.contains('grp-l')).map((g) => g.col))).sort((a, b) => a - b);
      starts.forEach((col, i) => {
        const left = lefts.get(col);
        const right = i + 1 < starts.length ? lefts.get(starts[i + 1]) : tableRight;
        if (left !== undefined && right !== undefined) units.push({ left, right });
      });
    }

    return { width, height, cutPoints, header, title, units };
  }

  /**
   * Process the cloned document for PDF rendering. Called from html2canvas' onclone.
   * @param container the cloned element that is rendered
   */
  static processClonedDocument(
    clonedDoc: Document,
    container: HTMLElement,
    styles: PDFStyleManager,
    inputs: InputSnapshot[]
  ): PDFMeasure {
    clonedDoc.documentElement.setAttribute('data-theme', 'light');
    clonedDoc.querySelectorAll(IGNORE_SELECTOR).forEach((el) => el.remove());

    // Render only the container, at the top-left of an empty white page
    clonedDoc.documentElement.style.background = '#fff';
    clonedDoc.body.style.cssText = 'margin:0;padding:0;background:#fff;';
    clonedDoc.body.replaceChildren(container);

    // Always 100%: the pages zoom the table with transform: scale
    container.style.setProperty('transform', 'none', 'important');
    container.classList.add(CONTAINER_CLASS);
    styles.applyTo(clonedDoc);

    this.replaceInputs(container, inputs);
    this.replaceButtonGroups(container);
    const main = this.findMainTable(container);
    if (main) this.shortenHeaders(main);
    this.markText(container);
    if (main) {
      this.shadeAlternateDates(main);
      this.sizeColumns(container, main);
    }
    this.fitHeaders(container);

    return this.measure(container, main);
  }
}
