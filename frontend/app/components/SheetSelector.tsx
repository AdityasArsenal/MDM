"use client";

import * as React from "react";

interface SheetSelectorProps {
  sheets: { name: string; displayName: string; path: string }[];
  value: string;
  onValueChange: (value: string) => void;
}

export function SheetSelector({ sheets, value, onValueChange }: SheetSelectorProps) {
  const [hasBeenClicked, setHasBeenClicked] = React.useState(true);

  React.useEffect(() => {
    if (localStorage.getItem('sheetSelectorClicked') !== 'true') {
      setHasBeenClicked(false);
    }
  }, []);

  const handleClick = () => {
    if (!hasBeenClicked) {
      localStorage.setItem('sheetSelectorClicked', 'true');
      setHasBeenClicked(true);
    }
  };

  return (
    <div onClick={handleClick}>
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={`w-full p-3 border rounded-lg text-base bg-white text-black ${!hasBeenClicked ? 'animate-pulse border-blue-500' : ''}`}
      >
        <option value="" className="text-black">Select a sheet</option>
        {sheets.map((sheet) => (
          <option key={sheet.name} value={sheet.name} className="text-black">
            {sheet.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
