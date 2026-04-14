import React, { memo } from 'react';
import { TableRow, TableCell } from '@/app/components/ui/table';
import { Input } from '@/app/components/ui/input';

interface EggRecord {
  date: string;
  payer: string;
  egg_m: number;
  egg_f: number;
  banana_m: number;
  banana_f: number;
}

interface EggTableRowProps {
  row: EggRecord;
  index: number;
  eggPrice: number;
  bananaPrice: number;
  onChange: (index: number, field: keyof EggRecord, value: any) => void;
}

const EggTableRow = memo(({ row, index, eggPrice, bananaPrice, onChange }: EggTableRowProps) => {
  const eggTotal = row.egg_m + row.egg_f;
  const eggMoney = eggTotal * eggPrice;
  const bananaTotal = row.banana_m + row.banana_f;
  const bananaMoney = bananaTotal * bananaPrice;
  const grandTotal = eggTotal + bananaTotal;
  const totalMoney = eggMoney + bananaMoney;

  return (
    <TableRow>
      <TableCell className="text-xs">{new Date(row.date).getDate()}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => onChange(index, 'payer', 'APF')}
            className={`px-2 py-1 text-xs rounded ${
              row.payer === 'APF'
                ? 'bg-blue-500 text-white font-semibold'
                : 'bg-gray-200 text-black'
            }`}>
            APF
          </button>
          <button
            onClick={() => onChange(index, 'payer', 'GOV')}
            className={`px-2 py-1 text-xs rounded ${
              row.payer === 'GOV'
                ? 'bg-orange-500 text-white font-semibold'
                : 'bg-gray-200 text-black'
            }`}>
            GOV
          </button>
        </div>
      </TableCell>
      <TableCell>
        <Input 
          type="number" 
          value={row.egg_m || ''} 
          onChange={e => onChange(index, 'egg_m', Number(e.target.value))}
          className="w-14 h-8 text-xs p-1" 
        />
      </TableCell>
      <TableCell>
        <Input 
          type="number" 
          value={row.egg_f || ''} 
          onChange={e => onChange(index, 'egg_f', Number(e.target.value))}
          className="w-14 h-8 text-xs p-1" 
        />
      </TableCell>
      <TableCell className="text-xs text-center">{eggTotal}</TableCell>
      <TableCell className="text-xs text-center">₹{eggMoney}</TableCell>
      <TableCell>
        <Input 
          type="number" 
          value={row.banana_m || ''} 
          onChange={e => onChange(index, 'banana_m', Number(e.target.value))}
          className="w-14 h-8 text-xs p-1" 
        />
      </TableCell>
      <TableCell>
        <Input 
          type="number" 
          value={row.banana_f || ''} 
          onChange={e => onChange(index, 'banana_f', Number(e.target.value))}
          className="w-14 h-8 text-xs p-1" 
        />
      </TableCell>
      <TableCell className="text-xs text-center">{bananaTotal}</TableCell>
      <TableCell className="text-xs text-center">₹{bananaMoney}</TableCell>
      <TableCell className="text-xs text-center font-bold">{eggTotal}</TableCell>
      <TableCell className="text-xs text-center font-bold">{bananaTotal}</TableCell>
      <TableCell className="text-xs text-center font-bold">{grandTotal}</TableCell>
      <TableCell className="text-xs font-bold">₹{totalMoney}</TableCell>
    </TableRow>
  );
});

EggTableRow.displayName = 'EggTableRow';

export default EggTableRow;
