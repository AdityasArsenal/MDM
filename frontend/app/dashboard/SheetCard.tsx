export type SheetName = 'meals' | 'milk' | 'stock' | 'egg';

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

export function SheetCard({ displayName, period, onOpen }: SheetCardProps) {
  const [kannada, english] = splitName(displayName);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[72px] w-full items-center gap-3 rounded-xl border-2 border-gray-200 bg-white p-3 text-left shadow-sm active:border-blue-600 active:bg-blue-50 focus-visible:border-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
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
