"use client";

import * as React from "react";

interface MonthYearPickerProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const selectClass =
  "block h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-black focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600";

export function MonthYearPicker({
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
}: MonthYearPickerProps) {
  const monthId = React.useId();
  const yearId = React.useId();
  const years = React.useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => current - 2 + i);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-[2fr_1fr]">
      <div>
        <label htmlFor={monthId} className="mb-1 block text-base font-medium text-gray-700">
          Month
        </label>
        <select
          id={monthId}
          value={selectedMonth}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          className={selectClass}
        >
          {MONTHS.map((month, idx) => (
            <option key={month} value={idx + 1}>
              {month}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={yearId} className="mb-1 block text-base font-medium text-gray-700">
          Year
        </label>
        <select
          id={yearId}
          value={selectedYear}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className={selectClass}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
