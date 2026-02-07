"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, Share2 } from "lucide-react";
import { ShareButton } from "./ShareButton";
import { format, getDaysInMonth, startOfMonth, getDay, isToday } from "date-fns";
import { TableFooter } from "@/components/ui/table";

interface MilkSheetTableRow {
  id: number;
  date: Date;
  totalChildren: number;
  openingMilkPowder: number;
  openingRagi: number;
  monthlyReceiptMilkPowder: number;
  monthlyReceiptRagi: number;
  distributionType: 'milk & ragi' | 'only milk';
}

interface MilkSheetTableProps {
  selectedMonth: Date;
  initialData: MilkSheetTableRow[];
  onTableDataChange: (data: MilkSheetTableRow[]) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export function MilkSheetTable({ selectedMonth, initialData, onTableDataChange, zoom, onZoomChange }: MilkSheetTableProps) {
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  const generateMonthDates = React.useCallback((date: Date) => {
    const daysInMonth = getDaysInMonth(date);
    const monthStart = startOfMonth(date);
    const dates: MilkSheetTableRow[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      // Use noon time to avoid timezone issues
      const currentDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), day, 12, 0, 0);
      dates.push({
        id: day,
        date: currentDate,
        totalChildren: 0,
        openingMilkPowder: 0,
        openingRagi: 0,
        monthlyReceiptMilkPowder: 0,
        monthlyReceiptRagi: 0,
        distributionType: 'milk & ragi',

      });
    }
    return dates;
  }, []);

  const [rows, setRows] = React.useState<MilkSheetTableRow[]>(() => {
    if (initialData && initialData.length > 0) {
      return initialData.map(row => {
        const dateStr = typeof row.date === 'string' ? row.date : row.date.toISOString();
        const dateParts = dateStr.split('T')[0].split('-');
        const safeDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), 12, 0, 0);
        return {...row, date: safeDate, distributionType: row.distributionType || 'milk & ragi'};
      });
    }
    return generateMonthDates(selectedMonth);
  });

  // Removed unused container size tracking for perf

  React.useEffect(() => {
    if (initialData && initialData.length > 0) {
      const normalized = initialData.map(row => {
        const dateStr = typeof row.date === 'string' ? row.date : row.date.toISOString();
        const dateParts = dateStr.split('T')[0].split('-');
        const safeDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), 12, 0, 0);
        return {...row, date: safeDate, distributionType: row.distributionType || 'milk & ragi'};
      });
      const equal = rows.length === normalized.length && rows.every((r, i) => {
        const n = normalized[i];
        return (
          r.id === n.id &&
          r.date.getTime() === n.date.getTime() &&
          r.totalChildren === n.totalChildren &&
          r.openingMilkPowder === n.openingMilkPowder &&
          r.openingRagi === n.openingRagi &&
          r.monthlyReceiptMilkPowder === n.monthlyReceiptMilkPowder &&
          r.monthlyReceiptRagi === n.monthlyReceiptRagi &&
          r.distributionType === n.distributionType
        );
      });
      if (!equal) setRows(normalized);
    } else {
      setRows(generateMonthDates(selectedMonth));
    }
  }, [selectedMonth, initialData, generateMonthDates, rows]);

  const handleInputChange = React.useCallback((id: number, field: keyof MilkSheetTableRow, value: any) => {
    const newRows = [...rows];
    const rowIndex = newRows.findIndex(row => row.id === id);

    if (rowIndex !== -1) {
      (newRows[rowIndex] as any)[field] = isNaN(value) ? 0 : value;

      // Recalculate all subsequent rows
      for (let i = rowIndex; i < newRows.length; i++) {
        const current = newRows[i];
        const prev = i > 0 ? newRows[i - 1] : null;

        // Carry over closing stock from previous day to opening stock of current day
        if (prev) {
          const prevTotalMilk = (prev.openingMilkPowder || 0) + (prev.monthlyReceiptMilkPowder || 0);
          const prevDistMilk = (prev.totalChildren || 0) * 0.018;
          current.openingMilkPowder = prevTotalMilk - prevDistMilk;

          const prevTotalRagi = (prev.openingRagi || 0) + (prev.monthlyReceiptRagi || 0);
          const prevDayOfWeek = getDay(prev.date);
          const prevDistRagi = prev.distributionType === 'milk & ragi' && [1, 3, 5].includes(prevDayOfWeek) ? (prev.totalChildren || 0) * 0.005 : 0;
          current.openingRagi = prevTotalRagi - prevDistRagi;
        }
      }
      setRows(newRows);
      setHasUnsavedChanges(true);
    }
  }, [rows]);

  React.useEffect(() => {
    onTableDataChange(rows);
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

  const isSunday = (date: Date) => getDay(date) === 0;

  const handleDistributionTypeChange = React.useCallback((id: number, type: 'milk & ragi' | 'only milk') => {
    const newRows = rows.map(row => {
      if (row.id === id) {
        return { ...row, distributionType: type };
      }
      return row;
    });
    setRows(newRows);
    setHasUnsavedChanges(true);
  }, [rows]);

  const handleZoomIn = () => onZoomChange(zoom + 0.1);
  const handleZoomOut = () => onZoomChange(zoom > 0.2 ? zoom - 0.1 : zoom);
  const handleResetZoom = () => onZoomChange(1);

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
            <TableCell colSpan={14} className="text-center">
              <div className="text-lg font-semibold text-gray-700">
                {format(selectedMonth, 'MMMM yyyy')} - Milk & Ragi Distribution
              </div>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableHead className="text-center">ದಿನಾಂಕ</TableHead>
            <TableHead className="text-center">ಆಯ್ಕೆ</TableHead>
            <TableHead className="text-center">ಒಟ್ಟು ಮಕ್ಕಳ ಸಂಖ್ಯೆ</TableHead>
            <TableHead colSpan={2} className="text-center">ಆರಂಭಿಕ ಶಿಲ್ಕು</TableHead>
            <TableHead colSpan={2} className="text-center">ತಿಂಗಳ ಸ್ವೀಕೃತಿ</TableHead>
            <TableHead colSpan={2} className="text-center">ಒಟ್ಟು</TableHead>
            <TableHead colSpan={2} className="text-center">ದಿನದ ವಿತರಣೆ</TableHead>
            <TableHead colSpan={2} className="text-center">ಅಂತಿಮ ಶಿಲ್ಕು</TableHead>
            <TableHead className="text-center">ಒಟ್ಟು ಸಕ್ಕರೆ</TableHead>

          </TableRow>
          <TableRow>
            <TableHead></TableHead>
            <TableHead></TableHead>
            <TableHead></TableHead>
            <TableHead>ಹಾಲಿನ ಪುಡಿ</TableHead>
            <TableHead>ರಾಗಿ ಶ್ಯೂರ್</TableHead>
            <TableHead>ಹಾಲಿನ ಪುಡಿ</TableHead>
            <TableHead>ರಾಗಿ ಶ್ಯೂರ್</TableHead>
            <TableHead>ಹಾಲಿನ ಪುಡಿ</TableHead>
            <TableHead>ರಾಗಿ ಶ್ಯೂರ್</TableHead>
            <TableHead>ಹಾಲಿನ ಪುಡಿ</TableHead>
            <TableHead>ರಾಗಿ ಶ್ಯೂರ್</TableHead>
            <TableHead>ಹಾಲಿನ ಪುಡಿ</TableHead>
            <TableHead>ರಾಗಿ ಶ್ಯೂರ್</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isRowSunday = isSunday(row.date);
            const isRowToday = isToday(row.date);

            // Calculations
            const totalMilkPowder = (row.openingMilkPowder || 0) + (row.monthlyReceiptMilkPowder || 0);
            const totalRagi = (row.openingRagi || 0) + (row.monthlyReceiptRagi || 0);
            const distMilkPowder = (row.totalChildren || 0) * 0.018;
            const dayOfWeek = getDay(row.date);
            const distRagi = row.distributionType === 'milk & ragi' && [1, 3, 5].includes(dayOfWeek) ? (row.totalChildren || 0) * 0.005 : 0;
            const closingMilkPowder = totalMilkPowder - distMilkPowder;
            const closingRagi = totalRagi - distRagi;
            const totalSugarCalculated = row.totalChildren * 0.44;

            return (
              <TableRow key={row.id} className={`${isRowToday ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}>
                <TableCell className={`font-medium ${isRowSunday ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
                  {format(row.date, 'dd/MM/yyyy')}
                  <div className="text-xs text-gray-500">{format(row.date, 'EEEE')}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleDistributionTypeChange(row.id, 'milk & ragi')}
                      className={`w-24 px-2 py-1 text-xs rounded transition-colors ${
                        row.distributionType === 'milk & ragi'
                          ? 'bg-blue-500 text-white font-semibold'
                          : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
                      }`}>
                      ಹಾಲು ಮತ್ತು ರಾಗಿ
                    </button>
                    <button
                      onClick={() => handleDistributionTypeChange(row.id, 'only milk')}
                      className={`w-24 px-2 py-1 text-xs rounded transition-colors ${
                        row.distributionType === 'only milk'
                          ? 'bg-orange-500 text-white font-semibold'
                          : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
                      }`}>
                      ಕೇವಲ ಹಾಲು
                    </button>
                  </div>
                </TableCell>
                <TableCell>
                  <Input 
                    type="number" 
                    value={Number.isFinite(row.totalChildren) ? row.totalChildren : 0} 
                    onChange={(e) => handleInputChange(row.id, 'totalChildren', e.target.valueAsNumber)}
                    className="w-24"
                    placeholder="0"
                    disabled={isRowSunday}
                  />
                </TableCell>
                <TableCell>{row.openingMilkPowder.toFixed(3)}</TableCell>
                <TableCell>{row.openingRagi.toFixed(3)}</TableCell>
                <TableCell>
                  <Input 
                    type="number" 
                    value={Number.isFinite(row.monthlyReceiptMilkPowder) ? row.monthlyReceiptMilkPowder : 0} 
                    onChange={(e) => handleInputChange(row.id, 'monthlyReceiptMilkPowder', e.target.valueAsNumber)}
                    className="w-24"
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>
                  <Input 
                    type="number" 
                    value={Number.isFinite(row.monthlyReceiptRagi) ? row.monthlyReceiptRagi : 0} 
                    onChange={(e) => handleInputChange(row.id, 'monthlyReceiptRagi', e.target.valueAsNumber)}
                    className="w-24"
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>{totalMilkPowder.toFixed(3)}</TableCell>
                <TableCell>{totalRagi.toFixed(3)}</TableCell>
                <TableCell>{distMilkPowder.toFixed(3)}</TableCell>
                <TableCell>{distRagi.toFixed(3)}</TableCell>
                <TableCell>{closingMilkPowder.toFixed(3)}</TableCell>
                <TableCell>{closingRagi.toFixed(3)}</TableCell>
                <TableCell>{totalSugarCalculated.toFixed(2)}</TableCell>

              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="font-bold">Grand Total</TableCell>
            <TableCell className="font-bold">{rows.reduce((acc, row) => acc + (row.totalChildren || 0), 0)}</TableCell>
            <TableCell colSpan={2}></TableCell>
            <TableCell className="font-bold">{rows.reduce((acc, row) => acc + (row.monthlyReceiptMilkPowder || 0), 0).toFixed(3)}</TableCell>
            <TableCell className="font-bold">{rows.reduce((acc, row) => acc + (row.monthlyReceiptRagi || 0), 0).toFixed(3)}</TableCell>
            <TableCell colSpan={2}></TableCell>
            <TableCell className="font-bold">{rows.reduce((acc, row) => acc + (row.totalChildren * 0.018), 0).toFixed(3)}</TableCell>
            <TableCell className="font-bold">{rows.reduce((acc, row) => {
                const dayOfWeek = getDay(row.date);
                const ragiDist = row.distributionType === 'milk & ragi' && [1, 3, 5].includes(dayOfWeek) ? row.totalChildren * 0.005 : 0;
                return acc + ragiDist;
            }, 0).toFixed(3)}</TableCell>
            <TableCell colSpan={2}></TableCell>
            <TableCell className="font-bold">{rows.reduce((acc, row) => acc + (row.totalChildren * 0.44), 0).toFixed(2)}</TableCell>

          </TableRow>
        </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}
