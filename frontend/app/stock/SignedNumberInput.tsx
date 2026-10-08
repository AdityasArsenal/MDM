'use client';

import React, { useState } from 'react';
import { Input } from '@/app/components/ui/input';

interface SignedNumberInputProps {
  value: number | null;
  onValueChange: (value: number) => void;
  allowNegative?: boolean;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

// Shown when not editing: 0 (and anything that rounds to 0) is an empty field
const formatValue = (value: number | null): string => {
  if (value === null || !Number.isFinite(value) || Math.abs(value) < 0.0005) return '';
  return String(Number(value.toFixed(3)));
};

// Text input that keeps a local draft while focused, so partial text such as
// "-", "-.", "1." or ".5" is not wiped by the parent's number state.
export function SignedNumberInput({
  value,
  onValueChange,
  allowNegative = true,
  className,
  disabled,
  placeholder,
}: SignedNumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const allowed = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    if (!allowed.test(text)) return; // ignore keys that are not part of a number
    setDraft(text);
    const n = Number(text);
    if (text === '' || !Number.isFinite(n)) {
      onValueChange(0); // partial text ("-", ".", "-.") counts as 0 until it parses
    } else {
      onValueChange(n === 0 ? 0 : n); // n === 0 also turns -0 into 0
    }
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      pattern={allowNegative ? '-?[0-9]*\\.?[0-9]*' : '[0-9]*\\.?[0-9]*'}
      value={draft ?? formatValue(value)}
      onChange={handleChange}
      onFocus={() => setDraft(formatValue(value))}
      onBlur={() => setDraft(null)}
      className={className}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}
