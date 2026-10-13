import * as React from 'react';

export type SheetName = 'meals' | 'milk' | 'stock' | 'egg';

const svgProps = {
  width: 28,
  height: 28,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const icons: Record<SheetName, React.ReactNode> = {
  // plate with cutlery
  meals: (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="5" />
      <path d="M3 3v7a2 2 0 0 0 2 2" />
      <path d="M5 3v18" />
      <path d="M20 3c-2 1-3 4-3 7h3v11" />
    </svg>
  ),
  // milk carton
  milk: (
    <svg {...svgProps}>
      <path d="M8 2h8l2 5v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z" />
      <path d="M6 7h12" />
      <path d="M9 13h6" />
    </svg>
  ),
  // stacked boxes
  stock: (
    <svg {...svgProps}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5Z" />
      <path d="m3 8 9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  ),
  // egg
  egg: (
    <svg {...svgProps}>
      <path d="M12 3C8 3 5 10 5 14a7 7 0 0 0 14 0c0-4-3-11-7-11Z" />
    </svg>
  ),
};

interface SheetCardProps {
  name: SheetName;
  displayName: string;
  period: string;
  onOpen: () => void;
}

// "ಕನ್ನಡ ಹೆಸರು (English name)" -> [kannada, english]
function splitName(displayName: string): [string, string] {
  const m = displayName.match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? [m[1], m[2]] : [displayName, ''];
}

export function SheetCard({ name, displayName, period, onOpen }: SheetCardProps) {
  const [kannada, english] = splitName(displayName);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[72px] w-full items-center gap-3 rounded-xl border-2 border-gray-200 bg-white p-3 text-left shadow-sm active:border-blue-600 active:bg-blue-50 focus-visible:border-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
        {icons[name]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold leading-snug text-gray-900">{kannada}</span>
        {english && <span className="block text-base leading-snug text-gray-600">{english}</span>}
        <span className="mt-0.5 block text-base font-medium text-blue-700">{period}</span>
      </span>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="shrink-0 text-gray-400"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
}
