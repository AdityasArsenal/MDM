// Task 4: Move non-interactive logic out of client component
// These pure functions don't need React context and can be tree-shaken

export type MealType = 'rice' | 'wheat' | null;

export interface MealRow {
  id: number;
  date: string;
  cnt_1to5: number;
  cnt_6to10: number;
  meal_type: MealType;
  has_pulses: boolean | null; // null = not chosen yet
}

// Rates come from the backend per month. rice/wheat/oil/pulse are GRAMS PER CHILD, sadilvaru is a value per child.
export interface RateGroup {
  rice_g: number;
  wheat_g: number;
  oil_g: number;
  pulse_g: number;
  sadilvaru: number;
}

export interface MealRates {
  g1_5: RateGroup;
  g6_10: RateGroup;
}

export interface RatesResponse {
  source: 'saved' | 'inherited' | 'none';
  year: number;
  month: number;
  inherited_from: { year: number; month: number } | null;
  rates: MealRates | null;
}

const ZERO_RESULT = { rice: 0, wheat: 0, oil: 0, pulses: 0, sadilvaru: 0 };

// Pure calculation functions - no React dependencies
// rice/wheat/oil/pulses are in KG (grams * count / 1000); sadilvaru = rate * count
export const calculateMeal = (
  rates: RateGroup | null,
  count: number,
  mealType: MealType,
  hasPulses: boolean | null // null counts as no pulses
) => {
  if (!rates || !mealType) return ZERO_RESULT;

  return {
    rice: mealType === 'rice' ? (rates.rice_g * count) / 1000 : 0,
    wheat: mealType === 'wheat' ? (rates.wheat_g * count) / 1000 : 0,
    oil: (rates.oil_g * count) / 1000,
    pulses: hasPulses === true ? (rates.pulse_g * count) / 1000 : 0,
    sadilvaru: rates.sadilvaru * count,
  };
};

export const calc1to5 = (rates: MealRates | null, count: number, mealType: MealType, hasPulses: boolean | null) =>
  calculateMeal(rates ? rates.g1_5 : null, count, mealType, hasPulses);

export const calc6to10 = (rates: MealRates | null, count: number, mealType: MealType, hasPulses: boolean | null) =>
  calculateMeal(rates ? rates.g6_10 : null, count, mealType, hasPulses);

// Date helper functions - pure, no side effects
export const getDayName = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00');
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
};

export const isSunday = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00');
  return d.getDay() === 0;
};

export const isToday = (dateStr: string) => {
  const today = new Date();
  const d = new Date(dateStr + 'T12:00:00');
  return d.getDate() === today.getDate() && 
         d.getMonth() === today.getMonth() && 
         d.getFullYear() === today.getFullYear();
};

export const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00');
  return d.getDate();
};
