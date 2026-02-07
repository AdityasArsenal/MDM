"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { PlusCircle, Check, ZoomIn, ZoomOut, RotateCcw, Share2 } from "lucide-react";
import { ShareButton } from "./ShareButton";
import { format, getDaysInMonth, startOfMonth, getDay, isToday } from "date-fns";

interface SheetTableProps {
  selectedMonth: Date;
  initialData: SheetTableRow[];
  onTableDataChange: (data: SheetTableRow[]) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export type MealType = 'rice' | 'wheat' | null;

export interface SheetTableRow {
  id: number;
  date: Date;
  count1to5: number;
  count6to8: number;
  mealType: MealType;
  includesPulses?: boolean;
}

const normalizeMealType = (mealType: any): MealType => {
  if (mealType === 'rice' || mealType === 'wheat' || mealType === null) return mealType as MealType;
  if (mealType === 'rice_sambar' || mealType === 'masala_rice') return 'rice';
  if (mealType === 'upittu') return 'wheat';
  return null;
};

const calculateMeal = (
  count: number,
  mealType: MealType,
  includesPulses: boolean,
  isGrade1to5: boolean
) => {
  const riceVal = isGrade1to5 ? 0.1 : 0.15;
  const wheatVal = isGrade1to5 ? 0.1 : 0.15;
  const oilVal = isGrade1to5 ? 0.005 : 0.0075;
  const pulsesVal = isGrade1to5 ? 0.02 : 0.03;
  const sadilvaruVal = isGrade1to5 ? 2.15 : 3.12;

  if (!mealType) {
    return { rice: 0, wheat: 0, oil: 0, pulses: 0, sadilvaru: 0 };
  }

  const riceAmount = mealType === 'rice' ? count * riceVal : 0;
  const wheatAmount = mealType === 'wheat' ? count * wheatVal : 0;
  const oilAmount = count * oilVal;
  const pulsesAmount = includesPulses ? count * pulsesVal : 0;
  const sadilvaruAmount = count * sadilvaruVal;

  return { rice: riceAmount, wheat: wheatAmount, oil: oilAmount, pulses: pulsesAmount, sadilvaru: sadilvaruAmount };
};

const calc1to5 = (count: number, mealType: MealType, includesPulses: boolean) =>
  calculateMeal(count, mealType, includesPulses, true);
const calc6to8 = (count: number, mealType: MealType, includesPulses: boolean) =>
  calculateMeal(count, mealType, includesPulses, false);

export function SheetTable({ selectedMonth, initialData, onTableDataChange, zoom, onZoomChange }: SheetTableProps) {
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  
  const generateMonthDates = React.useCallback((date: Date) => {
    const daysInMonth = getDaysInMonth(date);
    const monthStart = startOfMonth(date);
    return Array.from({ length: daysInMonth }, (_, i) => ({
      id: i + 1,
      date: new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1, 12, 0, 0),
      count1to5: 0,
      count6to8: 0,
      mealType: null,
      includesPulses: false,
    }));
  }, []);

  const [rows, setRows] = React.useState<SheetTableRow[]>(() => {
    if (initialData && initialData.length > 0) {
      return initialData.map(row => {
        const dateStr = typeof row.date === 'string' ? row.date : row.date.toISOString();
        const dateParts = dateStr.split('T')[0].split('-');
        const safeDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), 12, 0, 0);
        return {
          ...row,
          date: safeDate,
          mealType: normalizeMealType((row as any).mealType),
          includesPulses: (row as any).includesPulses ?? false,
        };
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
        return {
          ...row,
          date: safeDate,
          mealType: normalizeMealType((row as any).mealType),
          includesPulses: (row as any).includesPulses ?? false,
        };
      });
      const equal = rows.length === normalized.length && rows.every((r, i) => {
        const n = normalized[i];
        return (
          r.id === n.id &&
          r.date.getTime() === n.date.getTime() &&
          r.count1to5 === n.count1to5 &&
          r.count6to8 === n.count6to8 &&
          r.mealType === n.mealType &&
          !!r.includesPulses === !!n.includesPulses
        );
      });
      if (!equal) setRows(normalized);
    } else {
      setRows(generateMonthDates(selectedMonth));
    }
  }, [selectedMonth, initialData, generateMonthDates, rows]);

  // Update parent component with current table data whenever rows change
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

  const handleInputChange = React.useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    id: number,
    group: "count1to5" | "count6to8"
  ) => {
    const value = e.target.valueAsNumber;
    setRows(prev => prev.map(row => (row.id === id ? { ...row, [group]: isNaN(value) ? 0 : value } : row)));
    setHasUnsavedChanges(true);
  }, []);

  const handleMealTypeChange = React.useCallback((id: number, mealType: MealType) => {
    setRows(prev => prev.map(row => (row.id === id ? { ...row, mealType } : row)));
    setHasUnsavedChanges(true);
  }, []);

  const handlePulsesToggle = React.useCallback((id: number, include: boolean) => {
    setRows(prev => prev.map(row => (row.id === id ? { ...row, includesPulses: include } : row)));
    setHasUnsavedChanges(true);
  }, []);

  // Remove the local month change handler since it's now controlled by parent

  // Helper function to check if a date is Sunday
  const isSunday = (date: Date) => getDay(date) === 0;

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
            <TableCell colSpan={17} className="text-center">
              <div className="text-lg font-semibold text-gray-700">
                {format(selectedMonth, 'MMMM yyyy')} - Meal Planning Schedule
              </div>
            </TableCell>
          </TableRow>

          <TableRow>
            <TableHead className="text-center font-bold">Date</TableHead>
            <TableHead className="text-center font-bold">Meal</TableHead>
            <TableHead className="text-center font-bold"></TableHead>
            <TableHead colSpan={6} className="text-center border-r font-bold">1-5</TableHead>
            <TableHead colSpan={6} className="text-center font-bold">6-10</TableHead>
            <TableHead className="text-center font-bold">ಒಟ್ಟು ಸಾದಿಲ್ವಾರು</TableHead>
            <TableHead className="text-center font-bold">ಒಟ್ಟು ಮಕ್ಕಳ ಸಂಖ್ಯೆ</TableHead>
          </TableRow>
          <TableRow>
            <TableHead className="w-[100px]"></TableHead>
            <TableHead className="w-[120px]">Meal Type</TableHead>
            <TableHead className="w-[120px]">ಬೇಳೆ (yes/no)</TableHead>
            <TableHead className="w-[100px]">ಮಕ್ಕಳ ಸಂಖ್ಯೆ</TableHead>
            <TableHead>ಅಕ್ಕಿ</TableHead>
            <TableHead>ಗೋಧಿ</TableHead>
            <TableHead>ಎಣ್ಣೆ</TableHead>
            <TableHead>ಬೇಳೆ</TableHead>
            <TableHead className="border-r">ಸಾದಿಲ್ವಾರು</TableHead>
            <TableHead className="w-[100px]">ಮಕ್ಕಳ ಸಂಖ್ಯೆ</TableHead>
            <TableHead>ಅಕ್ಕಿ</TableHead>
            <TableHead>ಗೋಧಿ</TableHead>
            <TableHead>ಎಣ್ಣೆ</TableHead>
            <TableHead>ಬೇಳೆ</TableHead>
            <TableHead className="border-r">ಸಾದಿಲ್ವಾರು</TableHead>
            <TableHead className="text-center"></TableHead>
            <TableHead className="text-center"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => {
            const c1 = calc1to5(row.count1to5, row.mealType, !!row.includesPulses);
            const c2 = calc6to8(row.count6to8, row.mealType, !!row.includesPulses);
            const totalSadilvaru = c1.sadilvaru + c2.sadilvaru;
            const totalChildren = (row.count1to5 || 0) + (row.count6to8 || 0);
            const isRowSunday = isSunday(row.date);
            const isRowToday = isToday(row.date);
            
            return (
              <TableRow 
              key={row.id} 
              className={`${
                isRowToday ? 'bg-blue-100 dark:bg-blue-900/50' : ''
              }`}
            >
              <TableCell className={`font-medium ${
                isRowSunday ? 'text-red-600 dark:text-red-400 font-semibold' : ''
              }`}>
                {format(row.date, 'dd/MM/yyyy')}
                <div className="text-xs text-gray-500">{format(row.date, 'EEEE')}</div>
              </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMealTypeChange(row.id, 'rice')}
                      className={`w-full px-2 py-1 text-xs rounded flex items-center justify-center gap-1 transition-colors ${
                        row.mealType === 'rice'
                          ? 'bg-blue-500 text-white font-semibold'
                          : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
                      }`}>
                      {row.mealType === 'rice' && <Check className="h-3 w-3" />}
                      <span>ಅಕ್ಕಿ</span>
                    </button>
                    <button
                      onClick={() => handleMealTypeChange(row.id, 'wheat')}
                      className={`w-full px-2 py-1 text-xs rounded flex items-center justify-center gap-1 transition-colors ${
                        row.mealType === 'wheat'
                          ? 'bg-orange-500 text-white font-semibold'
                          : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
                      }`}>
                      {row.mealType === 'wheat' && <Check className="h-3 w-3" />}
                      <span>ಗೋಧಿ</span>
                    </button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handlePulsesToggle(row.id, true)}
                      className={`w-full px-2 py-1 text-xs rounded flex items-center justify-center gap-1 transition-colors ${
                        row.includesPulses
                          ? 'bg-green-500 text-white font-semibold'
                          : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
                      }`}
                    >
                      {row.includesPulses && <Check className="h-3 w-3" />}
                      <span>Yes</span>
                    </button>
                    <button
                      onClick={() => handlePulsesToggle(row.id, false)}
                      className={`w-full px-2 py-1 text-xs rounded flex items-center justify-center gap-1 transition-colors ${
                        !row.includesPulses
                          ? 'bg-red-500 text-white font-semibold'
                          : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
                      }`}
                    >
                      {!row.includesPulses && <Check className="h-3 w-3" />}
                      <span>No</span>
                    </button>
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={Number.isFinite(row.count1to5) ? row.count1to5 : 0}
                    onChange={e => handleInputChange(e, row.id, "count1to5")}
                    className="w-20"
                    placeholder="0"
                    disabled={isRowSunday}
                  />
                </TableCell>
                <TableCell>{(row.mealType ? c1.rice : 0).toFixed(3)}</TableCell>
                <TableCell>{(row.mealType ? c1.wheat : 0).toFixed(3)}</TableCell>
                <TableCell>{(row.mealType ? c1.oil : 0).toFixed(3)}</TableCell>
                <TableCell>{(row.mealType ? c1.pulses : 0).toFixed(3)}</TableCell>
                <TableCell className="border-r">{(row.mealType ? c1.sadilvaru : 0).toFixed(3)}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={Number.isFinite(row.count6to8) ? row.count6to8 : 0}
                    onChange={e => handleInputChange(e, row.id, "count6to8")}
                    className="w-20"
                    placeholder="0"
                    disabled={isRowSunday}
                  />
                </TableCell>
                <TableCell>{(row.mealType ? c2.rice : 0).toFixed(3)}</TableCell>
                <TableCell>{(row.mealType ? c2.wheat : 0).toFixed(3)}</TableCell>
                <TableCell>{(row.mealType ? c2.oil : 0).toFixed(3)}</TableCell>
                <TableCell>{(row.mealType ? c2.pulses : 0).toFixed(3)}</TableCell>
                <TableCell className="border-r">{(row.mealType ? c2.sadilvaru : 0).toFixed(3)}</TableCell>
                <TableCell className="font-medium text-center">{(row.mealType ? totalSadilvaru : 0).toFixed(3)}</TableCell>
                <TableCell className="font-medium text-center">{totalChildren}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          {(() => {
            const totals = rows.reduce(
              (acc, row) => {
                const one = row.mealType ? calc1to5(row.count1to5, row.mealType, !!row.includesPulses) : null;
                const six = row.mealType ? calc6to8(row.count6to8, row.mealType, !!row.includesPulses) : null;
                acc.sumCount1to5 += row.count1to5 || 0;
                acc.sumCount6to8 += row.count6to8 || 0;
                if (one) {
                  acc.rice1 += one.rice; acc.wheat1 += one.wheat; acc.oil1 += one.oil; acc.pulses1 += one.pulses; acc.sadil1 += one.sadilvaru;
                }
                if (six) {
                  acc.rice6 += six.rice; acc.wheat6 += six.wheat; acc.oil6 += six.oil; acc.pulses6 += six.pulses; acc.sadil6 += six.sadilvaru;
                }
                return acc;
              },
              { sumCount1to5: 0, sumCount6to8: 0, rice1: 0, wheat1: 0, oil1: 0, pulses1: 0, sadil1: 0, rice6: 0, wheat6: 0, oil6: 0, pulses6: 0, sadil6: 0 }
            );
            const totalSadil = totals.sadil1 + totals.sadil6;
            const totalChildren = totals.sumCount1to5 + totals.sumCount6to8;
            return (
              <TableRow>
                <TableCell colSpan={3} className="font-bold">Grand Total</TableCell>
                <TableCell className="font-bold">{totals.sumCount1to5}</TableCell>
                <TableCell className="font-bold">{totals.rice1.toFixed(3)}</TableCell>
                <TableCell className="font-bold">{totals.wheat1.toFixed(3)}</TableCell>
                <TableCell className="font-bold">{totals.oil1.toFixed(3)}</TableCell>
                <TableCell className="font-bold">{totals.pulses1.toFixed(3)}</TableCell>
                <TableCell className="border-r font-bold">{totals.sadil1.toFixed(3)}</TableCell>
                <TableCell className="font-bold">{totals.sumCount6to8}</TableCell>
                <TableCell className="font-bold">{totals.rice6.toFixed(3)}</TableCell>
                <TableCell className="font-bold">{totals.wheat6.toFixed(3)}</TableCell>
                <TableCell className="font-bold">{totals.oil6.toFixed(3)}</TableCell>
                <TableCell className="font-bold">{totals.pulses6.toFixed(3)}</TableCell>
                <TableCell className="border-r font-bold">{totals.sadil6.toFixed(3)}</TableCell>
                <TableCell className="font-bold text-center">{totalSadil.toFixed(3)}</TableCell>
                <TableCell className="font-bold text-center">{totalChildren}</TableCell>
              </TableRow>
            );
          })()}
        </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}
