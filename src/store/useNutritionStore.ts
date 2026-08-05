import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { initialFoods } from '../data/mock';
import type { DailyGoal, FoodEntry } from '../types';

interface State {
  foods: FoodEntry[];
  goal: DailyGoal;
  trainingDay: boolean;
  addFood: (food: FoodEntry) => void;
  removeFood: (id: string) => void;
  toggleTrainingDay: () => void;
}

export const useNutritionStore = create<State>()(
  persist(
    (set) => ({
      foods: initialFoods,
      goal: { calories: 2300, protein: 170, carbs: 260, fat: 70 },
      trainingDay: true,
      addFood: (food) => set((state) => ({ foods: [...state.foods, food] })),
      removeFood: (id) => set((state) => ({ foods: state.foods.filter((food) => food.id !== id) })),
      toggleTrainingDay: () => set((state) => ({ trainingDay: !state.trainingDay })),
    }),
    {
      name: 'fuellog-nutrition',
      partialize: ({ foods, goal, trainingDay }) => ({ foods, goal, trainingDay }),
    },
  ),
);
