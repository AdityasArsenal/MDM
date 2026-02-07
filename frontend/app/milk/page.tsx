'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  MilkRow,
  recalculateOpeningStock,
  calculateTotals
} from './utils';
import MilkTableRow from './MilkTableRow';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function Milk() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [rows, setRows] = useState<MilkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/');
      return;
    }
    setUserId(JSON.parse(user).id);
  }, [router]);

  const loadData = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/milk/${year}/${month}?user_id=${userId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to load data: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      
      const daysInMonth = new Date(year, month, 0).getDate();
      const allDays: MilkRow[] = [];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const existing = data.find((m: any) => m.date.startsWith(dateStr));
        
        allDays.push(existing ? {
          id: day,
          date: dateStr,
          children: existing.children || 0,
          milk_open: existing.milk_open || 0,
          ragi_open: existing.ragi_open || 0,
          milk_rcpt: existing.milk_rcpt || 0,
          ragi_rcpt: existing.ragi_rcpt || 0,
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
        // Ensure numeric fields never become NaN or undefined
        if (field === 'children' || field === 'milk_open' || field === 'ragi_open' || 
            field === 'milk_rcpt' || field === 'ragi_rcpt') {
          (newRows[idx] as any)[field] = isNaN(value) ? 0 : (value || 0);
        } else {
          (newRows[idx] as any)[field] = value;
        }
        return recalculateOpeningStock(newRows, idx);
      }
      
      return newRows;
    });
  }, []);

  const saveData = async () => {
    setSaving(true);
    try {
      const records = rows.map(r => ({
        date: r.date,
        children: r.children || 0,
        milk_open: r.milk_open || 0,
        ragi_open: r.ragi_open || 0,
        milk_rcpt: r.milk_rcpt || 0,
        ragi_rcpt: r.ragi_rcpt || 0,
        dist_type: r.dist_type
      }));

      console.log('Saving data:', { user_id: userId, records: records.slice(0, 2) }); // Log first 2 records

      const res = await fetch(`${BACKEND_URL}/api/milk/save`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ user_id: userId, records })
      });
      
      const responseData = await res.json();
      console.log('Response:', responseData);
      
      if (!res.ok) {
        throw new Error(responseData.error || 'Failed to save');
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

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex gap-2 mb-4">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} 
              className="flex-1 p-2 border rounded text-sm">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))} 
              className="p-2 border rounded text-sm">
              {Array.from({ length: 5 }, (_, i) => (
                <option key={i} value={new Date().getFullYear() - 2 + i}>
                  {new Date().getFullYear() - 2 + i}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={saveData} disabled={saving || loading} className="w-full">
            {saving ? 'Saving...' : 'Save All'}
          </Button>
        </div>

        {loading ? (
          <div className="text-center p-8">Loading...</div>
        ) : (
          <div className="rounded-md border overflow-x-auto bg-white">
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
                  <TableHead className="text-center">ಮಕ್ಕಳ ಸಂಖ್ಯೆ</TableHead>
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
                  <TableHead>ಹಾಲು</TableHead>
                  <TableHead>ರಾಗಿ</TableHead>
                  <TableHead>ಹಾಲು</TableHead>
                  <TableHead>ರಾಗಿ</TableHead>
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
                {rows.map(r => (
                  <MilkTableRow
                    key={r.id}
                    row={r}
                    onHandleChange={handleChange}
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
        )}
      </div>
    </div>
  );
}
