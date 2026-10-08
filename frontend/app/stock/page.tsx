'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { exportToPDF } from '@/app/utils/pdf';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Button } from '@/app/components/ui/button';
import { authFetch } from '../utils/api';
import { SignedNumberInput } from './SignedNumberInput';
import { PageFooter } from '@/app/components/PageFooter';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error("NEXT_PUBLIC_BACKEND_URL is undefined. App cannot start.");
}

interface StockRow {
  date: string;
  grade: '1-5' | '6-10';
  children: number;
  rice_open: number | null;
  wheat_open: number | null;
  oil_open: number | null;
  pulse_open: number | null;
  rice_add: number;
  wheat_add: number;
  oil_add: number;
  pulse_add: number;
  rice_used: number;
  wheat_used: number;
  oil_used: number;
  pulse_used: number;
}

// Opening stock may be negative; only non-finite values become null
const openValue = (v: number | null): number | null =>
  v !== null && Number.isFinite(v) ? v : null;
// Received stock is never negative or NaN
const addValue = (v: number): number => (Number.isFinite(v) ? Math.max(0, v) : 0);
// toFixed(3) that never prints "-0.000" for tiny negative noise
const fmt = (v: number): string => {
  const s = (Number.isFinite(v) ? v : 0).toFixed(3);
  return Number(s) === 0 ? '0.000' : s;
};
const num = (v: number | null): number => (v !== null && Number.isFinite(v) ? v : 0);

// Make sure every numeric field is a JSON number in state (a numeric string from the
// server would otherwise be sent back as a string, or zeroed by addValue)
const normalizeRow = (r: StockRow): StockRow => {
  const open = (v: unknown): number | null =>
    v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  const n = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    ...r,
    rice_open: open(r.rice_open),
    wheat_open: open(r.wheat_open),
    oil_open: open(r.oil_open),
    pulse_open: open(r.pulse_open),
    rice_add: n(r.rice_add),
    wheat_add: n(r.wheat_add),
    oil_add: n(r.oil_add),
    pulse_add: n(r.pulse_add),
    rice_used: n(r.rice_used),
    wheat_used: n(r.wheat_used),
    oil_used: n(r.oil_used),
    pulse_used: n(r.pulse_used),
  };
};

export default function Stock() {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string>('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/');
      return;
    }
    setUserId(JSON.parse(user).id);
    
    // Load selected month/year from localStorage if available
    const savedMonth = localStorage.getItem('selectedMonth');
    const savedYear = localStorage.getItem('selectedYear');
    if (savedMonth) setMonth(Number(savedMonth));
    if (savedYear) setYear(Number(savedYear));
  }, [router]);

  const loadData = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/stock/calc/${year}/${month}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to load data: ${res.status}`);
      }
      
      const data = await res.json();
      setRows(Array.isArray(data) ? data.map(normalizeRow) : []);
    } catch (err) {
      console.error('Load error:', err);
      setRows([]);
      alert("Error loading data: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [userId, year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChange = useCallback((date: string, grade: '1-5' | '6-10', field: string, value: number) => {
    setRows(prev => prev.map(r => {
      if (r.date === date && r.grade === grade) {
        let v = Number.isFinite(value) ? value : 0;
        if (field.endsWith('_add')) v = Math.max(0, v); // received stock is never negative; opening stock may be
        return { ...r, [field]: v };
      }
      return r;
    }));
  }, []);

  const saveData = async () => {
    setSaving(true);
    try {
      // Only save rows that have actual data (non-zero values in editable fields)
      const records = rows
        .filter(r => {
          const isFirstDay = r.date.endsWith('-01');
          const hasOpeningStock = isFirstDay && (
            (r.rice_open !== null && r.rice_open !== 0) ||
            (r.wheat_open !== null && r.wheat_open !== 0) ||
            (r.oil_open !== null && r.oil_open !== 0) ||
            (r.pulse_open !== null && r.pulse_open !== 0)
          );
          const hasIncomingStock = 
            r.rice_add !== 0 ||
            r.wheat_add !== 0 ||
            r.oil_add !== 0 ||
            r.pulse_add !== 0;
          
          return hasOpeningStock || hasIncomingStock;
        })
        .map(r => ({
          date: r.date,
          grade: r.grade,
          rice_add: addValue(r.rice_add),
          wheat_add: addValue(r.wheat_add),
          oil_add: addValue(r.oil_add),
          pulse_add: addValue(r.pulse_add),
          rice_open: openValue(r.rice_open),
          wheat_open: openValue(r.wheat_open),
          oil_open: openValue(r.oil_open),
          pulse_open: openValue(r.pulse_open),
        }));

      const res = await authFetch(`${BACKEND_URL}/api/stock/save`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ records })
      });
      
      // The error body may not be JSON (proxy page, 500 HTML)
      const responseData = await res.json().catch(() => null);
      
      if (!res.ok) {
        // Backend 400s look like {"error": "Record <i>: <reason>"}
        throw new Error(responseData?.error || `Failed to save (${res.status})`);
      }
      
      alert('Saved!');
      loadData(); // Reload to get updated calculations
    } catch (err) {
      console.error('Save error:', err);
      alert("Error saving: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Pre-indexed lookup map for O(1) access
  const rowsMap = React.useMemo(() => {
    const map = new Map<string, StockRow>();
    rows.forEach(row => {
      const key = `${row.date}|${row.grade}`;
      map.set(key, row);
    });
    return map;
  }, [rows]);

  // Precompute all calculations once per render
  const calculations = React.useMemo(() => {
    const calc = new Map<string, {
      opening: { rice: number; wheat: number; oil: number; pulse: number };
      totals: { rice: number; wheat: number; oil: number; pulse: number };
      closing: { rice: number; wheat: number; oil: number; pulse: number };
    }>();

    const getOpeningStock = (date: string, grade: '1-5' | '6-10'): { rice: number; wheat: number; oil: number; pulse: number } => {
      const key = `${date}|${grade}`;
      const row = rowsMap.get(key);
      if (!row) return { rice: 0, wheat: 0, oil: 0, pulse: 0 };
      
      const isFirstDay = date.endsWith('-01');
      
      if (isFirstDay) {
        return {
          rice: num(row.rice_open),
          wheat: num(row.wheat_open),
          oil: num(row.oil_open),
          pulse: num(row.pulse_open),
        };
      } else {
        const currentDate = new Date(date);
        const prevDate = new Date(currentDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDateStr = prevDate.toISOString().split('T')[0];
        const prevKey = `${prevDateStr}|${grade}`;
        const prevCalc = calc.get(prevKey);
        return prevCalc ? prevCalc.closing : { rice: 0, wheat: 0, oil: 0, pulse: 0 };
      }
    };

    const calculateTotals = (date: string, grade: '1-5' | '6-10', opening: { rice: number; wheat: number; oil: number; pulse: number }): { rice: number; wheat: number; oil: number; pulse: number } => {
      const key = `${date}|${grade}`;
      const row = rowsMap.get(key);
      if (!row) return { rice: 0, wheat: 0, oil: 0, pulse: 0 };
      
      return {
        rice: opening.rice + row.rice_add,
        wheat: opening.wheat + row.wheat_add,
        oil: opening.oil + row.oil_add,
        pulse: opening.pulse + row.pulse_add,
      };
    };

    const calculateClosing = (totals: { rice: number; wheat: number; oil: number; pulse: number }, date: string, grade: '1-5' | '6-10'): { rice: number; wheat: number; oil: number; pulse: number } => {
      const key = `${date}|${grade}`;
      const row = rowsMap.get(key);
      if (!row) return { rice: 0, wheat: 0, oil: 0, pulse: 0 };
      
      return {
        rice: totals.rice - row.rice_used,
        wheat: totals.wheat - row.wheat_used,
        oil: totals.oil - row.oil_used,
        pulse: totals.pulse - row.pulse_used,
      };
    };

    // Compute all values in order
    rows.forEach(row => {
      const key = `${row.date}|${row.grade}`;
      const opening = getOpeningStock(row.date, row.grade);
      const totals = calculateTotals(row.date, row.grade, opening);
      const closing = calculateClosing(totals, row.date, row.grade);
      
      calc.set(key, { opening, totals, closing });
    });

    return calc;
  }, [rows, rowsMap]);

  // Group rows by date
  const groupedRows = React.useMemo(() => {
    return rows.reduce((acc, row) => {
      if (!acc[row.date]) acc[row.date] = [];
      acc[row.date].push(row);
      return acc;
    }, {} as Record<string, StockRow[]>);
  }, [rows]);

  const dates = Object.keys(groupedRows).sort();

  const handleExportPDF = () => {
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    const fileName = `Stock_${monthName}_${year}.pdf`;
    exportToPDF(
      printRef,
      fileName,
      () => alert('PDF exported successfully!'),
      (error) => alert('Export failed: ' + error)
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <Button 
            onClick={() => router.push('/dashboard')} 
            variant="outline" 
            className="mb-4 w-full text-black"
          >
            ← Back to Dashboard
          </Button>
          <div className="flex gap-2 mb-4">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} 
              className="flex-1 p-2 border rounded text-sm text-black">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))} 
              className="p-2 border rounded text-sm text-black">
              {Array.from({ length: 5 }, (_, i) => (
                <option key={i} value={new Date().getFullYear() - 2 + i}>
                  {new Date().getFullYear() - 2 + i}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveData} disabled={saving || loading} className="flex-1">
              {saving ? 'Saving...' : 'Save All'}
            </Button>
            <Button onClick={handleExportPDF} disabled={loading} className="flex-1">
              Download PDF
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 mb-2">
          <Button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>-</Button>
          <Button onClick={() => setZoom(z => Math.min(2, z + 0.1))}>+</Button>
        </div>

        {loading ? (
          <div className="text-center p-8">Loading...</div>
        ) : (
          <div className="overflow-auto">
            <div
              ref={printRef}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              className="rounded-md border bg-white inline-block"
            >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell colSpan={22} className="text-center text-lg font-semibold">
                    {new Date(year, month - 1).toLocaleString('default', { month: 'long' })} {year} - Stock
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead className="text-center">ದಿನಾಂಕ</TableHead>
                  <TableHead className="text-center">ವಿಭಾಗ</TableHead>
                  <TableHead colSpan={4} className="text-center">ಆರಂಭಿಕ ಶಿಲ್ಕು</TableHead>
                  <TableHead colSpan={4} className="text-center">ತಿಂಗಳ ಸ್ವೀಕೃತಿ</TableHead>
                  <TableHead colSpan={4} className="text-center">ಒಟ್ಟು</TableHead>
                  <TableHead colSpan={4} className="text-center">ದಿನದ ವಿತರಣೆ</TableHead>
                  <TableHead colSpan={4} className="text-center">ಅಂತಿಮ ಶಿಲ್ಕು</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                  {Array(5).fill(0).map((_, i) => (
                    <React.Fragment key={i}>
                      <TableHead className="min-w-[120px] text-center">ಅಕ್ಕಿ</TableHead>
                      <TableHead className="min-w-[120px] text-center">ಗೋಧಿ</TableHead>
                      <TableHead className="min-w-[120px] text-center">ಎಣ್ಣೆ</TableHead>
                      <TableHead className="min-w-[120px] text-center">ಬೇಳೆ</TableHead>
                    </React.Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dates.map(date => {
                  const dayRows = groupedRows[date];
                  const row1to5 = dayRows.find(r => r.grade === '1-5');
                  const row6to10 = dayRows.find(r => r.grade === '6-10');
                  
                  if (!row1to5 || !row6to10) return null;
                  
                  const key1to5 = `${date}|1-5`;
                  const key6to10 = `${date}|6-10`;
                  
                  const calc1to5 = calculations.get(key1to5) || {
                    opening: { rice: 0, wheat: 0, oil: 0, pulse: 0 },
                    totals: { rice: 0, wheat: 0, oil: 0, pulse: 0 },
                    closing: { rice: 0, wheat: 0, oil: 0, pulse: 0 }
                  };
                  const calc6to10 = calculations.get(key6to10) || {
                    opening: { rice: 0, wheat: 0, oil: 0, pulse: 0 },
                    totals: { rice: 0, wheat: 0, oil: 0, pulse: 0 },
                    closing: { rice: 0, wheat: 0, oil: 0, pulse: 0 }
                  };
                  
                  const opening1to5 = calc1to5.opening;
                  const opening6to10 = calc6to10.opening;
                  const totals1to5 = calc1to5.totals;
                  const totals6to10 = calc6to10.totals;
                  const closing1to5 = calc1to5.closing;
                  const closing6to10 = calc6to10.closing;
                  
                  const isFirstDay = date.endsWith('-01');
                  const isSunday = new Date(date).getDay() === 0;
                  const isDisabled = isSunday && !isFirstDay; // Allow editing on first day even if Sunday
                  
                  return (
                    <React.Fragment key={date}>
                      <TableRow className={isSunday ? 'bg-red-50' : ''}>
                        <TableCell rowSpan={2} className="font-medium">
                          {new Date(date).getDate()}
                        </TableCell>
                        <TableCell>1-5</TableCell>
                        {isFirstDay ? (
                          <>
                            <TableCell><SignedNumberInput value={row1to5.rice_open} onValueChange={v => handleChange(date, '1-5', 'rice_open', v)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                            <TableCell><SignedNumberInput value={row1to5.wheat_open} onValueChange={v => handleChange(date, '1-5', 'wheat_open', v)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                            <TableCell><SignedNumberInput value={row1to5.oil_open} onValueChange={v => handleChange(date, '1-5', 'oil_open', v)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                            <TableCell><SignedNumberInput value={row1to5.pulse_open} onValueChange={v => handleChange(date, '1-5', 'pulse_open', v)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>{fmt(opening1to5.rice)}</TableCell>
                            <TableCell>{fmt(opening1to5.wheat)}</TableCell>
                            <TableCell>{fmt(opening1to5.oil)}</TableCell>
                            <TableCell>{fmt(opening1to5.pulse)}</TableCell>
                          </>
                        )}
                        <TableCell><SignedNumberInput value={row1to5.rice_add} onValueChange={v => handleChange(date, '1-5', 'rice_add', v)} allowNegative={false} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell><SignedNumberInput value={row1to5.wheat_add} onValueChange={v => handleChange(date, '1-5', 'wheat_add', v)} allowNegative={false} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell><SignedNumberInput value={row1to5.oil_add} onValueChange={v => handleChange(date, '1-5', 'oil_add', v)} allowNegative={false} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell><SignedNumberInput value={row1to5.pulse_add} onValueChange={v => handleChange(date, '1-5', 'pulse_add', v)} allowNegative={false} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell>{fmt(totals1to5.rice)}</TableCell>
                        <TableCell>{fmt(totals1to5.wheat)}</TableCell>
                        <TableCell>{fmt(totals1to5.oil)}</TableCell>
                        <TableCell>{fmt(totals1to5.pulse)}</TableCell>
                        <TableCell>{fmt(row1to5.rice_used)}</TableCell>
                        <TableCell>{fmt(row1to5.wheat_used)}</TableCell>
                        <TableCell>{fmt(row1to5.oil_used)}</TableCell>
                        <TableCell>{fmt(row1to5.pulse_used)}</TableCell>
                        <TableCell>{fmt(closing1to5.rice)}</TableCell>
                        <TableCell>{fmt(closing1to5.wheat)}</TableCell>
                        <TableCell>{fmt(closing1to5.oil)}</TableCell>
                        <TableCell>{fmt(closing1to5.pulse)}</TableCell>
                      </TableRow>
                      <TableRow className={isSunday ? 'bg-red-50' : ''}>
                        <TableCell>6-10</TableCell>
                        {isFirstDay ? (
                          <>
                            <TableCell><SignedNumberInput value={row6to10.rice_open} onValueChange={v => handleChange(date, '6-10', 'rice_open', v)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                            <TableCell><SignedNumberInput value={row6to10.wheat_open} onValueChange={v => handleChange(date, '6-10', 'wheat_open', v)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                            <TableCell><SignedNumberInput value={row6to10.oil_open} onValueChange={v => handleChange(date, '6-10', 'oil_open', v)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                            <TableCell><SignedNumberInput value={row6to10.pulse_open} onValueChange={v => handleChange(date, '6-10', 'pulse_open', v)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>{fmt(opening6to10.rice)}</TableCell>
                            <TableCell>{fmt(opening6to10.wheat)}</TableCell>
                            <TableCell>{fmt(opening6to10.oil)}</TableCell>
                            <TableCell>{fmt(opening6to10.pulse)}</TableCell>
                          </>
                        )}
                        <TableCell><SignedNumberInput value={row6to10.rice_add} onValueChange={v => handleChange(date, '6-10', 'rice_add', v)} allowNegative={false} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell><SignedNumberInput value={row6to10.wheat_add} onValueChange={v => handleChange(date, '6-10', 'wheat_add', v)} allowNegative={false} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell><SignedNumberInput value={row6to10.oil_add} onValueChange={v => handleChange(date, '6-10', 'oil_add', v)} allowNegative={false} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell><SignedNumberInput value={row6to10.pulse_add} onValueChange={v => handleChange(date, '6-10', 'pulse_add', v)} allowNegative={false} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell>{fmt(totals6to10.rice)}</TableCell>
                        <TableCell>{fmt(totals6to10.wheat)}</TableCell>
                        <TableCell>{fmt(totals6to10.oil)}</TableCell>
                        <TableCell>{fmt(totals6to10.pulse)}</TableCell>
                        <TableCell>{fmt(row6to10.rice_used)}</TableCell>
                        <TableCell>{fmt(row6to10.wheat_used)}</TableCell>
                        <TableCell>{fmt(row6to10.oil_used)}</TableCell>
                        <TableCell>{fmt(row6to10.pulse_used)}</TableCell>
                        <TableCell>{fmt(closing6to10.rice)}</TableCell>
                        <TableCell>{fmt(closing6to10.wheat)}</TableCell>
                        <TableCell>{fmt(closing6to10.oil)}</TableCell>
                        <TableCell>{fmt(closing6to10.pulse)}</TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </div>
        )}
      </div>
      <PageFooter />
    </div>
  );
}
