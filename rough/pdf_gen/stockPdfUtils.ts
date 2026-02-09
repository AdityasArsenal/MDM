import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Type definitions (ensure these match your application's types)
interface StockItem {
  rice: number;
  wheat: number;
  oil: number;
  pulses: number;
}

interface StockSheetRow {
  id: number;
  date: Date;
  added_1to5: StockItem;
  added_6to8: StockItem;
}

type MealType = 'rice' | 'wheat' | null;

interface SheetTableRow {
  id: number;
  date: Date;
  count1to5: number;
  count6to8: number;
  mealType: MealType;
  includesPulses?: boolean;
}

const emptyStockItem = (): StockItem => ({ rice: 0, wheat: 0, oil: 0, pulses: 0 });

const calculateMealFromSheet1 = (
  count: number,
  mealType: MealType,
  includesPulses: boolean,
  isGrade1to5: boolean
) => {
  const riceVal = isGrade1to5 ? 0.1 : 0.15;
  const wheatVal = isGrade1to5 ? 0.1 : 0.15;
  const oilVal = isGrade1to5 ? 0.005 : 0.0075;
  const pulsesVal = isGrade1to5 ? 0.02 : 0.03;

  if (!mealType) return emptyStockItem();

  return {
    rice: mealType === 'rice' ? count * riceVal : 0,
    wheat: mealType === 'wheat' ? count * wheatVal : 0,
    oil: count * oilVal,
    pulses: includesPulses ? count * pulsesVal : 0,
  };
};

const generateProcessedData = (initialData: StockSheetRow[], sheet1Data: SheetTableRow[]) => {
  const dayToSheet1Row = new Map<number, SheetTableRow>();
  for (const d of sheet1Data || []) {
    const dt = new Date(d.date);
    dayToSheet1Row.set(dt.getDate(), d);
  }

  const rows = initialData.map(row => ({
    id: row.id,
    date: new Date(row.date),
    added_1to5: row.added_1to5 || emptyStockItem(),
    added_6to8: row.added_6to8 || emptyStockItem(),
  }));

  let prevClosing_1to5 = emptyStockItem();
  let prevClosing_6to8 = emptyStockItem();

  return rows.map(dayRow => {
    const sheet1DayData = dayToSheet1Row.get(new Date(dayRow.date).getDate());

    const children_1to5 = sheet1DayData?.count1to5 || 0;
    const children_6to8 = sheet1DayData?.count6to8 || 0;

    const dist_1to5 = sheet1DayData ? calculateMealFromSheet1(sheet1DayData.count1to5, sheet1DayData.mealType, !!sheet1DayData.includesPulses, true) : emptyStockItem();
    const dist_6to8 = sheet1DayData ? calculateMealFromSheet1(sheet1DayData.count6to8, sheet1DayData.mealType, !!sheet1DayData.includesPulses, false) : emptyStockItem();

    const opening_1to5 = prevClosing_1to5;
    const opening_6to8 = prevClosing_6to8;

    const added_1to5 = dayRow.added_1to5;
    const added_6to8 = dayRow.added_6to8;

    const total_1to5 = {
      rice: opening_1to5.rice + added_1to5.rice,
      wheat: opening_1to5.wheat + added_1to5.wheat,
      oil: opening_1to5.oil + added_1to5.oil,
      pulses: opening_1to5.pulses + added_1to5.pulses,
    };
    const total_6to8 = {
      rice: opening_6to8.rice + added_6to8.rice,
      wheat: opening_6to8.wheat + added_6to8.wheat,
      oil: opening_6to8.oil + added_6to8.oil,
      pulses: opening_6to8.pulses + added_6to8.pulses,
    };

    const closing_1to5 = {
      rice: total_1to5.rice - dist_1to5.rice,
      wheat: total_1to5.wheat - dist_1to5.wheat,
      oil: total_1to5.oil - dist_1to5.oil,
      pulses: total_1to5.pulses - dist_1to5.pulses,
    };
    const closing_6to8 = {
      rice: total_6to8.rice - dist_6to8.rice,
      wheat: total_6to8.wheat - dist_6to8.wheat,
      oil: total_6to8.oil - dist_6to8.oil,
      pulses: total_6to8.pulses - dist_6to8.pulses,
    };

    prevClosing_1to5 = closing_1to5;
    prevClosing_6to8 = closing_6to8;

    return {
      ...dayRow,
      children_1to5,
      children_6to8,
      opening_1to5,
      opening_6to8,
      total_1to5,
      total_6to8,
      dist_1to5,
      dist_6to8,
      closing_1to5,
      closing_6to8,
    };
  });
};

export const exportStockSheetToPDF = async (
  initialData: StockSheetRow[],
  sheet1Data: SheetTableRow[],
  selectedMonth: Date
) => {
  const processedData = generateProcessedData(initialData, sheet1Data);

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth(); // 297mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm
  const margin = 8;
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '1600px';
  container.style.background = '#ffffff';
  container.style.zIndex = '999999';
  document.body.appendChild(container);

  const daysPerPage = 10;
  const to3 = (n: number) => (n ?? 0).toFixed(3);
  const chunked: any[][] = [];
  for (let i = 0; i < processedData.length; i += daysPerPage) {
    chunked.push(processedData.slice(i, i + daysPerPage));
  }

  const monthTitle = `${format(selectedMonth, 'MMMM yyyy')} - Stock Management`;

  for (let pageIndex = 0; pageIndex < chunked.length; pageIndex++) {
    const pageDays = chunked[pageIndex];

    const table = document.createElement('div');
    table.style.fontFamily = 'Arial, sans-serif';
    table.style.color = '#000';
    table.style.padding = '10px';
    table.style.boxSizing = 'border-box';
    table.innerHTML = `
      <div style="text-align:center; font-weight:700; font-size:18px; margin-bottom:8px;">${monthTitle}</div>
      <table style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:11px; border:2px solid #333;">
        <thead>
          <tr>
            <th rowspan="2" style="border:2px solid #333; padding:4px;">ದಿನಾಂಕ</th>
            <th rowspan="2" style="border:2px solid #333; padding:4px;">ವಿಭಾಗ</th>
            <th rowspan="2" style="border:2px solid #333; padding:4px;">ಮಕ್ಕಳ ಸಂಖ್ಯೆ</th>
            <th colspan="4" style="border:2px solid #333; padding:4px;">ಆರಂಭಿಕ ಶಿಲ್ಕು</th>
            <th colspan="4" style="border:2px solid #333; padding:4px;">ತಿಂಗಳ ಸ್ವೀಕೃತಿ</th>
            <th colspan="4" style="border:2px solid #333; padding:4px;">ಒಟ್ಟು</th>
            <th colspan="4" style="border:2px solid #333; padding:4px;">ದಿನದ ವಿತರಣೆ</th>
            <th colspan="4" style="border:2px solid #333; padding:4px;">ಅಂತಿಮ ಶಿಲ್ಕು</th>
          </tr>
          <tr>
            <th style="border:1px solid #333; padding:4px;">ಅಕ್ಕಿ</th>
            <th style="border:1px solid #333; padding:4px;">ಗೋಧಿ</th>
            <th style="border:1px solid #333; padding:4px;">ಎಣ್ಣೆ</th>
            <th style="border:1px solid #333; padding:4px;">ಬೇಳೆ</th>
            <th style="border:1px solid #333; padding:4px;">ಅಕ್ಕಿ</th>
            <th style="border:1px solid #333; padding:4px;">ಗೋಧಿ</th>
            <th style="border:1px solid #333; padding:4px;">ಎಣ್ಣೆ</th>
            <th style="border:1px solid #333; padding:4px;">ಬೇಳೆ</th>
            <th style="border:1px solid #333; padding:4px;">ಅಕ್ಕಿ</th>
            <th style="border:1px solid #333; padding:4px;">ಗೋಧಿ</th>
            <th style="border:1px solid #333; padding:4px;">ಎಣ್ಣೆ</th>
            <th style="border:1px solid #333; padding:4px;">ಬೇಳೆ</th>
            <th style="border:1px solid #333; padding:4px;">ಅಕ್ಕಿ</th>
            <th style="border:1px solid #333; padding:4px;">ಗೋಧಿ</th>
            <th style="border:1px solid #333; padding:4px;">ಎಣ್ಣೆ</th>
            <th style="border:1px solid #333; padding:4px;">ಬೇಳೆ</th>
            <th style="border:1px solid #333; padding:4px;">ಅಕ್ಕಿ</th>
            <th style="border:1px solid #333; padding:4px;">ಗೋಧಿ</th>
            <th style="border:1px solid #333; padding:4px;">ಎಣ್ಣೆ</th>
            <th style="border:1px solid #333; padding:4px;">ಬೇಳೆ</th>
          </tr>
        </thead>
        <tbody>
          ${pageDays.map((day) => {
            const opening_total = {
              rice: day.opening_1to5.rice + day.opening_6to8.rice,
              wheat: day.opening_1to5.wheat + day.opening_6to8.wheat,
              oil: day.opening_1to5.oil + day.opening_6to8.oil,
              pulses: day.opening_1to5.pulses + day.opening_6to8.pulses,
            };
            const added_total = {
              rice: day.added_1to5.rice + day.added_6to8.rice,
              wheat: day.added_1to5.wheat + day.added_6to8.wheat,
              oil: day.added_1to5.oil + day.added_6to8.oil,
              pulses: day.added_1to5.pulses + day.added_6to8.pulses,
            };
            const total_total = {
              rice: day.total_1to5.rice + day.total_6to8.rice,
              wheat: day.total_1to5.wheat + day.total_6to8.wheat,
              oil: day.total_1to5.oil + day.total_6to8.oil,
              pulses: day.total_1to5.pulses + day.total_6to8.pulses,
            };
            const dist_total = {
              rice: day.dist_1to5.rice + day.dist_6to8.rice,
              wheat: day.dist_1to5.wheat + day.dist_6to8.wheat,
              oil: day.dist_1to5.oil + day.dist_6to8.oil,
              pulses: day.dist_1to5.pulses + day.dist_6to8.pulses,
            };
            const closing_total = {
              rice: day.closing_1to5.rice + day.closing_6to8.rice,
              wheat: day.closing_1to5.wheat + day.closing_6to8.wheat,
              oil: day.closing_1to5.oil + day.closing_6to8.oil,
              pulses: day.closing_1to5.pulses + day.closing_6to8.pulses,
            };

            const dayStr = format(day.date, 'dd/MM/yyyy');
            const weekday = format(day.date, 'EEE');

            const r = (cells: string[]) => `<td style="border:1px solid #333; padding:3px; text-align:center;">${cells.join('</td><td style="border:1px solid #333; padding:3px; text-align:center;">')}</td>`;

            return `
              <tr>
                <td rowspan="3" style="border:1px solid #333; padding:4px; font-weight:600;">${dayStr}<div style="font-size:9px; color:#555;">${weekday}</div></td>
                <td style="border:1px solid #333; padding:3px;">1-5</td>
                ${r([
                  String(day.children_1to5),
                  to3(day.opening_1to5.rice), to3(day.opening_1to5.wheat), to3(day.opening_1to5.oil), to3(day.opening_1to5.pulses),
                  to3(day.added_1to5.rice), to3(day.added_1to5.wheat), to3(day.added_1to5.oil), to3(day.added_1to5.pulses),
                  to3(day.total_1to5.rice), to3(day.total_1to5.wheat), to3(day.total_1to5.oil), to3(day.total_1to5.pulses),
                  to3(day.dist_1to5.rice), to3(day.dist_1to5.wheat), to3(day.dist_1to5.oil), to3(day.dist_1to5.pulses),
                  to3(day.closing_1to5.rice), to3(day.closing_1to5.wheat), to3(day.closing_1to5.oil), to3(day.closing_1to5.pulses)
                ])}
              </tr>
              <tr>
                <td style="border:1px solid #333; padding:3px;">6-10</td>
                ${r([
                  String(day.children_6to8),
                  to3(day.opening_6to8.rice), to3(day.opening_6to8.wheat), to3(day.opening_6to8.oil), to3(day.opening_6to8.pulses),
                  to3(day.added_6to8.rice), to3(day.added_6to8.wheat), to3(day.added_6to8.oil), to3(day.added_6to8.pulses),
                  to3(day.total_6to8.rice), to3(day.total_6to8.wheat), to3(day.total_6to8.oil), to3(day.total_6to8.pulses),
                  to3(day.dist_6to8.rice), to3(day.dist_6to8.wheat), to3(day.dist_6to8.oil), to3(day.dist_6to8.pulses),
                  to3(day.closing_6to8.rice), to3(day.closing_6to8.wheat), to3(day.closing_6to8.oil), to3(day.closing_6to8.pulses)
                ])}
              </tr>
              <tr style="font-weight:700; background:#f2f2f2; font-size:13px; border-top:2px solid #333;">
                <td style="border:2px solid #333; padding:3px; color:#333;">ಒಟ್ಟು</td>
                ${r([
                  String(day.children_1to5 + day.children_6to8),
                  to3(opening_total.rice), to3(opening_total.wheat), to3(opening_total.oil), to3(opening_total.pulses),
                  to3(added_total.rice), to3(added_total.wheat), to3(added_total.oil), to3(added_total.pulses),
                  to3(total_total.rice), to3(total_total.wheat), to3(total_total.oil), to3(total_total.pulses),
                  to3(dist_total.rice), to3(dist_total.wheat), to3(dist_total.oil), to3(dist_total.pulses),
                  to3(closing_total.rice), to3(closing_total.wheat), to3(closing_total.oil), to3(closing_total.pulses)
                ]).replace(/td/g, 'td style="border:2px solid #333; padding:3px; background:#f2f2f2;"')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    container.innerHTML = '';
    container.appendChild(table);

    await new Promise((r) => setTimeout(r, 150));

    const canvas = await html2canvas(table, { scale: 1.5, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/jpeg', 0.85);

    const imgWidth = availableWidth;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;

    if (pageIndex > 0) pdf.addPage();
    const x = (pageWidth - imgWidth) / 2;
    const y = (pageHeight - Math.min(imgHeight, availableHeight)) / 2;
    pdf.addImage(imgData, 'JPEG', x, y, imgWidth, Math.min(imgHeight, availableHeight));
  }

  const monthName = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const fileName = `Stock_Management_${monthName.replace(' ', '_')}.pdf`;
  pdf.save(fileName);

  document.body.removeChild(container);
};
