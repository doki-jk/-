import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { initialFoods } from '../data/mock';
import { isTauriRuntime } from '../database/client';
import { mealRepository } from '../repositories/mealRepository';
import type { DailyGoal, FoodEntry } from '../types';

interface State {
  foods: FoodEntry[];
  goal: DailyGoal;
  trainingDay: boolean;
  loading: boolean;
  error: string | null;
  loadToday: () => Promise<void>;
  addFood: (food: FoodEntry) => Promise<void>;
  removeFood: (id: string) => Promise<void>;
  toggleTrainingDay: () => void;
}

function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toFoodEntry(entry: Awaited<ReturnType<typeof mealRepository.add>>): FoodEntry {
  return {
    id: entry.id,
    name: entry.foodName,
    meal: entry.mealType,
    amount: entry.amount,
    unit: entry.unit,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
  };
}

export const useNutritionStore = create<State>()(
  persist(
    (set, get) => ({
      foods: initialFoods,
      goal: { calories: 2300, protein: 170, carbs: 260, fat: 70 },
      trainingDay: true,
      loading: false,
      error: null,

      loadToday: async () => {
        if (!isTauriRuntime()) return;
        set({ loading: true, error: null });
        try {
          const entries = await mealRepository.getByDate(todayKey());
          set({
            foods: entries.map((entry) => ({
              id: entry.id,
              name: entry.foodName,
              meal: entry.mealType,
              amount: entry.amount,
              unit: entry.unit,
              calories: entry.calories,
              protein: entry.protein,
              carbs: entry.carbs,
              fat: entry.fat,
            })),
            loading: false,
          });
        } catch (error) {
          set({
            loading: false,
            error: error instanceof Error ? error.message : '读取饮食记录失败',
          });
        }
      },

      addFood: async (food) => {
        if (!isTauriRuntime()) {
          set((state) => ({ foods: [...state.foods, food], error: null }));
          return;
        }

        set({ error: null });
        try {
          const saved = await mealRepository.add({
            foodName: food.name,
            mealType: food.meal,
            consumedAt: new Date().toISOString(),
            amount: food.amount,
            unit: food.unit,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
          });
          set((state) => ({ foods: [...state.foods, toFoodEntry(saved)] }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : '保存饮食记录失败' });
          throw error;
        }
      },

      removeFood: async (id) => {
        if (!isTauriRuntime()) {
          set((state) => ({ foods: state.foods.filter((food) => food.id !== id), error: null }));
          return;
        }

        set({ error: null });
        try {
          await mealRepository.remove(id);
          set((state) => ({ foods: state.foods.filter((food) => food.id !== id) }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : '删除饮食记录失败' });
          throw error;
        }
      },

      toggleTrainingDay: () => set({ trainingDay: !get().trainingDay }),
    }),
    {
      name: 'fuellog-nutrition',
      partialize: ({ foods, goal, trainingDay }) => ({ foods, goal, trainingDay }),
    },
  ),
);
