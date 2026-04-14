"use client";

import * as React from "react";

interface MonthYearPickerProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}

export function MonthYearPicker({
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
}: MonthYearPickerProps) {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="flex gap-2">
      <select
        value={selectedMonth}
        onChange={(e) => onMonthChange(Number(e.target.value))}
        className="flex-1 p-3 border rounded-lg text-base bg-white text-black"
      >
        {months.map((month, idx) => (
          <option key={month} value={idx + 1} className="text-black">
            {month}
          </option>
        ))}
      </select>
      <select
        value={selectedYear}
        onChange={(e) => onYearChange(Number(e.target.value))}
        className="p-3 border rounded-lg text-base bg-white min-w-[100px] text-black"
      >
        {years.map((year) => (
          <option key={year} value={year} className="text-black">
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}
