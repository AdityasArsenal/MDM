// Task 4: Move non-interactive logic out of client component
// These pure functions don't need React context and can be tree-shaken

export type MealType = 'rice' | 'wheat' | null;

export interface MealRow {
  id: number;
  date: string;
  cnt_1to5: number;
  cnt_6to10: number;
  meal_type: MealType;
  has_pulses: boolean;
}

// Pure calculation functions - no React dependencies
export const calculateMeal = (
  count: number,
  mealType: MealType,
  hasPulses: boolean,
  isGrade1to5: boolean
) => {
  const riceVal = isGrade1to5 ? 0.1 : 0.15;
  const wheatVal = isGrade1to5 ? 0.1 : 0.15;
  const oilVal = isGrade1to5 ? 0.005 : 0.0075;
  const pulsesVal = isGrade1to5 ? 0.02 : 0.03;
  const sadilvaruVal = isGrade1to5 ? 2.15 : 3.12;

  if (!mealType) {
    return { rice: 0, wheat: 0, oil: 0, pulses: 0, sadilvaru: 0 };
  }

  const riceAmount = mealType === 'rice' ? count * riceVal : 0;
  const wheatAmount = mealType === 'wheat' ? count * wheatVal : 0;
  const oilAmount = count * oilVal;
  const pulsesAmount = hasPulses ? count * pulsesVal : 0;
  const sadilvaruAmount = count * sadilvaruVal;

  return { rice: riceAmount, wheat: wheatAmount, oil: oilAmount, pulses: pulsesAmount, sadilvaru: sadilvaruAmount };
};

export const calc1to5 = (count: number, mealType: MealType, hasPulses: boolean) =>
  calculateMeal(count, mealType, hasPulses, true);

export const calc6to10 = (count: number, mealType: MealType, hasPulses: boolean) =>
  calculateMeal(count, mealType, hasPulses, false);

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
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
