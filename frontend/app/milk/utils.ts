export interface MilkRow {
  id: number;
  date: string;
  children: number;
  milk_open: number;
  ragi_open: number;
  milk_rcpt: number;
  ragi_rcpt: number;
  dist_type: 'milk & ragi' | 'only milk';
}

// Date helper functions
export const getDayName = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00');
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
};

export const isSunday = (dateStr: string) => new Date(dateStr + 'T12:00:00').getDay() === 0;

export const isMonWedFri = (dateStr: string) => [1, 3, 5].includes(new Date(dateStr + 'T12:00:00').getDay());

// Calculation functions
export const calculateTotalMilk = (milk_open: number, milk_rcpt: number) => {
  return (milk_open || 0) + (milk_rcpt || 0);
};

export const calculateTotalRagi = (ragi_open: number, ragi_rcpt: number) => {
  return (ragi_open || 0) + (ragi_rcpt || 0);
};

export const calculateMilkDistribution = (children: number) => {
  return (children || 0) * 0.018;
};

export const calculateRagiDistribution = (children: number, dist_type: string, date: string) => {
  return dist_type === 'milk & ragi' && isMonWedFri(date) 
    ? (children || 0) * 0.005 
    : 0;
};

export const calculateClosingMilk = (totalMilk: number, distMilk: number) => {
  return (totalMilk || 0) - (distMilk || 0);
};

export const calculateClosingRagi = (totalRagi: number, distRagi: number) => {
  return (totalRagi || 0) - (distRagi || 0);
};

export const calculateSugar = (children: number) => {
  return (children || 0) * 0.44;
};

// Recalculate opening stock for subsequent rows
export const recalculateOpeningStock = (rows: MilkRow[], startIdx: number): MilkRow[] => {
  const newRows = [...rows];
  
  for (let i = startIdx; i < newRows.length; i++) {
    const curr = newRows[i];
    const prev = i > 0 ? newRows[i - 1] : null;
    
    if (prev) {
      const prevTotalMilk = calculateTotalMilk(prev.milk_open || 0, prev.milk_rcpt || 0);
      const prevDistMilk = calculateMilkDistribution(prev.children || 0);
      curr.milk_open = calculateClosingMilk(prevTotalMilk, prevDistMilk);
      
      const prevTotalRagi = calculateTotalRagi(prev.ragi_open || 0, prev.ragi_rcpt || 0);
      const prevDistRagi = calculateRagiDistribution(prev.children || 0, prev.dist_type, prev.date);
      curr.ragi_open = calculateClosingRagi(prevTotalRagi, prevDistRagi);
    }
  }
  
  return newRows;
};

// Calculate grand totals
export const calculateTotals = (rows: MilkRow[]) => {
  return rows.reduce((acc, r) => {
    acc.children += r.children || 0;
    acc.milk_rcpt += r.milk_rcpt || 0;
    acc.ragi_rcpt += r.ragi_rcpt || 0;
    acc.milk_dist += calculateMilkDistribution(r.children || 0);
    acc.ragi_dist += calculateRagiDistribution(r.children || 0, r.dist_type, r.date);
    acc.sugar += calculateSugar(r.children || 0);
    return acc;
  }, { children: 0, milk_rcpt: 0, ragi_rcpt: 0, milk_dist: 0, ragi_dist: 0, sugar: 0 });
};
