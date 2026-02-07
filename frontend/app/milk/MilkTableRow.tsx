import { memo, useMemo } from 'react';
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
  calculateSugar
} from './utils';

interface MilkTableRowProps {
  row: MilkRow;
  onHandleChange: (id: number, field: keyof MilkRow, value: any) => void;
}

const MilkTableRow = ({ row, onHandleChange }: MilkTableRowProps) => {
  const totalMilk = useMemo(() => calculateTotalMilk(row.milk_open || 0, row.milk_rcpt || 0), [row.milk_open, row.milk_rcpt]);
  const totalRagi = useMemo(() => calculateTotalRagi(row.ragi_open || 0, row.ragi_rcpt || 0), [row.ragi_open, row.ragi_rcpt]);
  const distMilk = useMemo(() => calculateMilkDistribution(row.children || 0), [row.children]);
  const distRagi = useMemo(() => calculateRagiDistribution(row.children || 0, row.dist_type, row.date), [row.children, row.dist_type, row.date]);
  const closeMilk = useMemo(() => calculateClosingMilk(totalMilk, distMilk), [totalMilk, distMilk]);
  const closeRagi = useMemo(() => calculateClosingRagi(totalRagi, distRagi), [totalRagi, distRagi]);
  const sugar = useMemo(() => calculateSugar(row.children || 0), [row.children]);
  const sunday = useMemo(() => isSunday(row.date), [row.date]);
  const dayName = useMemo(() => getDayName(row.date), [row.date]);

  return (
    <TableRow>
      <TableCell className={sunday ? 'text-red-600 font-semibold' : ''}>
        {row.date.split('-').reverse().join('/')}
        <div className="text-xs text-gray-500">{dayName}</div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onHandleChange(row.id, 'dist_type', 'milk & ragi')}
            className={`px-2 py-1 text-xs rounded ${
              row.dist_type === 'milk & ragi'
                ? 'bg-blue-500 text-white font-semibold'
                : 'bg-gray-200'
            }`}>
            ಹಾಲು ಮತ್ತು ರಾಗಿ
          </button>
          <button
            onClick={() => onHandleChange(row.id, 'dist_type', 'only milk')}
            className={`px-2 py-1 text-xs rounded ${
              row.dist_type === 'only milk'
                ? 'bg-orange-500 text-white font-semibold'
                : 'bg-gray-200'
            }`}>
            ಕೇವಲ ಹಾಲು
          </button>
        </div>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={row.children || 0}
          onChange={e => onHandleChange(row.id, 'children', e.target.valueAsNumber || 0)}
          className="w-20"
          disabled={sunday}
        />
      </TableCell>
      <TableCell>{(row.milk_open || 0).toFixed(3)}</TableCell>
      <TableCell>{(row.ragi_open || 0).toFixed(3)}</TableCell>
      <TableCell>
        <Input
          type="number"
          value={row.milk_rcpt || 0}
          onChange={e => onHandleChange(row.id, 'milk_rcpt', e.target.valueAsNumber || 0)}
          className="w-20"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={row.ragi_rcpt || 0}
          onChange={e => onHandleChange(row.id, 'ragi_rcpt', e.target.valueAsNumber || 0)}
          className="w-20"
        />
      </TableCell>
      <TableCell>{totalMilk.toFixed(3)}</TableCell>
      <TableCell>{totalRagi.toFixed(3)}</TableCell>
      <TableCell>{distMilk.toFixed(3)}</TableCell>
      <TableCell>{distRagi.toFixed(3)}</TableCell>
      <TableCell>{closeMilk.toFixed(3)}</TableCell>
      <TableCell>{closeRagi.toFixed(3)}</TableCell>
      <TableCell>{sugar.toFixed(2)}</TableCell>
    </TableRow>
  );
};

export default MilkTableRow;
