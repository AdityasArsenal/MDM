import { RefObject } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// This function adds temporary styles to the document for PDF printing.
const addPrintStyles = () => {
  const existingStyle = document.getElementById('pdf-print-styles');
  if (existingStyle) {
    existingStyle.remove();
  }

  const style = document.createElement('style');
  style.id = 'pdf-print-styles';
  style.textContent = `
    .pdf-container {
      background: white !important;
      color: black !important;
      font-family: 'Arial', sans-serif !important;
      padding: 15px !important;
      box-sizing: border-box !important;
      overflow: visible !important;
      width: 794px !important; /* A4 width in pixels at 96 DPI (210mm) */
      max-width: none !important;
      min-height: 1123px !important; /* A4 height in pixels at 96 DPI (297mm) */
    }
    
    .pdf-container * {
      background: white !important;
      color: black !important;
      border-color: #333 !important;
      box-shadow: none !important;
    }
    
    .pdf-container table {
      width: 100% !important;
      border-collapse: collapse !important;
      font-size: 12px !important;
      line-height: 1.4 !important;
      table-layout: fixed !important;
      margin-bottom: 10px !important;
    }
    
    .pdf-container th,
    .pdf-container td {
      padding: 4px 2px !important;
      border: 1px solid #333 !important;
      text-align: center !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      white-space: normal !important;
      font-size: 11px !important;
      max-width: none !important;
      min-width: 0 !important;
      vertical-align: middle !important;
    }
    
    .pdf-container th {
      background: #f5f5f5 !important;
      font-weight: bold !important;
      font-size: 12px !important;
    }

    .pdf-container .date-cell .day {
      font-size: 9px !important;
      color: #666 !important;
    }

    .pdf-container .date-cell .date {
      font-size: 14px !important;
      font-weight: bold !important;
    }

    .pdf-container thead th,
    .pdf-container thead td,
    .pdf-container thead th *,
    .pdf-container thead td * {
      background: #f5f5f5 !important;
    }

    .pdf-container input {
      font-size: 11px !important;
      border: none !important;
      text-align: center !important;
      background: transparent !important;
      width: 100% !important;
    }
    
    .pdf-container button {
      font-size: 10px !important;
      padding: 2px 4px !important;
    }

    .pdf-container .card {
      border: 2px solid #333 !important;
      border-radius: 4px !important;
      margin: 8px 0 !important;
      page-break-inside: avoid !important;
    }
    
    .pdf-container .card-header {
      border-bottom: 1px solid #333 !important;
      padding: 6px !important;
      background: #f8f8f8 !important;
    }
    
    .pdf-container .card-title {
      font-size: 14px !important;
      font-weight: bold !important;
      margin: 0 !important;
    }
    
    .pdf-container .card-content {
      padding: 5px !important;
    }
    
    .pdf-container .summary-section {
      margin: 15px 0 !important;
      padding: 8px !important;
      border: 2px solid #333 !important;
      background: #f9f9f9 !important;
      page-break-inside: avoid !important;
    }
    
    .pdf-container .date-cell {
      font-weight: bold !important;
      background: #f0f0f0 !important;
    }
    
    .pdf-container .total-row {
      font-weight: bold !important;
      background: #e8e8e8 !important;
    }
    
    .pdf-container .lucide,
    .pdf-container svg {
      display: none !important;
    }
    
    .pdf-container .table,
    .pdf-container .table-header,
    .pdf-container .table-body,
    .pdf-container .table-row,
    .pdf-container .table-head,
    .pdf-container .table-cell,
    .pdf-container .table-footer {
      display: table !important;
      width: 100% !important;
      table-layout: fixed !important;
    }
    
    .pdf-container .table-header,
    .pdf-container .table-body,
    .pdf-container .table-footer {
      display: table-row-group !important;
    }
    
    .pdf-container .table-row {
      display: table-row !important;
    }
    
    .pdf-container .table-head,
    .pdf-container .table-cell {
      display: table-cell !important;
    }

    /* Ensure proper page breaks */
    .pdf-container {
      page-break-after: avoid !important;
    }
  `;
  document.head.appendChild(style);
};

// This function removes the temporary styles after printing.
const removePrintStyles = () => {
  const style = document.getElementById('pdf-print-styles');
  if (style) {
    style.remove();
  }
};

// The main function to handle the print/export action.
export const handlePrint = async (
  printRef: RefObject<HTMLDivElement>,
  toast: (options: { variant?: "default" | "destructive" | null, title: string, description: string }) => void,
  selectedSheet: string,
  selectedMonth: Date
) => {
  const input = printRef.current;
  if (!input) {
    toast({
      variant: "destructive",
      title: "Export Failed",
      description: "No content found to export.",
    });
    return;
  }

  const originalTheme = document.documentElement.getAttribute('data-theme');
  const originalClass = input.className;

  try {
    document.documentElement.setAttribute('data-theme', 'light');
    addPrintStyles();
    input.className = `${originalClass} pdf-container`;

    // Wait for styles to apply
    await new Promise(resolve => setTimeout(resolve, 700));

    const canvas = await html2canvas(input, {
      scale: 2, // High quality scaling
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      windowWidth: 794, // A4 width in pixels
      windowHeight: 1123, // A4 height in pixels
      width: 794,
      height: input.scrollHeight, // Use actual content height
      onclone: (clonedDoc) => {
        const clonedInput = clonedDoc.querySelector('.pdf-container');
        if (clonedInput) {
          // Replace inputs with their values
          const inputs = clonedInput.querySelectorAll('input');
          inputs.forEach((input: HTMLInputElement) => {
            const value = input.value || '0';
            const span = clonedDoc.createElement('span');
            span.textContent = value;
            span.style.display = 'inline-block';
            span.style.width = '100%';
            span.style.textAlign = 'center';
            span.style.fontSize = '11px';
            input.parentNode?.replaceChild(span, input);
          });

          // Replace button groups with selected text
          const buttonGroups = clonedInput.querySelectorAll('.flex.flex-col.gap-1');
          buttonGroups.forEach((group) => {
            const selectedButton = group.querySelector(
              'button.bg-blue-500, button.bg-orange-500, button.bg-green-500, button.bg-red-500, button.bg-purple-500'
            );
            if (selectedButton) {
              const span = clonedDoc.createElement('span');
              span.textContent = selectedButton.textContent || '';
              span.style.display = 'inline-block';
              span.style.width = '100%';
              span.style.textAlign = 'center';
              span.style.fontSize = '10px';
              group.parentNode?.replaceChild(span, group);
            }
          });
        }
      },
    });

    const imgData = canvas.toDataURL('image/png', 1.0); // High quality PNG

    const pdf = new jsPDF({
      orientation: 'portrait', // Explicitly set portrait
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    // A4 dimensions in mm
    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm
    const margin = 10; // 10mm margin

    // Calculate dimensions to fit content within A4 portrait with margins
    const availableWidth = pdfWidth - (2 * margin); // 190mm
    const availableHeight = pdfHeight - (2 * margin); // 277mm

    // Calculate scaling based on canvas dimensions
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const canvasAspectRatio = canvasWidth / canvasHeight;

    // Scale to fit width first
    let imgWidth = availableWidth;
    let imgHeight = availableWidth / canvasAspectRatio;

    // If height exceeds available height, scale down further
    if (imgHeight > availableHeight) {
      imgHeight = availableHeight;
      imgWidth = availableHeight * canvasAspectRatio;
    }

    // Center the content on the page
    const x = (pdfWidth - imgWidth) / 2;
    const y = (pdfHeight - imgHeight) / 2;

    // Handle multiple pages if content is too tall
    if (canvasHeight > canvasWidth * (availableHeight / availableWidth)) {
      // Content is too tall for single page, need to split
      const pageHeight = availableHeight;
      const scaleFactor = availableWidth / canvasWidth;
      const scaledCanvasHeight = canvasHeight * scaleFactor;
      const pagesNeeded = Math.ceil(scaledCanvasHeight / pageHeight);

      for (let page = 0; page < pagesNeeded; page++) {
        if (page > 0) {
          pdf.addPage();
        }

        const sourceY = (page * pageHeight) / scaleFactor;
        const sourceHeight = Math.min(pageHeight / scaleFactor, canvasHeight - sourceY);
        
        // Create a temporary canvas for this page section
        const pageCanvas = document.createElement('canvas');
        const pageCtx = pageCanvas.getContext('2d');
        pageCanvas.width = canvasWidth;
        pageCanvas.height = sourceHeight * (canvas.width / canvasWidth);
        
        if (pageCtx) {
          pageCtx.drawImage(
            canvas,
            0, sourceY * (canvas.height / canvasHeight),
            canvas.width, sourceHeight * (canvas.height / canvasHeight),
            0, 0,
            pageCanvas.width, pageCanvas.height
          );
          
          const pageImgData = pageCanvas.toDataURL('image/png', 1.0);
          const pageImgHeight = Math.min(pageHeight, scaledCanvasHeight - (page * pageHeight));
          
          pdf.addImage(pageImgData, 'PNG', margin, margin, availableWidth, pageImgHeight);
        }
      }
    } else {
      // Single page - fit entire content
      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
    }

    const monthName = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    // Sanitize sheet name for filename: replace spaces with underscores, remove unsafe chars, allow Unicode
    const sanitizedSheetName = selectedSheet.replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_-]/gu, '');
    const fileName = `${sanitizedSheetName}_${monthName.replace(' ', '_')}.pdf`;

    pdf.save(fileName);

    toast({
      title: "Export Successful",
      description: `The report has been saved as ${fileName}`,
    });

  } catch (error: any) {
    console.error('PDF Export Error:', error);
    toast({
      variant: "destructive",
      title: "Export Failed",
      description: error.message || "An unexpected error occurred during PDF export.",
    });
  } finally {
    if (input) {
      input.className = originalClass;
    }
    if (originalTheme) {
      document.documentElement.setAttribute('data-theme', originalTheme);
    }
    removePrintStyles();
  }
};