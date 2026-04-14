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
import { Input } from '@/app/components/ui/input';
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

export default function Stock() {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string>('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      const res = await fetch(`${BACKEND_URL}/api/stock/calc/${year}/${month}?user_id=${userId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to load data: ${res.status}`);
      }
      
      const data = await res.json();
      setRows(data);
    } catch (err: any) {
      console.error('Load error:', err);
      alert('Error loading data: ' + err.message);
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
        return { ...r, [field]: isNaN(value) ? 0 : value };
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
          rice_add: r.rice_add || 0,
          wheat_add: r.wheat_add || 0,
          oil_add: r.oil_add || 0,
          pulse_add: r.pulse_add || 0,
          rice_open: r.rice_open,
          wheat_open: r.wheat_open,
          oil_open: r.oil_open,
          pulse_open: r.pulse_open,
        }));

      const res = await fetch(`${BACKEND_URL}/api/stock/save`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ user_id: userId, records })
      });
      
      const responseData = await res.json();
      
      if (!res.ok) {
        throw new Error(responseData.error || 'Failed to save');
      }
      
      alert('Saved!');
      loadData(); // Reload to get updated calculations
    } catch (err: any) {
      console.error('Save error:', err);
      alert('Error saving: ' + err.message);
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
          rice: row.rice_open || 0,
          wheat: row.wheat_open || 0,
          oil: row.oil_open || 0,
          pulse: row.pulse_open || 0,
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

        {loading ? (
          <div className="text-center p-8">Loading...</div>
        ) : (
          <div ref={printRef} className="rounded-md border overflow-x-auto bg-white">
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
                            <TableCell><Input type="number" step="0.001" value={row1to5.rice_open || ''} onChange={e => handleChange(date, '1-5', 'rice_open', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                            <TableCell><Input type="number" step="0.001" value={row1to5.wheat_open || ''} onChange={e => handleChange(date, '1-5', 'wheat_open', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                            <TableCell><Input type="number" step="0.001" value={row1to5.oil_open || ''} onChange={e => handleChange(date, '1-5', 'oil_open', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                            <TableCell><Input type="number" step="0.001" value={row1to5.pulse_open || ''} onChange={e => handleChange(date, '1-5', 'pulse_open', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>{opening1to5.rice.toFixed(3)}</TableCell>
                            <TableCell>{opening1to5.wheat.toFixed(3)}</TableCell>
                            <TableCell>{opening1to5.oil.toFixed(3)}</TableCell>
                            <TableCell>{opening1to5.pulse.toFixed(3)}</TableCell>
                          </>
                        )}
                        <TableCell><Input type="number" step="0.001" value={row1to5.rice_add || ''} onChange={e => handleChange(date, '1-5', 'rice_add', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell><Input type="number" step="0.001" value={row1to5.wheat_add || ''} onChange={e => handleChange(date, '1-5', 'wheat_add', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell><Input type="number" step="0.001" value={row1to5.oil_add || ''} onChange={e => handleChange(date, '1-5', 'oil_add', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell><Input type="number" step="0.001" value={row1to5.pulse_add || ''} onChange={e => handleChange(date, '1-5', 'pulse_add', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell>{totals1to5.rice.toFixed(3)}</TableCell>
                        <TableCell>{totals1to5.wheat.toFixed(3)}</TableCell>
                        <TableCell>{totals1to5.oil.toFixed(3)}</TableCell>
                        <TableCell>{totals1to5.pulse.toFixed(3)}</TableCell>
                        <TableCell>{row1to5.rice_used.toFixed(3)}</TableCell>
                        <TableCell>{row1to5.wheat_used.toFixed(3)}</TableCell>
                        <TableCell>{row1to5.oil_used.toFixed(3)}</TableCell>
                        <TableCell>{row1to5.pulse_used.toFixed(3)}</TableCell>
                        <TableCell>{closing1to5.rice.toFixed(3)}</TableCell>
                        <TableCell>{closing1to5.wheat.toFixed(3)}</TableCell>
                        <TableCell>{closing1to5.oil.toFixed(3)}</TableCell>
                        <TableCell>{closing1to5.pulse.toFixed(3)}</TableCell>
                      </TableRow>
                      <TableRow className={isSunday ? 'bg-red-50' : ''}>
                        <TableCell>6-10</TableCell>
                        {isFirstDay ? (
                          <>
                            <TableCell><Input type="number" step="0.001" value={row6to10.rice_open || ''} onChange={e => handleChange(date, '6-10', 'rice_open', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                            <TableCell><Input type="number" step="0.001" value={row6to10.wheat_open || ''} onChange={e => handleChange(date, '6-10', 'wheat_open', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                            <TableCell><Input type="number" step="0.001" value={row6to10.oil_open || ''} onChange={e => handleChange(date, '6-10', 'oil_open', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                            <TableCell><Input type="number" step="0.001" value={row6to10.pulse_open || ''} onChange={e => handleChange(date, '6-10', 'pulse_open', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>{opening6to10.rice.toFixed(3)}</TableCell>
                            <TableCell>{opening6to10.wheat.toFixed(3)}</TableCell>
                            <TableCell>{opening6to10.oil.toFixed(3)}</TableCell>
                            <TableCell>{opening6to10.pulse.toFixed(3)}</TableCell>
                          </>
                        )}
                        <TableCell><Input type="number" step="0.001" value={row6to10.rice_add || ''} onChange={e => handleChange(date, '6-10', 'rice_add', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell><Input type="number" step="0.001" value={row6to10.wheat_add || ''} onChange={e => handleChange(date, '6-10', 'wheat_add', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell><Input type="number" step="0.001" value={row6to10.oil_add || ''} onChange={e => handleChange(date, '6-10', 'oil_add', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell><Input type="number" step="0.001" value={row6to10.pulse_add || ''} onChange={e => handleChange(date, '6-10', 'pulse_add', e.target.valueAsNumber)} className="w-20 text-xs p-1" disabled={isDisabled} /></TableCell>
                        <TableCell>{totals6to10.rice.toFixed(3)}</TableCell>
                        <TableCell>{totals6to10.wheat.toFixed(3)}</TableCell>
                        <TableCell>{totals6to10.oil.toFixed(3)}</TableCell>
                        <TableCell>{totals6to10.pulse.toFixed(3)}</TableCell>
                        <TableCell>{row6to10.rice_used.toFixed(3)}</TableCell>
                        <TableCell>{row6to10.wheat_used.toFixed(3)}</TableCell>
                        <TableCell>{row6to10.oil_used.toFixed(3)}</TableCell>
                        <TableCell>{row6to10.pulse_used.toFixed(3)}</TableCell>
                        <TableCell>{closing6to10.rice.toFixed(3)}</TableCell>
                        <TableCell>{closing6to10.wheat.toFixed(3)}</TableCell>
                        <TableCell>{closing6to10.oil.toFixed(3)}</TableCell>
                        <TableCell>{closing6to10.pulse.toFixed(3)}</TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <PageFooter />
    </div>
  );
}
