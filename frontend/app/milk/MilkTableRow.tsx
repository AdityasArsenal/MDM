import { useMemo, useState } from 'react';
import { TableCell, TableRow } from '@/app/components/ui/table';
import { Input } from '@/app/components/ui/input';
import {
  MilkRow,
  getDayName,
  isSunday,
  calculateTotalMilk,
  calculateTotalRagi,
  calculateMilkDistribution,
  calculateRagiDistribution,
  calculateClosingMilk,
  calculateClosingRagi,
  calculateSugar,
  fmt
} from './utils';

// Day-1 opening stock can be negative, so it is edited as text: partial input such as
// "-", "-.", "1." or ".5" must survive while typing. The parent only gets finite numbers.
const DRAFT_PATTERN = /^-?\d*\.?\d*$/;

const DraftNumberInput = ({ value, onCommit }: { value: number; onCommit: (n: number) => void }) => {
  const [draft, setDraft] = useState<string | null>(null);

  const handleChange = (text: string) => {
    if (!DRAFT_PATTERN.test(text)) return;
    setDraft(text);
    if (text === '') {
      onCommit(0);
      return;
    }
    const n = Number(text);
    if (Number.isFinite(n)) onCommit(n);
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={draft ?? (value ? String(value) : '')}
      placeholder="0"
      onChange={e => handleChange(e.target.value)}
      onBlur={() => setDraft(null)}
      className="w-20"
    />
  );
};

interface MilkTableRowProps {
  row: MilkRow;
  onHandleChange: (id: number, field: keyof MilkRow, value: any) => void;
  isFirstDay?: boolean;
}

const MilkTableRow = ({ row, onHandleChange, isFirstDay = false }: MilkTableRowProps) => {
  const totalMilk = useMemo(() => calculateTotalMilk(row.milk_open || 0, row.milk_rcpt || 0), [row.milk_open, row.milk_rcpt]);
  const totalRagi = useMemo(() => calculateTotalRagi(row.ragi_open || 0, row.ragi_rcpt || 0), [row.ragi_open, row.ragi_rcpt]);
  const distMilk = useMemo(() => calculateMilkDistribution(row.children || 0), [row.children]);
  const distRagi = useMemo(() => calculateRagiDistribution(row.children || 0, row.dist_type, row.date), [row.children, row.dist_type, row.date]);
  const closeMilk = useMemo(() => calculateClosingMilk(totalMilk, distMilk), [totalMilk, distMilk]);
  const closeRagi = useMemo(() => calculateClosingRagi(totalRagi, distRagi), [totalRagi, distRagi]);
  const sugar = useMemo(() => calculateSugar(row.children || 0), [row.children]);
  const sunday = useMemo(() => isSunday(row.date), [row.date]);
  const dayName = useMemo(() => getDayName(row.date), [row.date]);
  const missingDist = row.children > 0 && !row.dist_type;
  const missingRing = missingDist ? ' ring-2 ring-red-500' : '';

  return (
    <TableRow>
      <TableCell className={sunday ? 'text-red-600 font-semibold' : ''}>
        {new Date(row.date + 'T12:00:00').getDate()}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onHandleChange(row.id, 'dist_type', 'milk & ragi')}
            className={`px-2 py-1 text-xs rounded ${
              row.dist_type === 'milk & ragi'
                ? 'bg-blue-500 text-white font-semibold'
                : 'bg-gray-200 text-black'
            }${missingRing}`}>
            ಹಾಲು ಮತ್ತು ರಾಗಿ
          </button>
          <button
            onClick={() => onHandleChange(row.id, 'dist_type', 'only milk')}
            className={`px-2 py-1 text-xs rounded ${
              row.dist_type === 'only milk'
                ? 'bg-orange-500 text-white font-semibold'
                : 'bg-gray-200 text-black'
            }${missingRing}`}>
            ಕೇವಲ ಹಾಲು
          </button>
        </div>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={row.children || ''}
          placeholder="0"
          onChange={e => onHandleChange(row.id, 'children', e.target.valueAsNumber || 0)}
          step="1"
          min="0"
          className="w-20"
        />
      </TableCell>
      <TableCell>
        {isFirstDay ? (
          <DraftNumberInput value={row.milk_open} onCommit={n => onHandleChange(row.id, 'milk_open', n)} />
        ) : (
          fmt((row.milk_open || 0))
        )}
      </TableCell>
      <TableCell>
        {isFirstDay ? (
          <DraftNumberInput value={row.ragi_open} onCommit={n => onHandleChange(row.id, 'ragi_open', n)} />
        ) : (
          fmt((row.ragi_open || 0))
        )}
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={row.milk_rcpt || ''}
          placeholder="0"
          onChange={e => onHandleChange(row.id, 'milk_rcpt', e.target.valueAsNumber || 0)}
          className="w-20"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={row.ragi_rcpt || ''}
          placeholder="0"
          onChange={e => onHandleChange(row.id, 'ragi_rcpt', e.target.valueAsNumber || 0)}
          className="w-20"
        />
      </TableCell>
      <TableCell>{fmt(totalMilk)}</TableCell>
      <TableCell>{fmt(totalRagi)}</TableCell>
      <TableCell>{distMilk.toFixed(3)}</TableCell>
      <TableCell>{distRagi.toFixed(3)}</TableCell>
      <TableCell>{fmt(closeMilk)}</TableCell>
      <TableCell>{fmt(closeRagi)}</TableCell>
      <TableCell>{sugar.toFixed(2)}</TableCell>
    </TableRow>
  );
};

export default MilkTableRow;
