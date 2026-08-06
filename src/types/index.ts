export type MealType = '早餐' | '午餐' | '晚餐' | '加餐';

export interface FoodEntry {
  id: string;
  foodId?: string | null;
  name: string;
  meal: MealType;
  amount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DailyGoal {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
