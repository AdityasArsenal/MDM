"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, Share2 } from "lucide-react";
import { ShareButton } from "./ShareButton";
import { format, getDaysInMonth, startOfMonth, getDay, isToday } from "date-fns";
import { SheetTableRow, MealType } from "./sheet-table";

interface StockItem {
  rice: number;
  wheat: number;
  oil: number;
  pulses: number;
}

interface StockSheetRow {
  id: number; // day of month 1-31
  date: Date;
  
  // User input part
  added_1to5: StockItem;
  added_6to8: StockItem;
  
  // Opening stock for 1st day (user input)
  opening_1to5?: StockItem;
  opening_6to8?: StockItem;
}

interface StockSheetProps {
  selectedMonth: Date;
  sheet1Data: SheetTableRow[];
  initialData: StockSheetRow[];
  onTableDataChange: (data: StockSheetRow[]) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

const emptyStockItem = (): StockItem => ({ rice: 0, wheat: 0, oil: 0, pulses: 0 });

export function StockSheetTable({
  selectedMonth,
  sheet1Data,
  initialData,
  onTableDataChange,
  zoom,
  onZoomChange
}: StockSheetProps) {
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  const generateMonthDates = React.useCallback((date: Date): StockSheetRow[] => {
    const daysInMonth = getDaysInMonth(date);
    const monthStart = startOfMonth(date);
    return Array.from({ length: daysInMonth }, (_, i) => {
      const currentDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1, 12, 0, 0);
      const isFirstDay = i + 1 === 1;
      return {
        id: i + 1,
        date: currentDate,
        added_1to5: emptyStockItem(),
        added_6to8: emptyStockItem(),
        // Only include opening stock for the 1st day
        ...(isFirstDay && {
          opening_1to5: emptyStockItem(),
          opening_6to8: emptyStockItem(),
        }),
      };
    });
  }, []);

  const [rows, setRows] = React.useState<StockSheetRow[]>(() => {
    if (initialData && initialData.length > 0) {
      return initialData.map(row => {
        const dateStr = typeof row.date === 'string' ? row.date : row.date.toISOString();
        const dateParts = dateStr.split('T')[0].split('-');
        const safeDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), 12, 0, 0);
        return {
          id: row.id,
          date: safeDate,
          added_1to5: row.added_1to5 || emptyStockItem(),
          added_6to8: row.added_6to8 || emptyStockItem(),
          // Handle opening stock for existing data
          ...(row.id === 1 && {
            opening_1to5: row.opening_1to5 || emptyStockItem(),
            opening_6to8: row.opening_6to8 || emptyStockItem(),
          }),
        };
      });
    }
    return generateMonthDates(selectedMonth);
  });

  React.useEffect(() => {
    if (initialData && initialData.length > 0) {
      const normalized = initialData.map(row => {
        const dateStr = typeof row.date === 'string' ? row.date : row.date.toISOString();
        const dateParts = dateStr.split('T')[0].split('-');
        const safeDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), 12, 0, 0);
        return {
          id: row.id,
          date: safeDate,
          added_1to5: row.added_1to5 || emptyStockItem(),
          added_6to8: row.added_6to8 || emptyStockItem(),
          // Handle opening stock for day 1
          ...(row.id === 1 && {
            opening_1to5: row.opening_1to5 || emptyStockItem(),
            opening_6to8: row.opening_6to8 || emptyStockItem(),
          }),
        };
      });

      // Guard: only update if actually different
      const equal = rows.length === normalized.length && rows.every((r, i) => {
        const n = normalized[i];
        return (
          r.id === n.id &&
          r.date.getTime() === n.date.getTime() &&
          r.added_1to5.rice === n.added_1to5.rice &&
          r.added_1to5.wheat === n.added_1to5.wheat &&
          r.added_1to5.oil === n.added_1to5.oil &&
          r.added_1to5.pulses === n.added_1to5.pulses &&
          r.added_6to8.rice === n.added_6to8.rice &&
          r.added_6to8.wheat === n.added_6to8.wheat &&
          r.added_6to8.oil === n.added_6to8.oil &&
          r.added_6to8.pulses === n.added_6to8.pulses &&
          // Check opening stock for day 1
          (r.id !== 1 || (
            r.opening_1to5?.rice === n.opening_1to5?.rice &&
            r.opening_1to5?.wheat === n.opening_1to5?.wheat &&
            r.opening_1to5?.oil === n.opening_1to5?.oil &&
            r.opening_1to5?.pulses === n.opening_1to5?.pulses &&
            r.opening_6to8?.rice === n.opening_6to8?.rice &&
            r.opening_6to8?.wheat === n.opening_6to8?.wheat &&
            r.opening_6to8?.oil === n.opening_6to8?.oil &&
            r.opening_6to8?.pulses === n.opening_6to8?.pulses
          ))
        );
      });

      if (!equal) {
        setRows(normalized);
      }
    } else {
      setRows(generateMonthDates(selectedMonth));
    }
  }, [selectedMonth, initialData, generateMonthDates, rows]);

  const lastSentRef = React.useRef<string>("{}");
  React.useEffect(() => {
    // Debounce and avoid redundant updates to parent
    const id = setTimeout(() => {
      const serialized = JSON.stringify(rows);
      if (serialized !== lastSentRef.current) {
        lastSentRef.current = serialized;
        onTableDataChange(rows);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [rows, onTableDataChange]);

  // Warn user about unsaved changes
  React.useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = ''; // Standard for browser to show confirmation dialog
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const handleInputChange = React.useCallback((
    dayId: number,
    group: "1to5" | "6to8",
    item: keyof StockItem,
    value: number
  ) => {
    setRows(prevRows => prevRows.map(row => {
      if (row.id === dayId) {
        const safeVal = Number.isFinite(value) ? value : 0;
        const updated_1to5 = group === '1to5' ? { ...row.added_1to5, [item]: safeVal } : row.added_1to5;
        const updated_6to8 = group === '6to8' ? { ...row.added_6to8, [item]: safeVal } : row.added_6to8;
        // Rewrite with fixed key order
        return {
          id: row.id,
          date: row.date,
          added_1to5: updated_1to5,
          added_6to8: updated_6to8,
        } as StockSheetRow;
      }
      return row;
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleOpeningStockChange = React.useCallback((
    dayId: number,
    group: "1to5" | "6to8",
    item: keyof StockItem,
    value: number
  ) => {
    if (dayId !== 1) return; // Only allow opening stock changes for day 1
    
    setRows(prevRows => prevRows.map(row => {
      if (row.id === dayId) {
        const safeVal = Number.isFinite(value) ? value : 0;
        const groupKey = group === '1to5' ? 'opening_1to5' : 'opening_6to8';
        const currentStock = row[groupKey] || emptyStockItem();
        
        return {
          ...row,
          [groupKey]: { ...currentStock, [item]: safeVal }
        };
      }
      return row;
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Move helper above usage to avoid TDZ errors and for reuse
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

  // Index sheet1 data by day number for O(1) lookups
  const dayToSheet1Row = React.useMemo(() => {
    const map = new Map<number, SheetTableRow>();
    for (const d of sheet1Data || []) {
      const dt = new Date(d.date);
      map.set(dt.getDate(), d);
    }
    return map;
  }, [sheet1Data]);

  const processedData = React.useMemo(() => {
    let prevClosing_1to5 = emptyStockItem();
    let prevClosing_6to8 = emptyStockItem();

    return rows.map(dayRow => {
      const sheet1DayData = dayToSheet1Row.get(dayRow.date.getDate());

      const children_1to5 = sheet1DayData?.count1to5 || 0;
      const children_6to8 = sheet1DayData?.count6to8 || 0;
      
      const dist_1to5 = sheet1DayData ? calculateMealFromSheet1(sheet1DayData.count1to5, sheet1DayData.mealType, !!sheet1DayData.includesPulses, true) : emptyStockItem();
      const dist_6to8 = sheet1DayData ? calculateMealFromSheet1(sheet1DayData.count6to8, sheet1DayData.mealType, !!sheet1DayData.includesPulses, false) : emptyStockItem();
      
      // Use user-provided opening stock for day 1, otherwise use previous closing
      let opening_1to5, opening_6to8;
      if (dayRow.id === 1) {
        opening_1to5 = dayRow.opening_1to5 || emptyStockItem();
        opening_6to8 = dayRow.opening_6to8 || emptyStockItem();
      } else {
        opening_1to5 = prevClosing_1to5;
        opening_6to8 = prevClosing_6to8;
      }

      const added_1to5 = {
        rice: Number(dayRow.added_1to5.rice) || 0,
        wheat: Number(dayRow.added_1to5.wheat) || 0,
        oil: Number(dayRow.added_1to5.oil) || 0,
        pulses: Number(dayRow.added_1to5.pulses) || 0,
      };
      const added_6to8 = {
        rice: Number(dayRow.added_6to8.rice) || 0,
        wheat: Number(dayRow.added_6to8.wheat) || 0,
        oil: Number(dayRow.added_6to8.oil) || 0,
        pulses: Number(dayRow.added_6to8.pulses) || 0,
      };

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
      } as any;
    });
  }, [rows, dayToSheet1Row]);
  
  const isSunday = (date: Date) => getDay(date) === 0;

  const handleZoomIn = () => onZoomChange(zoom + 0.1);
  const handleZoomOut = () => onZoomChange(zoom > 0.2 ? zoom - 0.1 : zoom);
  const handleResetZoom = () => onZoomChange(1);

  const renderStockItemRow = (label: string, stock: StockItem) => (
    <>
      <TableCell>{(stock.rice || 0).toFixed(3)}</TableCell>
      <TableCell>{(stock.wheat || 0).toFixed(3)}</TableCell>
      <TableCell>{(stock.oil || 0).toFixed(3)}</TableCell>
      <TableCell>{(stock.pulses || 0).toFixed(3)}</TableCell>
    </>
  );

  const renderEditableOpeningStockRow = (
    label: string,
    stock: StockItem,
    dayId: number,
    group: '1to5' | '6to8',
    disabled: boolean
  ) => (
    <>
      <TableCell><Input type="number" value={stock.rice || ''} onChange={e => handleOpeningStockChange(dayId, group, 'rice', e.target.valueAsNumber)} disabled={disabled} className="w-24" /></TableCell>
      <TableCell><Input type="number" value={stock.wheat || ''} onChange={e => handleOpeningStockChange(dayId, group, 'wheat', e.target.valueAsNumber)} disabled={disabled} className="w-24" /></TableCell>
      <TableCell><Input type="number" value={stock.oil || ''} onChange={e => handleOpeningStockChange(dayId, group, 'oil', e.target.valueAsNumber)} disabled={disabled} className="w-24" /></TableCell>
      <TableCell><Input type="number" value={stock.pulses || ''} onChange={e => handleOpeningStockChange(dayId, group, 'pulses', e.target.valueAsNumber)} disabled={disabled} className="w-24" /></TableCell>
    </>
  );
  
   const renderEditableStockItemRow = (
    label: string, 
    stock: StockItem, 
    dayId: number, 
    group: '1to5' | '6to8',
    disabled: boolean
  ) => (
    <>
      <TableCell><Input type="number" value={stock.rice || ''} onChange={e => handleInputChange(dayId, group, 'rice', e.target.valueAsNumber)} disabled={disabled} className="w-24" /></TableCell>
      <TableCell><Input type="number" value={stock.wheat || ''} onChange={e => handleInputChange(dayId, group, 'wheat', e.target.valueAsNumber)} disabled={disabled} className="w-24" /></TableCell>
      <TableCell><Input type="number" value={stock.oil || ''} onChange={e => handleInputChange(dayId, group, 'oil', e.target.valueAsNumber)} disabled={disabled} className="w-24" /></TableCell>
      <TableCell><Input type="number" value={stock.pulses || ''} onChange={e => handleInputChange(dayId, group, 'pulses', e.target.valueAsNumber)} disabled={disabled} className="w-24" /></TableCell>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <ShareButton variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          Share
        </ShareButton>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleZoomIn}><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={handleZoomOut}><ZoomOut className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={handleResetZoom}><RotateCcw className="h-4 w-4" /></Button>
        </div>
      </div>
      <div ref={tableContainerRef} className="rounded-md border overflow-x-auto">
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            width: zoom === 1 ? '100%' : `${(1 / zoom) * 100}%`,
          }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell colSpan={27} className="text-center">
                  <div className="text-lg font-semibold text-gray-700">
                    {format(selectedMonth, 'MMMM yyyy')} - Stock Management
                  </div>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableHead rowSpan={2} className="text-center align-middle">ದಿನಾಂಕ</TableHead>
                <TableHead rowSpan={2} className="text-center align-middle">ವಿಭಾಗ</TableHead>
                <TableHead colSpan={1} className="text-center">ಮಕ್ಕಳ ಸಂಖ್ಯೆ</TableHead>
                <TableHead colSpan={4} className="text-center">ಆರಂಭಿಕ ಶಿಲ್ಕು</TableHead>
                <TableHead colSpan={4} className="text-center">ತಿಂಗಳ ಸ್ವೀಕೃತಿ</TableHead>
                <TableHead colSpan={4} className="text-center">ಒಟ್ಟು</TableHead>
                <TableHead colSpan={4} className="text-center">ದಿನದ ವಿತರಣೆ</TableHead>
                <TableHead colSpan={4} className="text-center">ಅಂತಿಮ ಶಿಲ್ಕು</TableHead>
              </TableRow>
              <TableRow>
                <TableHead>ಒಟ್ಟು</TableHead>
                {Array(5).fill(0).map((_, i) => (
                  <React.Fragment key={i}>
                    <TableHead>ಅಕ್ಕಿ</TableHead>
                    <TableHead>ಗೋಧಿ</TableHead>
                    <TableHead>ಎಣ್ಣೆ</TableHead>
                    <TableHead>ಬೇಳೆ</TableHead>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedData.map((day) => {
                const isRowSunday = isSunday(day.date);
                const isRowToday = isToday(day.date);
                
                const children_total = { rice: day.children_1to5, wheat: day.children_6to8, oil: 0, pulses: 0};
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

                return (
                  <React.Fragment key={day.id}>
                    <TableRow className={`${isRowToday ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}>
                      <TableCell rowSpan={3} className={`font-medium ${isRowSunday ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
                        {format(day.date, 'dd/MM/yyyy')}
                        <div className="text-xs text-gray-500">{format(day.date, 'EEEE')}</div>
                      </TableCell>
                      <TableCell>1-5</TableCell>
                      <TableCell>{day.children_1to5}</TableCell>
                      {day.id === 1 
                        ? renderEditableOpeningStockRow('1-5 Opening', day.opening_1to5 || emptyStockItem(), day.id, '1to5', isRowSunday)
                        : renderStockItemRow('1-5 Opening', day.opening_1to5)
                      }
                      {renderEditableStockItemRow('1-5 Added', day.added_1to5, day.id, '1to5', isRowSunday)}
                      {renderStockItemRow('1-5 Total', day.total_1to5)}
                      {renderStockItemRow('1-5 Distribution', day.dist_1to5)}
                      {renderStockItemRow('1-5 Closing', day.closing_1to5)}
                    </TableRow>
                    <TableRow className={`${isRowToday ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}>
                      <TableCell>6-10</TableCell>
                      <TableCell>{day.children_6to8}</TableCell>
                      {day.id === 1
                        ? renderEditableOpeningStockRow('6-10 Opening', day.opening_6to8 || emptyStockItem(), day.id, '6to8', isRowSunday)
                        : renderStockItemRow('6-10 Opening', day.opening_6to8)
                      }
                      {renderEditableStockItemRow('6-10 Added', day.added_6to8, day.id, '6to8', isRowSunday)}
                      {renderStockItemRow('6-10 Total', day.total_6to8)}
                      {renderStockItemRow('6-10 Distribution', day.dist_6to8)}
                      {renderStockItemRow('6-10 Closing', day.closing_6to8)}
                    </TableRow>
                    <TableRow className={`font-bold ${isRowToday ? 'bg-blue-200 dark:bg-blue-800/50' : 'bg-gray-100 dark:bg-gray-800/50'}`}>
                      <TableCell>ಒಟ್ಟು</TableCell>
                      <TableCell>{day.children_1to5 + day.children_6to8}</TableCell>
                      {renderStockItemRow('Total Opening', opening_total)}
                      {renderStockItemRow('Total Added', added_total)}
                      {renderStockItemRow('Total', total_total)}
                      {renderStockItemRow('Total Distribution', dist_total)}
                      {renderStockItemRow('Total Closing', closing_total)}
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
