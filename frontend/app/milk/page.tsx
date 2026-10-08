'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { exportToPDF } from '@/app/utils/pdf';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Button } from '@/app/components/ui/button';
import { PageFooter } from '@/app/components/PageFooter';
import {
  MilkRow,
  recalculateOpeningStock,
  calculateTotals
} from './utils';
import MilkTableRow from './MilkTableRow';
import { authFetch } from '../utils/api';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error("NEXT_PUBLIC_BACKEND_URL is undefined. App cannot start.");
}

export default function Milk() {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string>('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [rows, setRows] = useState<MilkRow[]>([]);
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
      const res = await authFetch(`${BACKEND_URL}/api/milk/${year}/${month}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to load data: ${res.status} ${res.statusText}`);
      }
      
      const body = await res.json().catch(() => null);
      const data: any[] = Array.isArray(body) ? body : [];
      
      const daysInMonth = new Date(year, month, 0).getDate();
      const allDays: MilkRow[] = [];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const existing = data.find((m: any) => typeof m?.date === 'string' && m.date.startsWith(dateStr));
        
        allDays.push(existing ? {
          id: day,
          date: dateStr,
          children: Math.max(0, Math.trunc(Number(existing.children) || 0)),
          milk_open: Number(existing.milk_open) || 0,
          ragi_open: Number(existing.ragi_open) || 0,
          milk_rcpt: Number(existing.milk_rcpt) || 0,
          ragi_rcpt: Number(existing.ragi_rcpt) || 0,
          dist_type: existing.dist_type || 'milk & ragi'
        } : {
          id: day,
          date: dateStr,
          children: 0,
          milk_open: 0,
          ragi_open: 0,
          milk_rcpt: 0,
          ragi_rcpt: 0,
          dist_type: 'milk & ragi'
        });
      }
      
      setRows(allDays);
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

  const handleChange = useCallback((id: number, field: keyof MilkRow, value: any) => {
    setRows(prev => {
      const newRows = [...prev];
      const idx = newRows.findIndex(r => r.id === id);
      
      if (idx !== -1) {
        // Typed fields never become NaN or negative. Opening stock may legitimately be negative.
        if (field === 'children') {
          // children is a whole-number column in the database
          (newRows[idx] as any)[field] = Math.max(0, Math.trunc(Number(value) || 0));
        } else if (field === 'milk_rcpt' || field === 'ragi_rcpt') {
          (newRows[idx] as any)[field] = Math.max(0, Number(value) || 0);
        } else if (field === 'milk_open' || field === 'ragi_open') {
          (newRows[idx] as any)[field] = Number(value) || 0;
        } else {
          (newRows[idx] as any)[field] = value;
        }
        
        // Only recalculate from the next row if we're not editing the first day's opening stock
        // If editing first day's opening stock, recalculate from index 1
        const recalcStartIdx = (idx === 0 && (field === 'milk_open' || field === 'ragi_open')) ? 1 : idx;
        return recalculateOpeningStock(newRows, recalcStartIdx);
      }
      
      return newRows;
    });
  }, []);

  const saveData = async () => {
    setSaving(true);
    try {
      const clean = (n: number) => (Number.isFinite(n) && Math.abs(n) >= 1e-9 ? n : 0);
      const records = rows.map(r => ({
        date: r.date,
        children: Math.max(0, Math.trunc(clean(r.children))),
        milk_open: clean(r.milk_open),
        ragi_open: clean(r.ragi_open),
        milk_rcpt: clean(r.milk_rcpt),
        ragi_rcpt: clean(r.ragi_rcpt),
        dist_type: r.dist_type
      }));

      console.log('Saving data:', { records: records.slice(0, 2) }); // Log first 2 records

      const res = await authFetch(`${BACKEND_URL}/api/milk/save`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ records })
      });
      
      const responseData = await res.json().catch(() => null);
      console.log('Response:', responseData);
      
      if (!res.ok) {
        throw new Error(responseData?.error || `Failed to save (${res.status})`);
      }
      
      alert('Saved!');
    } catch (err: any) {
      console.error('Save error:', err);
      alert('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(() => calculateTotals(rows), [rows]);

  const handleExportPDF = () => {
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    const fileName = `Milk_Ragi_${monthName}_${year}.pdf`;
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
                  <TableCell colSpan={14} className="text-center text-lg font-semibold">
                    {new Date(year, month - 1).toLocaleString('default', { month: 'long' })} {year} - Milk & Ragi
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead className="text-center">ದಿನಾಂಕ</TableHead>
                  <TableHead className="text-center">ಆಯ್ಕೆ</TableHead>
                  <TableHead className="min-w-[120px] text-center">ಮಕ್ಕಳ ಸಂಖ್ಯೆ</TableHead>
                  <TableHead colSpan={2} className="text-center">ಆರಂಭಿಕ ಶಿಲ್ಕು</TableHead>
                  <TableHead colSpan={2} className="text-center">ತಿಂಗಳ ಸ್ವೀಕೃತಿ</TableHead>
                  <TableHead colSpan={2} className="text-center">ಒಟ್ಟು</TableHead>
                  <TableHead colSpan={2} className="text-center">ದಿನದ ವಿತರಣೆ</TableHead>
                  <TableHead colSpan={2} className="text-center">ಅಂತಿಮ ಶಿಲ್ಕು</TableHead>
                  <TableHead className="text-center">ಸಕ್ಕರೆ</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                  <TableHead className="min-w-[120px] text-center">ಹಾಲು</TableHead>
                  <TableHead className="min-w-[120px] text-center">ರಾಗಿ</TableHead>
                  <TableHead className="min-w-[120px] text-center">ಹಾಲು</TableHead>
                  <TableHead className="min-w-[120px] text-center">ರಾಗಿ</TableHead>
                  <TableHead>ಹಾಲು</TableHead>
                  <TableHead>ರಾಗಿ</TableHead>
                  <TableHead>ಹಾಲು</TableHead>
                  <TableHead>ರಾಗಿ</TableHead>
                  <TableHead>ಹಾಲು</TableHead>
                  <TableHead>ರಾಗಿ</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, index) => (
                  <MilkTableRow
                    key={r.id}
                    row={r}
                    onHandleChange={handleChange}
                    isFirstDay={index === 0}
                  />
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-bold">Total</TableCell>
                  <TableCell className="font-bold">{totals.children}</TableCell>
                  <TableCell colSpan={2}></TableCell>
                  <TableCell className="font-bold">{totals.milk_rcpt.toFixed(3)}</TableCell>
                  <TableCell className="font-bold">{totals.ragi_rcpt.toFixed(3)}</TableCell>
                  <TableCell colSpan={2}></TableCell>
                  <TableCell className="font-bold">{totals.milk_dist.toFixed(3)}</TableCell>
                  <TableCell className="font-bold">{totals.ragi_dist.toFixed(3)}</TableCell>
                  <TableCell colSpan={2}></TableCell>
                  <TableCell className="font-bold">{totals.sugar.toFixed(2)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            </div>
          </div>
        )}
      </div>
      <PageFooter />
    </div>
  );
}
