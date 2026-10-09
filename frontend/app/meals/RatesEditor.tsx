'use client';

import { useState } from 'react';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { MealRates, RateGroup } from './utils';

interface RatesEditorProps {
  initial: MealRates | null;
  // First-time setup: cannot be dismissed without saving
  required: boolean;
  saving: boolean;
  onSave: (rates: MealRates) => void;
  onClose: () => void;
}

const FIELDS: { key: keyof RateGroup; label: string }[] = [
  { key: 'rice_g', label: 'ಅಕ್ಕಿ (g)' },
  { key: 'wheat_g', label: 'ಗೋಧಿ (g)' },
  { key: 'oil_ml', label: 'ಎಣ್ಣೆ (ml)' },
  { key: 'pulse_g', label: 'ಬೇಳೆ (g)' },
  { key: 'sadilvaru', label: 'ಸಾದಿಲ್ವಾರು (₹ per child)' },
];

type GroupText = Record<keyof RateGroup, string>;

const toText = (g: RateGroup | undefined): GroupText => ({
  rice_g: g ? String(g.rice_g) : '',
  wheat_g: g ? String(g.wheat_g) : '',
  oil_ml: g ? String(g.oil_ml) : '',
  pulse_g: g ? String(g.pulse_g) : '',
  sadilvaru: g ? String(g.sadilvaru) : '',
});

export function RatesEditor({ initial, required, saving, onSave, onClose }: RatesEditorProps) {
  const [g15, setG15] = useState<GroupText>(toText(initial?.g1_5));
  const [g610, setG610] = useState<GroupText>(toText(initial?.g6_10));

  const parseGroup = (name: string, text: GroupText): RateGroup | null => {
    const out = {} as RateGroup;
    for (const { key, label } of FIELDS) {
      const raw = text[key].trim();
      const n = raw === '' ? NaN : Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        alert(`${name} ${label}: enter a number that is 0 or more`);
        return null;
      }
      out[key] = n;
    }
    return out;
  };

  const handleSave = () => {
    const a = parseGroup('1-5', g15);
    if (!a) return;
    const b = parseGroup('6-10', g610);
    if (!b) return;
    onSave({ g1_5: a, g6_10: b });
  };

  const renderSection = (title: string, value: GroupText, set: (v: GroupText) => void) => (
    <div className="border rounded p-3">
      <div className="font-semibold text-black mb-2">{title}</div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="flex flex-col gap-1 text-xs text-black">
            <span>{label}</span>
            <Input
              type="number"
              step="any"
              min="0"
              value={value[key]}
              placeholder="0"
              onChange={e => set({ ...value, [key]: e.target.value })}
              className="text-black"
            />
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2">
      <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-3xl max-h-[90vh] overflow-auto text-black">
        <h2 className="text-lg font-semibold mb-1">Edit Rates</h2>
        <p className="text-sm mb-3">Enter the quantity per child: rice, wheat and pulse in grams (g), oil in millilitres (ml), ಸಾದಿಲ್ವಾರು in rupees (₹).</p>
        <div className="flex flex-col gap-3">
          {renderSection('1-5', g15, setG15)}
          {renderSection('6-10', g610, setG610)}
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Saving...' : 'Save'}
          </Button>
          {!required && (
            <Button onClick={onClose} disabled={saving} variant="outline" className="flex-1 text-black">
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
