'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { exportToPDF } from '@/app/utils/pdf';
import { authFetch } from '@/app/utils/api';
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
import { RatesToast } from './RatesToast';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error("NEXT_PUBLIC_BACKEND_URL is undefined. App cannot start.");
}

interface RatesResponse {
  source: 'saved' | 'inherited' | 'none';
  year: number;
  month: number;
  inherited_from: { year: number; month: number } | null;
  rates: { egg_price: number; banana_price: number } | null;
}

// Empty or invalid box -> null; otherwise the number (>= 0)
const parsePrice = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const monthYearLabel = (y: number, m: number) =>
  `${new Date(y, m - 1).toLocaleString('default', { month: 'long' })} ${y}`;

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
  const [eggPriceText, setEggPriceText] = useState('');
  const [bananaPriceText, setBananaPriceText] = useState('');
  const [ratesSource, setRatesSource] = useState<RatesResponse['source'] | null>(null);
  // Prices the backend has saved for the selected month (null if not saved for this month)
  const [savedRates, setSavedRates] = useState<{ egg_price: number; banana_price: number } | null>(null);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const ratesReq = useRef(0);
  const eggPrice = parsePrice(eggPriceText) ?? 0;
  const bananaPrice = parsePrice(bananaPriceText) ?? 0;
  const pricesValid = parsePrice(eggPriceText) !== null && parsePrice(bananaPriceText) !== null;
  const locked = ratesSource === 'none' && !pricesValid;
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
      const res = await authFetch(`${BACKEND_URL}/api/egg/${year}/${month}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      
      if (!res.ok) throw new Error('Failed to load');
      
      const data = await res.json();
      
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

  const loadRates = useCallback(async () => {
    if (!userId) return;
    const req = ++ratesReq.current;
    // Reset first so nothing stale shows for the new month
    setToast(null);
    setEggPriceText('');
    setBananaPriceText('');
    setRatesSource(null);
    setSavedRates(null);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/egg/rates/${year}/${month}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data: RatesResponse = await res.json();
      if (!res.ok) throw new Error((data as any).error || 'Failed to load rates');
      if (req !== ratesReq.current) return;
      setRatesSource(data.source);
      if (data.rates) {
        setEggPriceText(String(data.rates.egg_price));
        setBananaPriceText(String(data.rates.banana_price));
      }
      if (data.source === 'saved') {
        setSavedRates(data.rates);
        setToast({ text: `Rates for ${monthYearLabel(year, month)} are saved.`, key: Date.now() });
      } else if (data.source === 'inherited' && data.inherited_from) {
        setToast({
          text: `Rates for ${monthYearLabel(year, month)} are not saved yet. Showing ${monthYearLabel(data.inherited_from.year, data.inherited_from.month)}'s rates. You can configure rates for this month by editing the prices.`,
          key: Date.now(),
        });
      }
    } catch (err: any) {
      if (req !== ratesReq.current) return;
      alert('Error: ' + err.message);
    }
  }, [userId, year, month]);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  const clearToast = useCallback(() => setToast(null), []);

  const [missingDates, setMissingDates] = useState<string[]>([]);

  const handleChange = useCallback((idx: number, field: keyof EggRecord, value: any) => {
    setRows(prev =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              [field]:
                field === 'payer'
                  ? value
                  : Math.max(0, Math.trunc(Number(value) || 0)),
            }
          : row
      )
    );
  }, []);

  const isTouched = (r: EggRecord) => r.egg_m > 0 || r.egg_f > 0 || r.banana_m > 0 || r.banana_f > 0;

  const saveData = async () => {
    // A row with quantities needs a payer; block the save and list those dates
    const missing = rows.filter(r => isTouched(r) && !r.payer);
    setMissingDates(missing.map(r => r.date));
    if (missing.length > 0) {
      const names = missing.map(r => {
        const [y, m, d] = r.date.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      });
      alert('Choose APF or GOV for: ' + names.join(', '));
      return;
    }
    const egg = parsePrice(eggPriceText);
    const banana = parsePrice(bananaPriceText);
    if (egg === null) {
      alert('Enter a valid egg price (ಮೊಟ್ಟೆ ಬೆಲೆ), 0 or more.');
      return;
    }
    if (banana === null) {
      alert('Enter a valid banana price (ಬಾಳೆ ಬೆಲೆ), 0 or more.');
      return;
    }
    setSaving(true);
    try {
      // Save the monthly rates first when they are not saved or have changed
      if (!savedRates || savedRates.egg_price !== egg || savedRates.banana_price !== banana) {
        const rateRes = await authFetch(`${BACKEND_URL}/api/egg/rates/${year}/${month}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({ rates: { egg_price: egg, banana_price: banana } })
        });
        const rateData = await rateRes.json();
        if (!rateRes.ok) {
          throw new Error(rateData.error || 'Failed to save rates');
        }
        setRatesSource(rateData.source);
        setSavedRates(rateData.rates);
        if (rateData.rates) {
          setEggPriceText(String(rateData.rates.egg_price));
          setBananaPriceText(String(rateData.rates.banana_price));
        }
      }

      // Only send records that have data (payer selected or any quantity entered)
      const records = rows
        .filter(r => r.payer || r.egg_m || r.egg_f || r.banana_m || r.banana_f)
        .map(r => ({
          date: r.date,
          payer: r.payer || null,
          egg_m: Math.max(0, Math.trunc(Number(r.egg_m) || 0)),
          egg_f: Math.max(0, Math.trunc(Number(r.egg_f) || 0)),
          banana_m: Math.max(0, Math.trunc(Number(r.banana_m) || 0)),
          banana_f: Math.max(0, Math.trunc(Number(r.banana_f) || 0)),
        }));

      const res = await authFetch(`${BACKEND_URL}/api/egg/save`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ records })
      });
      
      const responseData = await res.json();
      
      if (!res.ok) {
        // code 'rates_not_configured' also lands here with its message
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
      {toast && <RatesToast key={toast.key} text={toast.text} onDone={clearToast} />}
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
              <Input type="number" min={0} value={eggPriceText} placeholder="0"
                onChange={e => setEggPriceText(e.target.value)} 
                className={`w-full ${locked ? 'ring-2 ring-orange-500' : ''}`} />
            </div>
            <div className="flex-1">
              <label className="text-xs">ಬಾಳೆ ಬೆಲೆ</label>
              <Input type="number" min={0} value={bananaPriceText} placeholder="0"
                onChange={e => setBananaPriceText(e.target.value)} 
                className={`w-full ${locked ? 'ring-2 ring-orange-500' : ''}`} />
            </div>
          </div>

          {locked && (
            <p className="mb-4 text-sm font-semibold text-orange-600">
              Rates are not set yet. Enter the egg and banana prices to start.
            </p>
          )}

          <div className="flex gap-2">
            <Button onClick={saveData} disabled={saving || loading || locked} className="flex-1">
              {saving ? 'Saving...' : 'Save All'}
            </Button>
            <Button onClick={handleExportPDF} disabled={loading || locked} className="flex-1">
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

        {locked ? (
          <div className="text-center p-8 text-gray-600">Table is locked until the prices are entered.</div>
        ) : loading ? (
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
                    payerMissing={missingDates.includes(r.date) && isTouched(r) && !r.payer}
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
