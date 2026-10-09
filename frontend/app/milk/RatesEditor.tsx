'use client';

import { useState } from 'react';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { MilkRates } from './utils';

interface RatesEditorProps {
  initial: MilkRates | null;
  // First-time setup: cannot be dismissed without saving
  required: boolean;
  saving: boolean;
  onSave: (rates: MilkRates) => void;
  onClose: () => void;
}

const FIELDS: { key: keyof MilkRates; label: string }[] = [
  { key: 'milk_ml', label: 'ಹಾಲು (ml per child)' },
  { key: 'ragi_g', label: 'ರಾಗಿ (g per child)' },
  { key: 'sugar_rupees', label: 'ಸಕ್ಕರೆ (₹ per child)' },
];

type RatesText = Record<keyof MilkRates, string>;

const toText = (r: MilkRates | null): RatesText => ({
  milk_ml: r ? String(r.milk_ml) : '',
  ragi_g: r ? String(r.ragi_g) : '',
  sugar_rupees: r ? String(r.sugar_rupees) : '',
});

export function RatesEditor({ initial, required, saving, onSave, onClose }: RatesEditorProps) {
  const [text, setText] = useState<RatesText>(toText(initial));

  const handleSave = () => {
    const out = {} as MilkRates;
    for (const { key, label } of FIELDS) {
      const raw = text[key].trim();
      const n = raw === '' ? NaN : Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        alert(`${label}: enter a number that is 0 or more`);
        return;
      }
      out[key] = n;
    }
    onSave(out);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2">
      <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-xl max-h-[90vh] overflow-auto text-black">
        <h2 className="text-lg font-semibold mb-1">Edit Rates</h2>
        <p className="text-sm mb-3">
          Enter the quantity per child. Milk in ml, ragi in grams, sugar in rupees (₹).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {FIELDS.map(({ key, label }) => (
            <label key={key} className="flex flex-col gap-1 text-xs text-black">
              <span>{label}</span>
              <Input
                type="number"
                step="any"
                min="0"
                value={text[key]}
                placeholder="0"
                onChange={e => setText({ ...text, [key]: e.target.value })}
                className="text-black"
              />
            </label>
          ))}
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
