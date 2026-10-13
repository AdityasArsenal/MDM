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
import { authFetch } from '../utils/api';
import { FloatingZoom } from '@/app/components/FloatingZoom';
import { TableToolbar } from '@/app/components/TableToolbar';
import { useToast } from '@/app/components/Toast';
import { useUnsavedGuard } from '@/app/hooks/useUnsavedGuard';

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
  const { toast, showToast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [ratesSaving, setRatesSaving] = useState(false);
  // True while the user has typed entries that are not saved yet. Only user edits set it;
  // loading data and the automatic opening-stock recompute never do.
  const [dirty, setDirty] = useState(false);
  useUnsavedGuard(dirty, () => showToast('Please save the work'));

  const rates: MilkRates | null = ratesInfo?.rates ?? null;
  const rowsRef = useRef<MilkRow[]>([]);
  rowsRef.current = rows;
  // Latest rates for code that runs outside a render (the data loader)
  const ratesRef = useRef<MilkRates | null>(null);
  ratesRef.current = rates;
  // Id of the latest data load, so a slow response for an earlier month is ignored
  const loadReqRef = useRef(0);

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

    const reqId = ++loadReqRef.current;
    setLoading(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/milk/${year}/${month}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!res.ok) {
        throw new Error(`Failed to load data: ${res.status} ${res.statusText}`);
      }

      const body = await res.json().catch(() => null);
      const data: Partial<MilkRow>[] = Array.isArray(body) ? body : [];

      // Children per date = the Meal page's two batches added together. Read only; if it
      // cannot be loaded the stored, editable values are used instead.
      const mealChildren = new Map<string, number>();
      try {
        const mealRes = await authFetch(`${BACKEND_URL}/api/meal/${year}/${month}`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        const mealBody = await mealRes.json().catch(() => null);
        if (!mealRes.ok) {
          throw new Error(mealBody?.error || `${mealRes.status} ${mealRes.statusText}`);
        }
        if (Array.isArray(mealBody)) {
          for (const m of mealBody) {
            if (typeof m?.date !== 'string') continue;
            const count = (v: unknown) => Math.max(0, Math.trunc(Number(v) || 0));
            mealChildren.set(m.date.slice(0, 10), count(m.cnt_1to5) + count(m.cnt_6to10));
          }
        }
      } catch (mealErr) {
        if (reqId === loadReqRef.current) {
          alert('Could not load Meal counts: ' + (mealErr instanceof Error ? mealErr.message : String(mealErr)));
        }
        mealChildren.clear();
      }
      // A newer load (month change) started while waiting: drop this result
      if (reqId !== loadReqRef.current) return;

      const daysInMonth = new Date(year, month, 0).getDate();
      const allDays: MilkRow[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const existing = data.find((m: Partial<MilkRow>) => typeof m?.date === 'string' && m.date.startsWith(dateStr));

        const fromMeal = mealChildren.has(dateStr);

        allDays.push(existing ? {
          id: day,
          date: dateStr,
          children: fromMeal
            ? (mealChildren.get(dateStr) as number)
            : Math.max(0, Math.trunc(Number(existing.children) || 0)),
          from_meal: fromMeal,
          milk_open: Number(existing.milk_open) || 0,
          ragi_open: Number(existing.ragi_open) || 0,
          milk_rcpt: Number(existing.milk_rcpt) || 0,
          ragi_rcpt: Number(existing.ragi_rcpt) || 0,
          dist_type: existing.dist_type === 'milk & ragi' || existing.dist_type === 'only milk' ? existing.dist_type : null
        } : {
          id: day,
          date: dateStr,
          children: fromMeal ? (mealChildren.get(dateStr) as number) : 0,
          from_meal: fromMeal,
          milk_open: 0,
          ragi_open: 0,
          milk_rcpt: 0,
          ragi_rcpt: 0,
          dist_type: null
        });
      }

      // Derive days 2.. from day 1 with the current rates and the Meal-derived children
      // (day 1 stays as stored). Rows are only set after the Meal counts are in. If the
      // rates are not loaded yet, the effect below redoes this when they arrive.
      setRows(ratesRef.current ? recalculateOpeningStock(allDays, ratesRef.current, 1) : allDays);
      setRowsVersion(v => v + 1);
      setDirty(false);
    } catch (err) {
      console.error('Load error:', err);
      alert('Error loading data: ' + (err as Error).message);
    } finally {
      if (reqId === loadReqRef.current) setLoading(false);
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
        if (!cancelled) alert('Error loading rates: ' + (err instanceof Error ? (err as Error).message : String(err)));
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
      alert('Error saving rates: ' + (err instanceof Error ? (err as Error).message : String(err)));
    } finally {
      setRatesSaving(false);
    }
  };

  const handleChange = useCallback((id: number, field: keyof MilkRow, value: MilkRow[keyof MilkRow]) => {
    // A refused edit (children taken from Meal) is not a change
    if (field === 'children' && rowsRef.current.find(r => r.id === id)?.from_meal) return;
    setDirty(true);
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === -1) return prev;
      // Children taken from the Meal page cannot be edited here
      if (field === 'children' && prev[idx].from_meal) return prev;

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

      setDirty(false);
      showToast('Done');
    } catch (err) {
      console.error('Save error:', err);
      alert('Error saving: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(() => calculateTotals(rows, rates), [rows, rates]);

  // Entries are locked until this month has usable rates
  const ratesLocked = ratesLoading || !ratesInfo || ratesInfo.source === 'none';

  // Month/year can only change when nothing is waiting to be saved
  const guardedChange = (apply: () => void) => {
    if (dirty) {
      showToast('Please save the work');
      return;
    }
    apply();
  };

  const handleExportPDF = () => {
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    const fileName = `Milk_Ragi_${monthName}_${year}.pdf`;
    exportToPDF(
      printRef,
      fileName,
      () => showToast('Done'),
      (error) => alert('Export failed: ' + error)
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex gap-2 mb-4">
            <select value={month} onChange={e => guardedChange(() => setMonth(Number(e.target.value)))}
              className="flex-1 p-2 border rounded text-sm text-black">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
            <select value={year} onChange={e => guardedChange(() => setYear(Number(e.target.value)))}
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
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        {ratesInfo?.source === 'none' && (
          <div className="p-3 mb-2 rounded border border-orange-400 bg-orange-100 text-orange-900 text-sm font-semibold">
            Rates are not set yet. Enter the rates to start.
          </div>
        )}

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
                    {/* Toolbar sits in the left corner; the title stays centered across the row.
                        The toolbar carries data-pdf-ignore, so it is left out of the PDF. */}
                    <div className="relative flex min-h-[2.5rem] items-center justify-center">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2">
                        <TableToolbar
                          onEditRates={() => setEditorOpen(true)}
                          editDisabled={!ratesInfo}
                          onDownload={handleExportPDF}
                          downloadDisabled={loading || ratesLocked}
                        />
                      </div>
                      <span>
                        {new Date(year, month - 1).toLocaleString('default', { month: 'long' })} {year} - Milk & Ragi
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead rowSpan={2} className="merge-r text-center">ದಿನಾಂಕ</TableHead>
                  <TableHead rowSpan={2} className="merge-l text-center">ಆಯ್ಕೆ</TableHead>
                  <TableHead rowSpan={2} className="min-w-[120px] text-center">ಮಕ್ಕಳ ಸಂಖ್ಯೆ</TableHead>
                  <TableHead colSpan={2} className="grp-l grp-r text-center">ಆರಂಭಿಕ ಶಿಲ್ಕು</TableHead>
                  <TableHead colSpan={2} className="grp-l grp-r text-center">ತಿಂಗಳ ಸ್ವೀಕೃತಿ</TableHead>
                  <TableHead colSpan={2} className="grp-l grp-r text-center">ಒಟ್ಟು</TableHead>
                  <TableHead colSpan={2} className="grp-l grp-r text-center">ದಿನದ ವಿತರಣೆ</TableHead>
                  <TableHead colSpan={2} className="grp-l grp-r text-center">ಅಂತಿಮ ಶಿಲ್ಕು</TableHead>
                  <TableHead rowSpan={2} className="text-center">ಸಕ್ಕರೆ</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="grp-l min-w-[120px] text-center">ಹಾಲು (L)</TableHead>
                  <TableHead className="grp-r min-w-[120px] text-center">ರಾಗಿ (kg)</TableHead>
                  <TableHead className="grp-l min-w-[120px] text-center">ಹಾಲು (L)</TableHead>
                  <TableHead className="grp-r min-w-[120px] text-center">ರಾಗಿ (kg)</TableHead>
                  <TableHead className="grp-l text-center">ಹಾಲು (L)</TableHead>
                  <TableHead className="grp-r text-center">ರಾಗಿ (kg)</TableHead>
                  <TableHead className="grp-l text-center">ಹಾಲು (L)</TableHead>
                  <TableHead className="grp-r text-center">ರಾಗಿ (kg)</TableHead>
                  <TableHead className="grp-l text-center">ಹಾಲು (L)</TableHead>
                  <TableHead className="grp-r text-center">ರಾಗಿ (kg)</TableHead>
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
                  <TableCell colSpan={2} className="grp-l grp-r"></TableCell>
                  <TableCell className="grp-l font-bold">{totals.milk_rcpt.toFixed(3)}</TableCell>
                  <TableCell className="grp-r font-bold">{totals.ragi_rcpt.toFixed(3)}</TableCell>
                  <TableCell colSpan={2} className="grp-l grp-r"></TableCell>
                  <TableCell className="grp-l font-bold">{totals.milk_dist.toFixed(3)}</TableCell>
                  <TableCell className="grp-r font-bold">{totals.ragi_dist.toFixed(3)}</TableCell>
                  <TableCell colSpan={2} className="grp-l grp-r"></TableCell>
                  <TableCell className="font-bold">{totals.sugar.toFixed(2)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            </div>
          </div>
        )}
      </div>
      {toast}
      <FloatingZoom zoom={zoom} setZoom={setZoom} />
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
