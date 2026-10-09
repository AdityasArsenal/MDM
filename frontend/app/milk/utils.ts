export interface MilkRow {
  id: number;
  date: string;
  children: number;
  milk_open: number;
  ragi_open: number;
  milk_rcpt: number;
  ragi_rcpt: number;
  dist_type: 'milk & ragi' | 'only milk' | null; // null = not chosen yet
}

// Per-child rates for one month. Units: milk in ml, ragi in grams, sugar in rupees.
export interface MilkRates {
  milk_ml: number;
  ragi_g: number;
  sugar_rupees: number;
}

export interface RatesResponse {
  source: 'saved' | 'inherited' | 'none';
  year: number;
  month: number;
  inherited_from: { year: number; month: number } | null;
  rates: MilkRates | null;
}

// Date helper functions
export const getDayName = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00');
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
};

export const isSunday = (dateStr: string) => new Date(dateStr + 'T12:00:00').getDay() === 0;

// Calculation functions. Stock values: milk in LITRES, ragi in KG.
export const calculateTotalMilk = (milk_open: number, milk_rcpt: number) => {
  return (milk_open || 0) + (milk_rcpt || 0);
};

export const calculateTotalRagi = (ragi_open: number, ragi_rcpt: number) => {
  return (ragi_open || 0) + (ragi_rcpt || 0);
};

// Milk distributed, in LITRES. Counted every day there are children.
export const calculateMilkDistribution = (children: number, rates: MilkRates | null) => {
  if (!rates) return 0;
  return ((children || 0) * rates.milk_ml) / 1000;
};

// Ragi distributed, in KG. Depends only on the user's choice, never on the day of the week.
// 'only milk' and not-chosen (null) give 0.
export const calculateRagiDistribution = (children: number, dist_type: string | null, rates: MilkRates | null) => {
  if (!rates || dist_type !== 'milk & ragi') return 0;
  return ((children || 0) * rates.ragi_g) / 1000;
};

export const calculateClosingMilk = (totalMilk: number, distMilk: number) => {
  return (totalMilk || 0) - (distMilk || 0);
};

export const calculateClosingRagi = (totalRagi: number, distRagi: number) => {
  return (totalRagi || 0) - (distRagi || 0);
};

// Sugar in RUPEES (not divided by 1000)
export const calculateSugar = (children: number, rates: MilkRates | null) => {
  if (!rates) return 0;
  return (children || 0) * rates.sugar_rupees;
};

// Recompute opening stock from startIdx onwards. Day 1 (index 0) is never derived.
// Returns new row objects; the input rows are not modified.
export const recalculateOpeningStock = (rows: MilkRow[], rates: MilkRates | null, startIdx: number): MilkRow[] => {
  const newRows = [...rows];

  for (let i = Math.max(startIdx, 1); i < newRows.length; i++) {
    const prev = newRows[i - 1];

    const prevTotalMilk = calculateTotalMilk(prev.milk_open || 0, prev.milk_rcpt || 0);
    const prevDistMilk = calculateMilkDistribution(prev.children || 0, rates);
    const prevTotalRagi = calculateTotalRagi(prev.ragi_open || 0, prev.ragi_rcpt || 0);
    const prevDistRagi = calculateRagiDistribution(prev.children || 0, prev.dist_type, rates);

    newRows[i] = {
      ...newRows[i],
      milk_open: calculateClosingMilk(prevTotalMilk, prevDistMilk),
      ragi_open: calculateClosingRagi(prevTotalRagi, prevDistRagi),
    };
  }

  return newRows;
};

// Calculate grand totals
export const calculateTotals = (rows: MilkRow[], rates: MilkRates | null) => {
  return rows.reduce((acc, r) => {
    acc.children += r.children || 0;
    acc.milk_rcpt += r.milk_rcpt || 0;
    acc.ragi_rcpt += r.ragi_rcpt || 0;
    acc.milk_dist += calculateMilkDistribution(r.children || 0, rates);
    acc.ragi_dist += calculateRagiDistribution(r.children || 0, r.dist_type, rates);
    acc.sugar += calculateSugar(r.children || 0, rates);
    return acc;
  }, { children: 0, milk_rcpt: 0, ragi_rcpt: 0, milk_dist: 0, ragi_dist: 0, sugar: 0 });
};

// toFixed that never shows "-0.000" for tiny negative float noise; real negatives keep their minus sign
export const fmt = (n: number, digits = 3) => {
  const s = (Number.isFinite(n) ? n : 0).toFixed(digits);
  return Number(s) === 0 ? (0).toFixed(digits) : s;
};
