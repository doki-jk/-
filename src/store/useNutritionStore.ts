import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { initialFoods } from '../data/mock';
import { isTauriRuntime } from '../database/client';
import { goalRepository, type DayType } from '../repositories/goalRepository';
import { mealRepository } from '../repositories/mealRepository';
import type { DailyGoal, FoodEntry } from '../types';

interface State {
  foods: FoodEntry[];
  goal: DailyGoal;
  trainingDay: boolean;
  selectedDate: string;
  loading: boolean;
  error: string | null;
  loadToday: () => Promise<void>;
  loadDate: (date: string) => Promise<void>;
  loadGoal: () => Promise<void>;
  saveGoal: (dayType: DayType, goal: DailyGoal) => Promise<void>;
  addFood: (food: FoodEntry) => Promise<void>;
  removeFood: (id: string) => Promise<void>;
  toggleTrainingDay: () => Promise<void>;
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function assertDateKey(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00`))) {
    throw new Error('日期格式必须为 YYYY-MM-DD');
  }
}

function selectedDateTime(date: string): string {
  assertDateKey(date);
  const now = new Date();
  const value = new Date(`${date}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
  return value.toISOString();
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
      goal: goalRepository.defaults.training,
      trainingDay: true,
      selectedDate: localDateKey(),
      loading: false,
      error: null,

      loadToday: async () => {
        await get().loadDate(localDateKey());
      },

      loadDate: async (date) => {
        try {
          assertDateKey(date);
        } catch (error) {
          set({ error: error instanceof Error ? error.message : '日期无效' });
          return;
        }

        if (!isTauriRuntime()) {
          set({ selectedDate: date, error: null });
          return;
        }

        set({ selectedDate: date, loading: true, error: null });
        try {
          const entries = await mealRepository.getByDate(date);
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

      loadGoal: async () => {
        const dayType: DayType = get().trainingDay ? 'training' : 'rest';
        if (!isTauriRuntime()) {
          set({ goal: goalRepository.defaults[dayType], error: null });
          return;
        }
        try {
          set({ goal: await goalRepository.get(dayType), error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : '读取营养目标失败' });
        }
      },

      saveGoal: async (dayType, goal) => {
        if (isTauriRuntime()) await goalRepository.save(dayType, goal);
        if ((dayType === 'training') === get().trainingDay) set({ goal, error: null });
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
            consumedAt: selectedDateTime(get().selectedDate),
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

      toggleTrainingDay: async () => {
        const trainingDay = !get().trainingDay;
        const dayType: DayType = trainingDay ? 'training' : 'rest';
        set({ trainingDay, error: null });
        try {
          const goal = isTauriRuntime()
            ? await goalRepository.get(dayType)
            : goalRepository.defaults[dayType];
          set({ goal });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : '切换营养目标失败' });
        }
      },
    }),
    {
      name: 'fuellog-nutrition',
      partialize: ({ foods, goal, trainingDay }) => ({ foods, goal, trainingDay }),
    },
  ),
);
