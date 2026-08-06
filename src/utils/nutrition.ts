export interface NutritionValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function roundNutrition(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function scaleNutrition(
  nutrition: NutritionValues,
  amount: number,
  baseAmount: number,
): NutritionValues {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('数量必须大于 0');
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) throw new Error('基准数量必须大于 0');

  const ratio = amount / baseAmount;
  return {
    calories: roundNutrition(nutrition.calories * ratio),
    protein: roundNutrition(nutrition.protein * ratio),
    carbs: roundNutrition(nutrition.carbs * ratio),
    fat: roundNutrition(nutrition.fat * ratio),
  };
}

export function isValidNutrition(values: NutritionValues): boolean {
  return Object.values(values).every((value) => Number.isFinite(value) && value >= 0);
}
