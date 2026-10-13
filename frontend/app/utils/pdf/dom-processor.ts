/**
 * DOM Processor
 * Prepares the html2canvas CLONE of the page for PDF rendering and measures its rows.
 * Nothing here touches the live page.
 */

import { PDFLayout, PDFRange } from './types';
import { PDFStyleManager, CONTAINER_CLASS, SECONDARY_TABLE_CLASS } from './styles';

const IGNORE_SELECTOR = '[data-pdf-ignore]';
const SELECTED_BUTTON_SELECTOR =
  'button.bg-blue-500, button.bg-orange-500, button.bg-green-500, button.bg-red-500, button.bg-purple-500, button[aria-pressed="true"]';
/** Tolerance in px for collapsed borders and sub-pixel layout */
const EPS = 1.5;

export interface InputSnapshot {
  value: string;
  type: string;
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
  static replaceInputs(container: Element, snapshots: InputSnapshot[]): void {
    const doc = container.ownerDocument;
    const inputs = Array.from(container.querySelectorAll('input'));
    inputs.forEach((input, index) => {
      const snap = snapshots[index];
      const type = snap?.type ?? input.type;
      if (type === 'hidden') {
        input.remove();
        return;
      }
      const raw = snap?.value ?? input.value;
      const value = raw !== '' ? raw : type === 'number' ? '0' : '';
      const span = doc.createElement('span');
      span.textContent = value;
      span.style.cssText = 'display:inline-block;width:100%;text-align:center;font-size:11px';
      input.parentNode?.replaceChild(span, input);
    });
  }

  /**
   * Replace button groups (meal type, yes/no) with the selected button's text.
   * A group with nothing selected becomes empty.
   */
  static replaceButtonGroups(container: Element): void {
    const doc = container.ownerDocument;
    const groups = Array.from(container.querySelectorAll('.flex.flex-col.gap-1')).filter((group) =>
      group.querySelector('button')
    );
    groups.forEach((group) => {
      const selected = group.querySelector(SELECTED_BUTTON_SELECTOR);
      const span = doc.createElement('span');
      span.textContent = (selected?.textContent || '').replace(/[✓✔]/g, '').trim();
      span.style.cssText = 'display:inline-block;width:100%;text-align:center;font-size:11px;font-weight:600';
      group.parentNode?.replaceChild(span, group);
    });
  }

  /** Number of grid columns of a table (widest row, colspans counted) */
  private static columnCount(table: HTMLTableElement): number {
    let max = 0;
    Array.from(table.rows).forEach((row) => {
      const cols = Array.from(row.cells).reduce((sum, cell) => sum + (cell.colSpan || 1), 0);
      if (cols > max) max = cols;
    });
    return max;
  }

  /** The main table is the widest one (most columns, then most rows). Others get the secondary class. */
  private static findMainTable(container: Element): HTMLTableElement | null {
    const tables = Array.from(container.querySelectorAll('table'));
    let main: HTMLTableElement | null = null;
    let mainCols = -1;
    tables.forEach((table) => {
      const cols = this.columnCount(table);
      if (cols > mainCols || (cols === mainCols && main && table.rows.length > main.rows.length)) {
        main = table;
        mainCols = cols;
      }
    });
    tables.forEach((table) => {
      if (table !== main && this.columnCount(table) < mainCols) {
        table.classList.add(SECONDARY_TABLE_CLASS);
      }
    });
    return main;
  }

  /**
   * Measure the rendered container: where the page may be cut and where the header is.
   * A cut is legal at a row boundary that no cell (rowSpan!) crosses and that is not inside a thead.
   */
  static measure(container: HTMLElement, mainTable: HTMLTableElement | null): PDFLayout {
    const base = container.getBoundingClientRect();
    const rel = (el: Element): PDFRange => {
      const r = el.getBoundingClientRect();
      return { top: r.top - base.top, bottom: r.bottom - base.top };
    };

    const cells = Array.from(container.querySelectorAll('td, th')).map(rel);
    const heads = Array.from(container.querySelectorAll('thead')).map(rel);
    const candidates: number[] = [];
    Array.from(container.querySelectorAll('tr')).forEach((tr) => {
      const r = rel(tr);
      candidates.push(r.top, r.bottom);
    });

    const legal = (y: number) =>
      !cells.some((c) => c.top < y - EPS && c.bottom > y + EPS) &&
      !heads.some((h) => y > h.top + EPS && y <= h.bottom + EPS);

    const cutPoints: number[] = [];
    candidates
      .filter((y) => y > 0 && y < base.height && legal(y))
      .sort((a, b) => a - b)
      .forEach((y) => {
        if (cutPoints.length === 0 || y - cutPoints[cutPoints.length - 1] > 0.5) cutPoints.push(y);
      });

    return {
      width: base.width,
      height: base.height,
      cutPoints,
      header: mainTable?.tHead ? rel(mainTable.tHead) : null,
    };
  }

  /**
   * Process cloned document for PDF rendering. Called from html2canvas' onclone.
   * @param container the cloned element that is rendered
   */
  static processClonedDocument(
    clonedDoc: Document,
    container: HTMLElement,
    styles: PDFStyleManager,
    inputs: InputSnapshot[],
    minRenderWidth: number
  ): PDFLayout {
    clonedDoc.documentElement.setAttribute('data-theme', 'light');
    clonedDoc.querySelectorAll(IGNORE_SELECTOR).forEach((el) => el.remove());

    // Render only the container, at the top-left of an empty white page
    clonedDoc.documentElement.style.background = '#fff';
    clonedDoc.body.style.cssText = 'margin:0;padding:0;background:#fff;';
    clonedDoc.body.replaceChildren(container);

    // Always 100%: the pages zoom the table with transform: scale
    container.style.setProperty('transform', 'none', 'important');
    container.classList.add(CONTAINER_CLASS);
    styles.applyTo(clonedDoc, minRenderWidth);

    this.replaceInputs(container, inputs);
    this.replaceButtonGroups(container);
    const mainTable = this.findMainTable(container);

    return this.measure(container, mainTable);
  }
}
