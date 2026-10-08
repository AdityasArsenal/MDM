'use client';

import { useEffect, useState, useCallback, useMemo, memo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { exportToPDF } from '@/app/utils/pdf';
import { authFetch } from '../utils/api';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { PageFooter } from '@/app/components/PageFooter';
import {
  MealRow,
  MealType,
  calc1to5,
  calc6to10,
  getDayName,
  isSunday,
  isToday,
  formatDate
} from './utils';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error("NEXT_PUBLIC_BACKEND_URL is undefined. App cannot start.");
}

interface MealTableRowProps {
  row: MealRow;
  onInputChange: (id: number, field: 'cnt_1to5' | 'cnt_6to10', value: number) => void;
  onMealTypeChange: (id: number, mealType: MealType) => void;
  onPulsesToggle: (id: number, include: boolean) => void;
  missingMeal: boolean;
  missingPulses: boolean;
}

const MealTableRow = memo(({ row, onInputChange, onMealTypeChange, onPulsesToggle, missingMeal, missingPulses }: MealTableRowProps) => {
  // Task 5: Prevent state update storms - use refs to batch rapid input changes
  const inputTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { c1, c2, totalSadilvaru, totalChildren, isRowSunday, isRowToday } = useMemo(() => {
    const c1 = calc1to5(row.cnt_1to5, row.meal_type, row.has_pulses);
    const c2 = calc6to10(row.cnt_6to10, row.meal_type, row.has_pulses);
    const totalSadilvaru = c1.sadilvaru + c2.sadilvaru;
    const totalChildren = (row.cnt_1to5 || 0) + (row.cnt_6to10 || 0);
    const isRowSunday = isSunday(row.date);
    const isRowToday = isToday(row.date);
    
    return { c1, c2, totalSadilvaru, totalChildren, isRowSunday, isRowToday };
  }, [row.cnt_1to5, row.cnt_6to10, row.meal_type, row.has_pulses, row.date]);

  // Task 5: Batch rapid input changes using controlled input with deferred state updates
  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'cnt_1to5' | 'cnt_6to10'
  ) => {
    const value = e.target.valueAsNumber;
    // Backend needs integers >= 0: drop decimals, negatives and NaN
    const finalValue = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    
    // Clear any pending timeout
    if (inputTimeoutRef.current) {
      clearTimeout(inputTimeoutRef.current);
    }
    
    // Batch updates - only commit to state after brief pause in typing
    inputTimeoutRef.current = setTimeout(() => {
      onInputChange(row.id, field, finalValue);
    }, 50); // 50ms is imperceptible but batches rapid keystrokes
    
    // Never show a literal 0: zero is an empty box (placeholder "0"). Otherwise show the cleaned whole number.
    if (finalValue === 0) {
      e.target.value = '';
    } else if (e.target.value !== finalValue.toString()) {
      e.target.value = finalValue.toString();
    }
  }, [row.id, onInputChange]);

  return (
    <TableRow className={isRowToday ? 'bg-blue-100' : ''}>
      <TableCell className={`font-medium ${
        isRowSunday ? 'text-red-600 font-semibold' : 'text-black'
      }`}>
        {formatDate(row.date)}
      </TableCell>
      <TableCell>
        <div className={`flex flex-col gap-1 ${missingMeal ? 'ring-2 ring-red-500 rounded p-0.5' : ''}`}>
          <button
            onClick={() => onMealTypeChange(row.id, 'rice')}
            className={`w-full px-2 py-1 text-xs rounded flex items-center justify-center gap-1 transition-colors ${
              row.meal_type === 'rice'
                ? 'bg-blue-500 text-white font-semibold'
                : 'bg-gray-200 text-black hover:bg-gray-300'
            }`}>
            {row.meal_type === 'rice' && <span className="text-white">✓</span>}
            <span>ಅಕ್ಕಿ</span>
          </button>
          <button
            onClick={() => onMealTypeChange(row.id, 'wheat')}
            className={`w-full px-2 py-1 text-xs rounded flex items-center justify-center gap-1 transition-colors ${
              row.meal_type === 'wheat'
                ? 'bg-orange-500 text-white font-semibold'
                : 'bg-gray-200 text-black hover:bg-gray-300'
            }`}>
            {row.meal_type === 'wheat' && <span className="text-white">✓</span>}
            <span>ಗೋಧಿ</span>
          </button>
        </div>
      </TableCell>
      <TableCell>
        <div className={`flex flex-col gap-1 ${missingPulses ? 'ring-2 ring-red-500 rounded p-0.5' : ''}`}>
          <button
            onClick={() => onPulsesToggle(row.id, true)}
            className={`w-full px-2 py-1 text-xs rounded flex items-center justify-center gap-1 transition-colors ${
              row.has_pulses === true
                ? 'bg-green-500 text-white font-semibold'
                : 'bg-gray-200 text-black hover:bg-gray-300'
            }`}
          >
            {row.has_pulses === true && <span className="text-white">✓</span>}
            <span>Yes</span>
          </button>
          <button
            onClick={() => onPulsesToggle(row.id, false)}
            className={`w-full px-2 py-1 text-xs rounded flex items-center justify-center gap-1 transition-colors ${
              row.has_pulses === false
                ? 'bg-red-500 text-white font-semibold'
                : 'bg-gray-200 text-black hover:bg-gray-300'
            }`}
          >
            {row.has_pulses === false && <span className="text-white">✓</span>}
            <span>No</span>
          </button>
        </div>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          defaultValue={row.cnt_1to5 > 0 ? row.cnt_1to5 : ''}
          onChange={e => handleInputChange(e, 'cnt_1to5')}
          className="w-full text-black"
          placeholder="0"
        />
      </TableCell>
      <TableCell>{(row.meal_type ? c1.rice : 0).toFixed(3)}</TableCell>
      <TableCell>{(row.meal_type ? c1.wheat : 0).toFixed(3)}</TableCell>
      <TableCell>{(row.meal_type ? c1.oil : 0).toFixed(3)}</TableCell>
      <TableCell>{(row.meal_type ? c1.pulses : 0).toFixed(3)}</TableCell>
      <TableCell className="border-r">{(row.meal_type ? c1.sadilvaru : 0).toFixed(3)}</TableCell>
      <TableCell>
        <Input
          type="number"
          defaultValue={row.cnt_6to10 > 0 ? row.cnt_6to10 : ''}
          onChange={e => handleInputChange(e, 'cnt_6to10')}
          className="w-20 text-black"
          placeholder="0"
        />
      </TableCell>
      <TableCell>{(row.meal_type ? c2.rice : 0).toFixed(3)}</TableCell>
      <TableCell>{(row.meal_type ? c2.wheat : 0).toFixed(3)}</TableCell>
      <TableCell>{(row.meal_type ? c2.oil : 0).toFixed(3)}</TableCell>
      <TableCell>{(row.meal_type ? c2.pulses : 0).toFixed(3)}</TableCell>
      <TableCell className="border-r">{(row.meal_type ? c2.sadilvaru : 0).toFixed(3)}</TableCell>
      <TableCell className="font-medium text-center text-black">{(row.meal_type ? totalSadilvaru : 0).toFixed(3)}</TableCell>
      <TableCell className="font-medium text-center text-black">{totalChildren}</TableCell>
    </TableRow>
  );
});

MealTableRow.displayName = 'MealTableRow';

export default function Meals() {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string>('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  // Rows (by id) that were blocked on save for a missing choice
  const [blockedIds, setBlockedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/');
      return;
    }
    const userData = JSON.parse(user);
    setUserId(userData.id);
    
    // Load selected month/year from localStorage if available
    const savedMonth = localStorage.getItem('selectedMonth');
    const savedYear = localStorage.getItem('selectedYear');
    if (savedMonth) setMonth(Number(savedMonth));
    if (savedYear) setYear(Number(savedYear));
  }, [router]);

  const loadMeals = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    setBlockedIds(new Set());
    try {
      const res = await authFetch(`${BACKEND_URL}/api/meal/${year}/${month}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || 'Failed to load');
      const data: MealRow[] = Array.isArray(body) ? body : [];
      
      const daysInMonth = new Date(year, month, 0).getDate();
      const allDays: MealRow[] = [];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const existing = data.find((m) => m.date.startsWith(dateStr));
        
        allDays.push(existing ? {
          id: day,
          date: dateStr,
          cnt_1to5: existing.cnt_1to5 || 0,
          cnt_6to10: existing.cnt_6to10 || 0,
          meal_type: existing.meal_type,
          has_pulses: typeof existing.has_pulses === 'boolean' ? existing.has_pulses : null
        } : {
          id: day,
          date: dateStr,
          cnt_1to5: 0,
          cnt_6to10: 0,
          meal_type: null,
          has_pulses: null
        });
      }
      
      setMeals(allDays);
    } catch (err) {
      alert('Error loading data: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [userId, year, month]);

  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  const saveMeals = async () => {

    // A row is touched if any choice was made or any count entered
    const touched = meals.filter(m => m.meal_type !== null || m.has_pulses !== null || m.cnt_1to5 > 0 || m.cnt_6to10 > 0);
    const incomplete = touched.filter(m => m.meal_type === null || m.has_pulses === null);
    if (incomplete.length > 0) {
      setBlockedIds(new Set(incomplete.map(m => m.id)));
      const labels = incomplete.map(m => {
        const [y, mo, d] = m.date.split('-').map(Number);
        return new Date(y, mo - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      });
      alert(`Choose meal type and pulses for: ${labels.join(', ')}`);
      return;
    }
    setBlockedIds(new Set());

    setSaving(true);
    try {
      const mealsToSave = touched.map(m => ({
        date: m.date,
        cnt_1to5: Number.isInteger(m.cnt_1to5) && m.cnt_1to5 > 0 ? m.cnt_1to5 : 0,
        cnt_6to10: Number.isInteger(m.cnt_6to10) && m.cnt_6to10 > 0 ? m.cnt_6to10 : 0,
        meal_type: m.meal_type as 'rice' | 'wheat',
        has_pulses: m.has_pulses === true
      }));

      console.log('Saving meals:', { records: mealsToSave });

      const res = await authFetch(`${BACKEND_URL}/api/meal/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ records: mealsToSave })
      });
      
      const responseData = await res.json().catch(() => ({}));
      console.log('Response:', responseData);
      
      if (!res.ok) {
        throw new Error(responseData.error || 'Failed to save');
      }
      
      alert('Saved successfully!');
    } catch (err) {
      console.error('Save error:', err);
      alert('Error saving: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const saveData = saveMeals;

  const handleInputChange = useCallback((id: number, field: 'cnt_1to5' | 'cnt_6to10', value: number) => {
    setMeals(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  }, []);

  const handleMealTypeChange = useCallback((id: number, mealType: MealType) => {
    setMeals(prev => prev.map(m => m.id === id ? { ...m, meal_type: mealType } : m));
  }, []);

  const handlePulsesToggle = useCallback((id: number, include: boolean) => {
    setMeals(prev => prev.map(m => m.id === id ? { ...m, has_pulses: include } : m));
  }, []);

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

  const handleExportPDF = () => {
    const fileName = `Meals_${monthName}_${year}.pdf`;
    exportToPDF(
      printRef,
      fileName,
      () => alert('PDF exported successfully!'),
      (error) => alert('Export failed: ' + error)
    );
  };

  // Task 3: Optimise grand totals - only recalculate when meals data changes
  // Not affected by loading, saving, or error state changes
  const totals = useMemo(() => {
    return meals.reduce(
      (acc, row) => {
        // Early return if no meal type - skip unnecessary calculations
        if (!row.meal_type) return acc;
        
        const one = calc1to5(row.cnt_1to5, row.meal_type, row.has_pulses);
        const six = calc6to10(row.cnt_6to10, row.meal_type, row.has_pulses);
        
        acc.sumCount1to5 += row.cnt_1to5 || 0;
        acc.sumCount6to10 += row.cnt_6to10 || 0;
        acc.rice1 += one.rice;
        acc.wheat1 += one.wheat;
        acc.oil1 += one.oil;
        acc.pulses1 += one.pulses;
        acc.sadil1 += one.sadilvaru;
        acc.rice6 += six.rice;
        acc.wheat6 += six.wheat;
        acc.oil6 += six.oil;
        acc.pulses6 += six.pulses;
        acc.sadil6 += six.sadilvaru;
        
        return acc;
      },
      { sumCount1to5: 0, sumCount6to10: 0, rice1: 0, wheat1: 0, oil1: 0, pulses1: 0, sadil1: 0, 
        rice6: 0, wheat6: 0, oil6: 0, pulses6: 0, sadil6: 0 }
    );
  }, [meals]); // Only depends on meals array, not loading/saving/error

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
                  <TableCell colSpan={20} className="text-center">
                    <div className="text-lg font-semibold text-black">
                      {monthName} {year} - Meal Planning Schedule
                    </div>
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableHead className="text-center font-bold text-black">Date</TableHead>
                  <TableHead className="text-center font-bold text-black">Meal</TableHead>
                  <TableHead className="text-center font-bold text-black"></TableHead>
                  <TableHead colSpan={6} className="text-center border-r font-bold text-black">1-5</TableHead>
                  <TableHead colSpan={6} className="text-center border-r font-bold text-black">6-10</TableHead>
                  <TableHead className="text-center font-bold text-black">ಒಟ್ಟು ಸಾದಿಲ್ವಾರು</TableHead>
                  <TableHead className="text-center font-bold text-black">ಒಟ್ಟು ಮಕ್ಕಳ ಸಂಖ್ಯೆ</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="w-[100px] text-black"></TableHead>
                  <TableHead className="w-[120px] text-black">Meal Type</TableHead>
                  <TableHead className="w-[120px] text-black">ಬೇಳೆ (yes/no)</TableHead>
                  <TableHead className="min-w-[120px] text-center text-black">ಮಕ್ಕಳ ಸಂಖ್ಯೆ</TableHead>
                  <TableHead className="text-black">ಅಕ್ಕಿ</TableHead>
                  <TableHead className="text-black">ಗೋಧಿ</TableHead>
                  <TableHead className="text-black">ಎಣ್ಣೆ</TableHead>
                  <TableHead className="text-black">ಬೇಳೆ</TableHead>
                  <TableHead className="border-r text-black">ಸಾದಿಲ್ವಾರು</TableHead>
                  <TableHead className="min-w-[120px] text-center text-black">ಮಕ್ಕಳ ಸಂಖ್ಯೆ</TableHead>
                  <TableHead className="text-black">ಅಕ್ಕಿ</TableHead>
                  <TableHead className="text-black">ಗೋಧಿ</TableHead>
                  <TableHead className="text-black">ಎಣ್ಣೆ</TableHead>
                  <TableHead className="text-black">ಬೇಳೆ</TableHead>
                  <TableHead className="border-r text-black">ಸಾದಿಲ್ವಾರು</TableHead>
                  <TableHead className="text-center text-black"></TableHead>
                  <TableHead className="text-center text-black"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meals.map(row => (
                  <MealTableRow
                    key={row.id}
                    row={row}
                    onInputChange={handleInputChange}
                    onMealTypeChange={handleMealTypeChange}
                    onPulsesToggle={handlePulsesToggle}
                    missingMeal={blockedIds.has(row.id) && row.meal_type === null}
                    missingPulses={blockedIds.has(row.id) && row.has_pulses === null}
                  />
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-bold text-black">Grand Total</TableCell>
                  <TableCell className="font-bold text-black">{totals.sumCount1to5}</TableCell>
                  <TableCell className="font-bold text-black">{totals.rice1.toFixed(3)}</TableCell>
                  <TableCell className="font-bold text-black">{totals.wheat1.toFixed(3)}</TableCell>
                  <TableCell className="font-bold text-black">{totals.oil1.toFixed(3)}</TableCell>
                  <TableCell className="font-bold text-black">{totals.pulses1.toFixed(3)}</TableCell>
                  <TableCell className="border-r font-bold text-black">{totals.sadil1.toFixed(3)}</TableCell>
                  <TableCell className="font-bold text-black">{totals.sumCount6to10}</TableCell>
                  <TableCell className="font-bold text-black">{totals.rice6.toFixed(3)}</TableCell>
                  <TableCell className="font-bold text-black">{totals.wheat6.toFixed(3)}</TableCell>
                  <TableCell className="font-bold text-black">{totals.oil6.toFixed(3)}</TableCell>
                  <TableCell className="font-bold text-black">{totals.pulses6.toFixed(3)}</TableCell>
                  <TableCell className="border-r font-bold text-black">{totals.sadil6.toFixed(3)}</TableCell>
                  <TableCell className="font-bold text-center text-black">{(totals.sadil1 + totals.sadil6).toFixed(3)}</TableCell>
                  <TableCell className="font-bold text-center text-black">{totals.sumCount1to5 + totals.sumCount6to10}</TableCell>
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
