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
  MilkRates,
  RatesResponse,
  recalculateOpeningStock,
  calculateTotals
} from './utils';
import MilkTableRow from './MilkTableRow';
import { RatesEditor } from './RatesEditor';
import { RatesToast } from './RatesToast';
import { authFetch } from '../utils/api';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error("NEXT_PUBLIC_BACKEND_URL is undefined. App cannot start.");
}

const monthLabel = (y: number, m: number) =>
  `${new Date(y, m - 1).toLocaleString('default', { month: 'long' })} ${y}`;

export default function Milk() {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string>('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [rows, setRows] = useState<MilkRow[]>([]);
  const [rowsVersion, setRowsVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [ratesInfo, setRatesInfo] = useState<RatesResponse | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const showToast = useCallback((text: string) => setToast({ id: Date.now(), text }), []);
  const clearToast = useCallback(() => setToast(null), []);
  const [editorOpen, setEditorOpen] = useState(false);
  const [ratesSaving, setRatesSaving] = useState(false);

  const rates: MilkRates | null = ratesInfo?.rates ?? null;
  // Latest rates for code that runs outside a render (the data loader)
  const ratesRef = useRef<MilkRates | null>(null);
  ratesRef.current = rates;

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
          dist_type: existing.dist_type === 'milk & ragi' || existing.dist_type === 'only milk' ? existing.dist_type : null
        } : {
          id: day,
          date: dateStr,
          children: 0,
          milk_open: 0,
          ragi_open: 0,
          milk_rcpt: 0,
          ragi_rcpt: 0,
          dist_type: null
        });
      }

      // Derive days 2.. from day 1 with the current rates (day 1 stays as stored).
      // If the rates are not loaded yet, the effect below redoes this when they arrive.
      setRows(ratesRef.current ? recalculateOpeningStock(allDays, ratesRef.current, 1) : allDays);
      setRowsVersion(v => v + 1);
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

  // Rates for the selected month (saved, inherited from an earlier month, or none)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setRatesInfo(null);
    setToast(null);
    setRatesLoading(true);
    (async () => {
      try {
        const res = await authFetch(`${BACKEND_URL}/api/milk/rates/${year}/${month}`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || 'Failed to load rates');
        if (cancelled) return;
        const info = body as RatesResponse;
        setRatesInfo(info);
        // No rates at all: force the setup
        if (info.source === 'none') setEditorOpen(true);
        else if (info.source === 'inherited' && info.inherited_from) {
          showToast(`Rates for ${monthLabel(year, month)} are not saved yet. Showing ${monthLabel(info.inherited_from.year, info.inherited_from.month)}'s rates. You can configure rates for this month with Edit Rates.`);
        } else if (info.source === 'saved') {
          showToast(`Rates for ${monthLabel(year, month)} are saved.`);
        }
      } catch (err) {
        if (!cancelled) alert('Error loading rates: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        if (!cancelled) setRatesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, year, month, showToast]);

  // Whenever the rates or the loaded rows change, rebuild the derived opening stock so
  // nothing stale is shown. Covers: rates arriving after rows, a month switch, a rates PUT.
  useEffect(() => {
    if (!rates) return;
    setRows(prev => (prev.length > 1 ? recalculateOpeningStock(prev, rates, 1) : prev));
  }, [rates, rowsVersion]);

  const saveRates = async (newRates: MilkRates) => {
    setRatesSaving(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/milk/rates/${year}/${month}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ rates: newRates })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || 'Failed to save rates');
      // New rates trigger the opening-stock recompute effect
      setRatesInfo(body as RatesResponse);
      setEditorOpen(false);
      showToast(`Rates for ${monthLabel(year, month)} are saved.`);
    } catch (err) {
      alert('Error saving rates: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setRatesSaving(false);
    }
  };

  const handleChange = useCallback((id: number, field: keyof MilkRow, value: any) => {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === -1) return prev;

      // Typed fields never become NaN or negative. Opening stock may legitimately be negative.
      let newValue = value;
      if (field === 'children') {
        // children is a whole-number column in the database
        newValue = Math.max(0, Math.trunc(Number(value) || 0));
      } else if (field === 'milk_rcpt' || field === 'ragi_rcpt') {
        newValue = Math.max(0, Number(value) || 0);
      } else if (field === 'milk_open' || field === 'ragi_open') {
        newValue = Number(value) || 0;
      }

      const newRows = [...prev];
      newRows[idx] = { ...newRows[idx], [field]: newValue };

      // Only recalculate from the next row if we're not editing the first day's opening stock
      // If editing first day's opening stock, recalculate from index 1
      const recalcStartIdx = (idx === 0 && (field === 'milk_open' || field === 'ragi_open')) ? 1 : idx;
      return recalculateOpeningStock(newRows, rates, recalcStartIdx);
    });
  }, [rates]);

  const saveData = async () => {
    setSaving(true);
    try {
      const clean = (n: number) => (Number.isFinite(n) && Math.abs(n) >= 1e-9 ? n : 0);

      // A day is sent only if the user did something on it (day 1: typed opening stock counts)
      const isTouched = (r: MilkRow, idx: number) =>
        r.children > 0 || r.milk_rcpt > 0 || r.ragi_rcpt > 0 || r.dist_type !== null ||
        (idx === 0 && (r.milk_open !== 0 || r.ragi_open !== 0));
      const touched = rows.filter(isTouched);

      // Days with children need a distribution choice
      const missing = touched.filter(r => r.children > 0 && !r.dist_type);
      if (missing.length > 0) {
        const dates = missing
          .map(r => new Date(r.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))
          .join(', ');
        alert(`Choose milk & ragi or only milk for: ${dates}`);
        return;
      }
      if (touched.length === 0) {
        alert('Nothing to save: no day has been filled in.');
        return;
      }

      const records = touched.map(r => ({
        date: r.date,
        children: Math.max(0, Math.trunc(clean(r.children))),
        milk_open: clean(r.milk_open),
        ragi_open: clean(r.ragi_open),
        milk_rcpt: clean(r.milk_rcpt),
        ragi_rcpt: clean(r.ragi_rcpt),
        dist_type: r.dist_type === 'milk & ragi' || r.dist_type === 'only milk' ? r.dist_type : null
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
        if (responseData?.code === 'rates_not_configured') {
          alert(responseData.error || 'Rates are not configured for this month');
          setEditorOpen(true);
          return;
        }
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

  const totals = useMemo(() => calculateTotals(rows, rates), [rows, rates]);

  // Entries are locked until this month has usable rates
  const ratesLocked = ratesLoading || !ratesInfo || ratesInfo.source === 'none';

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
            <Button onClick={saveData} disabled={saving || loading || ratesLocked} className="flex-1">
              {saving ? 'Saving...' : 'Save All'}
            </Button>
            <Button onClick={handleExportPDF} disabled={loading || ratesLocked} className="flex-1">
              Download PDF
            </Button>
          </div>
        </div>

        {ratesInfo?.source === 'none' && (
          <div className="p-3 mb-2 rounded border border-orange-400 bg-orange-100 text-orange-900 text-sm font-semibold">
            Rates are not set yet. Enter the rates to start.
          </div>
        )}

        {/* Outside printRef so the PDF export does not capture the rates controls */}
        <div className="flex justify-end items-center gap-2 mb-2">
          <Button
            onClick={() => setEditorOpen(true)}
            disabled={!ratesInfo}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Edit Rates
          </Button>
          <Button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>-</Button>
          <Button onClick={() => setZoom(z => Math.min(2, z + 0.1))}>+</Button>
        </div>

        {loading || ratesLoading ? (
          <div className="text-center p-8">Loading...</div>
        ) : ratesInfo?.source === 'none' ? (
          <div className="text-center p-8 text-black">Table is locked until rates are saved.</div>
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
                  <TableHead className="min-w-[120px] text-center">ಹಾಲು (L)</TableHead>
                  <TableHead className="min-w-[120px] text-center">ರಾಗಿ (kg)</TableHead>
                  <TableHead className="min-w-[120px] text-center">ಹಾಲು (L)</TableHead>
                  <TableHead className="min-w-[120px] text-center">ರಾಗಿ (kg)</TableHead>
                  <TableHead>ಹಾಲು (L)</TableHead>
                  <TableHead>ರಾಗಿ (kg)</TableHead>
                  <TableHead>ಹಾಲು (L)</TableHead>
                  <TableHead>ರಾಗಿ (kg)</TableHead>
                  <TableHead>ಹಾಲು (L)</TableHead>
                  <TableHead>ರಾಗಿ (kg)</TableHead>
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
                    rates={rates}
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
      {toast && <RatesToast key={toast.id} text={toast.text} onDone={clearToast} />}
      {editorOpen && ratesInfo && (
        <RatesEditor
          key={`${year}-${month}-${ratesInfo.source}`}
          initial={ratesInfo.rates}
          required={ratesInfo.source === 'none'}
          saving={ratesSaving}
          onSave={saveRates}
          onClose={() => setEditorOpen(false)}
        />
      )}
      <PageFooter />
    </div>
  );
}
