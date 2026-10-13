"use client";

import * as React from "react";

interface SheetSelectorProps {
  sheets: { name: string; displayName: string; path: string }[];
  value: string;
  onValueChange: (value: string) => void;
}

export function SheetSelector({ sheets, value, onValueChange }: SheetSelectorProps) {
  const id = React.useId();
  const [hasBeenClicked, setHasBeenClicked] = React.useState(true);

  React.useEffect(() => {
    if (localStorage.getItem('sheetSelectorClicked') !== 'true') {
      setHasBeenClicked(false);
    }
  }, []);

  const handleInteract = () => {
    if (!hasBeenClicked) {
      localStorage.setItem('sheetSelectorClicked', 'true');
      setHasBeenClicked(true);
    }
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-base font-medium text-gray-700">
        Select Sheet
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          handleInteract();
          onValueChange(e.target.value);
        }}
        onFocus={handleInteract}
        className={`block h-12 w-full rounded-lg border bg-white px-3 text-base text-black focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 ${
          !hasBeenClicked ? 'animate-pulse border-blue-500' : 'border-gray-300'
        }`}
      >
        <option value="">Select a sheet</option>
        {sheets.map((sheet) => (
          <option key={sheet.name} value={sheet.name}>
            {sheet.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
