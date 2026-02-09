"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SheetSelectorProps {
  sheets: string[];
  value: string;
  onValueChange: (value: string) => void;
}

// Function to get display names for sheets
const getSheetDisplayName = (sheetName: string): string => {
  const displayNames: { [key: string]: string } = {
    "Meal Planning": "MDM ದೈನಂದಿನ ದಾಸ್ತಾನು ನಿರ್ವಹಣಾ ವಹಿ",
    "Milk & Ragi Distribution": "ಹಾಲು ಮತ್ತು ರಾಗಿ ಮಾಲ್ಟ್ ನಿರ್ವಹಣಾ ವಹಿ",
    "ಮೊಟ್ಟೆ ಮತ್ತು ಬಾಳೆಹಣ್ಣು": "ಮೊಟ್ಟೆ ಮತ್ತು ಬಾಳೆ ನಿರ್ವಹಣಾ ವಹಿ",
    "Stock Management": "ದಿನಸಿ ನಿರ್ವಹಣಾ ವಹಿ"
  };
  return displayNames[sheetName] || sheetName;
};

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
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={`w-full ${!hasBeenClicked ? 'shine-effect' : ''}`}>
          <SelectValue placeholder="Select a sheet">
            {value ? getSheetDisplayName(value) : "Select a sheet"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel></SelectLabel>
            {sheets.map((sheet) => (
              <SelectItem key={sheet} value={sheet}>
                {getSheetDisplayName(sheet)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

