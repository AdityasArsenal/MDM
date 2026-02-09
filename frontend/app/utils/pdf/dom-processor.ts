/**
 * DOM Processor
 * Handles DOM manipulation for PDF export
 */

export class DOMProcessor {
  /**
   * Replace input elements with their values for PDF rendering
   */
  static replaceInputs(container: Element): void {
    const inputs = container.querySelectorAll('input');
    inputs.forEach((input: HTMLInputElement) => {
      const value = input.value || '0';
      const span = document.createElement('span');
      span.textContent = value;
      span.style.cssText = 'display:inline-block;width:100%;text-align:center;font-size:11px';
      input.parentNode?.replaceChild(span, input);
    });
  }

  /**
   * Replace button groups with selected button text
   */
  static replaceButtonGroups(container: Element): void {
    const buttonGroups = container.querySelectorAll('.flex.flex-col.gap-1');
    buttonGroups.forEach((group) => {
      const selectedButton = group.querySelector(
        'button.bg-blue-500, button.bg-orange-500, button.bg-green-500, button.bg-red-500, button.bg-purple-500'
      );
      
      if (selectedButton) {
        const span = document.createElement('span');
        span.textContent = selectedButton.textContent || '';
        span.style.cssText = 'display:inline-block;width:100%;text-align:center;font-size:10px';
        group.parentNode?.replaceChild(span, group);
      }
    });
  }

  /**
   * Process cloned document for PDF rendering
   */
  static processClonedDocument(clonedDoc: Document): void {
    const container = clonedDoc.querySelector('.pdf-export-container');
    if (!container) return;

    this.replaceInputs(container);
    this.replaceButtonGroups(container);
  }
}
