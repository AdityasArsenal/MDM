'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { PageFooter } from '@/app/components/PageFooter';
import EggTableRow from './EggTableRow';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error("NEXT_PUBLIC_BACKEND_URL is undefined. App cannot start.");
}

interface EggRecord {
  date: string;
  payer: string;
  egg_m: number;
  egg_f: number;
  banana_m: number;
  banana_f: number;
}

export default function EggPage() {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string>('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [rows, setRows] = useState<EggRecord[]>([]);
  const [eggPrice, setEggPrice] = useState(6);
  const [bananaPrice, setBananaPrice] = useState(6);
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
      const res = await fetch(`${BACKEND_URL}/api/egg/${year}/${month}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      
      if (!res.ok) throw new Error('Failed to load');
      
      const data = await res.json();
      
      if (data.length > 0) {
        setEggPrice(data[0].egg_price || 6);
        setBananaPrice(data[0].banana_price || 6);
      }
      
      const daysInMonth = new Date(year, month, 0).getDate();
      const allDays: EggRecord[] = [];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const existing = data.find((r: any) => r.date.startsWith(dateStr));
        
        allDays.push(existing ? {
          date: dateStr,
          payer: existing.payer || '',
          egg_m: existing.egg_m || 0,
          egg_f: existing.egg_f || 0,
          banana_m: existing.banana_m || 0,
          banana_f: existing.banana_f || 0,
        } : {
          date: dateStr,
          payer: '',
          egg_m: 0,
          egg_f: 0,
          banana_m: 0,
          banana_f: 0,
        });
      }
      
      setRows(allDays);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChange = useCallback((idx: number, field: keyof EggRecord, value: any) => {
    setRows(prev =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              [field]:
                field === 'payer'
                  ? value
                  : isNaN(value) ? 0 : value || 0,
            }
          : row
      )
    );
  }, []);

  const saveData = async () => {
    setSaving(true);
    try {
      // Only send records that have data (payer selected or any quantity entered)
      const records = rows
        .filter(r => r.payer || r.egg_m || r.egg_f || r.banana_m || r.banana_f)
        .map(r => ({
          date: r.date,
          payer: r.payer || null,
          egg_m: r.egg_m || 0,
          egg_f: r.egg_f || 0,
          banana_m: r.banana_m || 0,
          banana_f: r.banana_f || 0,
          egg_price: eggPrice,
          banana_price: bananaPrice,
        }));

      const res = await fetch(`${BACKEND_URL}/api/egg/save`, {
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
      await loadData(); // Reload to get fresh data
    } catch (err: any) {
      console.error('Save error:', err);
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const calcSummary = useMemo(() => {
    const apf = rows.filter(r => r.payer === 'APF');
    const gov = rows.filter(r => r.payer === 'GOV');
    
    const apfEgg = apf.reduce((s, r) => s + (r.egg_m + r.egg_f), 0);
    const apfBanana = apf.reduce((s, r) => s + (r.banana_m + r.banana_f), 0);
    const govEgg = gov.reduce((s, r) => s + (r.egg_m + r.egg_f), 0);
    const govBanana = gov.reduce((s, r) => s + (r.banana_m + r.banana_f), 0);
    
    return {
      apfEgg, 
      apfBanana, 
      apfTotal: apfEgg * eggPrice + apfBanana * bananaPrice,
      govEgg, 
      govBanana, 
      govTotal: govEgg * eggPrice + govBanana * bananaPrice,
      totalEgg: apfEgg + govEgg,
      totalBanana: apfBanana + govBanana,
      grandTotal: (apfEgg + govEgg) * eggPrice + (apfBanana + govBanana) * bananaPrice
    };
  }, [rows, eggPrice, bananaPrice]);

  const summary = calcSummary;

  const handleExportPDF = () => {
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    const fileName = `Egg_Banana_${monthName}_${year}.pdf`;
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

          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <label className="text-xs">ಮೊಟ್ಟೆ ಬೆಲೆ</label>
              <Input type="number" value={eggPrice} 
                onChange={e => setEggPrice(Number(e.target.value))} 
                className="w-full" />
            </div>
            <div className="flex-1">
              <label className="text-xs">ಬಾಳೆ ಬೆಲೆ</label>
              <Input type="number" value={bananaPrice} 
                onChange={e => setBananaPrice(Number(e.target.value))} 
                className="w-full" />
            </div>
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

        <div className="overflow-auto">
          <div
            ref={printRef}
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            className="inline-block"
          >
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h3 className="font-semibold mb-2 text-center">Summary</h3>
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead className="text-center">ಮೊಟ್ಟೆ</TableHead>
                <TableHead className="text-center">ಬಾಳೆ</TableHead>
                <TableHead className="text-center">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-bold">APF</TableCell>
                <TableCell className="text-center">{summary.apfEgg}</TableCell>
                <TableCell className="text-center">{summary.apfBanana}</TableCell>
                <TableCell className="text-center font-bold">₹{summary.apfTotal}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-bold">GOV</TableCell>
                <TableCell className="text-center">{summary.govEgg}</TableCell>
                <TableCell className="text-center">{summary.govBanana}</TableCell>
                <TableCell className="text-center font-bold">₹{summary.govTotal}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-bold">Total</TableCell>
                <TableCell className="text-center font-bold">{summary.totalEgg}</TableCell>
                <TableCell className="text-center font-bold">{summary.totalBanana}</TableCell>
                <TableCell className="text-center font-bold">₹{summary.grandTotal}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {loading ? (
          <div className="text-center p-8">Loading...</div>
        ) : (
          <div className="rounded-md border overflow-x-auto bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell colSpan={14} className="text-center font-semibold">
                    {new Date(year, month - 1).toLocaleString('default', { month: 'long' })} {year} - ಮೊಟ್ಟೆ ಮತ್ತು ಬಾಳೆಹಣ್ಣು
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead className="text-xs">ದಿನಾಂಕ</TableHead>
                  <TableHead className="text-xs">ಪಾವತಿಸುವವನು</TableHead>
                  <TableHead colSpan={4} className="text-center text-xs">ಮೊಟ್ಟೆ</TableHead>
                  <TableHead colSpan={4} className="text-center text-xs">ಬಾಳೆ</TableHead>
                  <TableHead colSpan={3} className="text-center text-xs">ಒಟ್ಟು</TableHead>
                  <TableHead className="text-xs">ಒಟ್ಟು ಹಣ</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                  <TableHead className="min-w-[120px] text-xs text-center">M</TableHead>
                  <TableHead className="min-w-[120px] text-xs text-center">F</TableHead>
                  <TableHead className="text-xs text-center">ಒಟ್ಟು</TableHead>
                  <TableHead className="text-xs text-center">ಹಣ</TableHead>
                  <TableHead className="min-w-[120px] text-xs text-center">M</TableHead>
                  <TableHead className="min-w-[120px] text-xs text-center">F</TableHead>
                  <TableHead className="text-xs text-center">ಒಟ್ಟು</TableHead>
                  <TableHead className="text-xs text-center">ಹಣ</TableHead>
                  <TableHead className="text-xs text-center">ಮೊಟ್ಟೆ</TableHead>
                  <TableHead className="text-xs text-center">ಬಾಳೆ</TableHead>
                  <TableHead className="text-xs text-center">ಒಟ್ಟು</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, idx) => (
                  <EggTableRow
                    key={r.date}
                    row={r}
                    index={idx}
                    eggPrice={eggPrice}
                    bananaPrice={bananaPrice}
                    onChange={handleChange}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        </div>
        </div>
      </div>
      <PageFooter />
    </div>
  );
}
