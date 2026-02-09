/**
 * PDF Styles Manager
 * Handles dynamic style injection and cleanup
 */

import { PDFStyleConfig } from './types';

const STYLE_ID = 'pdf-export-styles';

const DEFAULT_CONFIG: PDFStyleConfig = {
  fontSize: {
    header: 12,
    body: 11,
    small: 9,
  },
  colors: {
    border: '#333',
    headerBg: '#f5f5f5',
    text: '#000',
  },
  spacing: {
    cellPadding: '4px 2px',
    tablePadding: '15px',
  },
};

export class PDFStyleManager {
  private styleElement: HTMLStyleElement | null = null;
  private config: PDFStyleConfig;

  constructor(config?: Partial<PDFStyleConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  inject(): void {
    this.remove(); // Clean up any existing styles

    this.styleElement = document.createElement('style');
    this.styleElement.id = STYLE_ID;
    this.styleElement.textContent = this.generateStyles();
    document.head.appendChild(this.styleElement);
  }

  remove(): void {
    const existing = document.getElementById(STYLE_ID);
    if (existing) {
      existing.remove();
    }
    this.styleElement = null;
  }

  private generateStyles(): string {
    const { fontSize, colors, spacing } = this.config;

    return `
      .pdf-export-container {
        background: white !important;
        color: ${colors.text} !important;
        font-family: 'Arial', sans-serif !important;
        padding: ${spacing.tablePadding} !important;
        box-sizing: border-box !important;
        width: 794px !important;
        max-width: none !important;
      }
      
      .pdf-export-container * {
        background: white !important;
        color: ${colors.text} !important;
        border-color: ${colors.border} !important;
        box-shadow: none !important;
      }
      
      .pdf-export-container table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: ${fontSize.body}px !important;
        line-height: 1.4 !important;
        table-layout: fixed !important;
      }
      
      .pdf-export-container th,
      .pdf-export-container td {
        padding: ${spacing.cellPadding} !important;
        border: 1px solid ${colors.border} !important;
        text-align: center !important;
        word-wrap: break-word !important;
        font-size: ${fontSize.body}px !important;
        vertical-align: middle !important;
      }
      
      .pdf-export-container th {
        background: ${colors.headerBg} !important;
        font-weight: bold !important;
        font-size: ${fontSize.header}px !important;
      }

      .pdf-export-container thead th,
      .pdf-export-container thead td {
        background: ${colors.headerBg} !important;
      }

      .pdf-export-container input {
        font-size: ${fontSize.body}px !important;
        border: none !important;
        text-align: center !important;
        background: transparent !important;
        width: 100% !important;
      }
      
      .pdf-export-container button {
        font-size: ${fontSize.small}px !important;
        padding: 2px 4px !important;
      }

      .pdf-export-container .lucide,
      .pdf-export-container svg {
        display: none !important;
      }
      
      .pdf-export-container .table,
      .pdf-export-container .table-header,
      .pdf-export-container .table-body,
      .pdf-export-container .table-row,
      .pdf-export-container .table-head,
      .pdf-export-container .table-cell,
      .pdf-export-container .table-footer {
        display: table !important;
        width: 100% !important;
      }
      
      .pdf-export-container .table-header,
      .pdf-export-container .table-body,
      .pdf-export-container .table-footer {
        display: table-row-group !important;
      }
      
      .pdf-export-container .table-row {
        display: table-row !important;
      }
      
      .pdf-export-container .table-head,
      .pdf-export-container .table-cell {
        display: table-cell !important;
      }
    `;
  }
}
