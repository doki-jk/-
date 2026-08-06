import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dayPlanRepository } from '../repositories/dayPlanRepository';
import { goalRepository, type DayType } from '../repositories/goalRepository';
import { mealRepository } from '../repositories/mealRepository';
import type { DailyGoal, FoodEntry } from '../types';
import { assertDateKey, localDateFromKey, localDateKey } from '../utils/date';

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
  applyGoals: (training: DailyGoal, rest: DailyGoal) => Promise<string | null>;
  addFood: (food: FoodEntry) => Promise<void>;
  updateFood: (id: string, food: FoodEntry) => Promise<void>;
  removeFood: (id: string) => Promise<FoodEntry>;
  toggleTrainingDay: () => Promise<void>;
}

let dateLoadSequence = 0;

function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;

  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; error?: unknown };
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message;
    if (typeof candidate.error === 'string' && candidate.error.trim()) return candidate.error;

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}') return `${fallback}：${serialized}`;
    } catch {
      // Use fallback for non-serializable plugin errors.
    }
  }

  return fallback;
}

function selectedDateTime(date: string): string {
  const now = new Date();
  const value = localDateFromKey(date, now.getHours());
  value.setMinutes(now.getMinutes(), now.getSeconds(), 0);
  return value.toISOString();
}

function resolveConsumedAt(food: FoodEntry, selectedDate: string): string {
  if (food.consumedAt) {
    const value = new Date(food.consumedAt);
    if (Number.isNaN(value.getTime())) throw new Error('饮食时间无效');
    return value.toISOString();
  }
  return selectedDateTime(selectedDate);
}

function toFoodEntry(entry: Awaited<ReturnType<typeof mealRepository.add>>): FoodEntry {
  return {
    id: entry.id,
    foodId: entry.foodId,
    name: entry.foodName,
    meal: entry.mealType,
    consumedAt: entry.consumedAt,
    amount: entry.amount,
    unit: entry.unit,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
  };
}

function sortFoods(foods: FoodEntry[]): FoodEntry[] {
  return [...foods].sort((left, right) => (left.consumedAt ?? '').localeCompare(right.consumedAt ?? ''));
}

export const useNutritionStore = create<State>()(
  persist(
    (set, get) => ({
      foods: [],
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
          set({ error: describeError(error, '日期无效') });
          return;
        }

        const requestId = ++dateLoadSequence;
        set({ loading: true, error: null });
        try {
          const entries = await mealRepository.getByDate(date);
          let plan = await dayPlanRepository.get(date);
          if (!plan) {
            const fallbackType: DayType = date === get().selectedDate && !get().trainingDay ? 'rest' : 'training';
            const fallbackGoal = await goalRepository.get(fallbackType);
            plan = await dayPlanRepository.save(date, fallbackType, fallbackGoal);
          }
          if (requestId !== dateLoadSequence) return;
          set({
            selectedDate: date,
            foods: entries.map(toFoodEntry),
            trainingDay: plan.dayType === 'training',
            goal: plan.goal,
            loading: false,
            error: null,
          });
        } catch (error) {
          if (requestId !== dateLoadSequence) return;
          set({ loading: false, error: describeError(error, '读取饮食记录失败') });
        }
      },

      loadGoal: async () => {
        const date = get().selectedDate;
        try {
          const existing = await dayPlanRepository.get(date);
          if (existing) {
            set({ goal: existing.goal, trainingDay: existing.dayType === 'training', error: null });
            return;
          }
          const dayType: DayType = get().trainingDay ? 'training' : 'rest';
          const goal = await goalRepository.get(dayType);
          await dayPlanRepository.save(date, dayType, goal);
          set({ goal, error: null });
        } catch (error) {
          set({ error: describeError(error, '读取营养目标失败') });
        }
      },

      saveGoal: async (dayType, goal) => {
        try {
          await goalRepository.save(dayType, goal);
          if ((dayType === 'training') === get().trainingDay) {
            await dayPlanRepository.save(get().selectedDate, dayType, goal);
            set({ goal, error: null });
          }
        } catch (error) {
          const message = describeError(error, '保存营养目标失败');
          set({ error: message });
          throw new Error(message);
        }
      },

      applyGoals: async (training, rest) => {
        set({ error: null });
        try {
          await goalRepository.saveBoth(training, rest);
          const state = get();
          const dayType: DayType = state.trainingDay ? 'training' : 'rest';
          const activeGoal = dayType === 'training' ? training : rest;
          let warning: string | null = null;
          try {
            await dayPlanRepository.save(state.selectedDate, dayType, activeGoal);
          } catch (syncError) {
            warning = describeError(syncError, '当天目标快照同步失败');
            console.warn('两套目标已保存，但当天目标快照同步失败', syncError);
          }
          set({ goal: activeGoal, error: null });
          return warning;
        } catch (error) {
          const message = describeError(error, '应用营养建议失败');
          set({ error: message });
          throw new Error(message);
        }
      },

      addFood: async (food) => {
        set({ error: null });
        try {
          const saved = await mealRepository.add({
            foodId: food.foodId ?? null,
            foodName: food.name,
            mealType: food.meal,
            consumedAt: resolveConsumedAt(food, get().selectedDate),
            amount: food.amount,
            unit: food.unit,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
          }, { trackUsage: food.trackUsage !== false });
          set((state) => ({ foods: sortFoods([...state.foods, toFoodEntry(saved)]) }));
        } catch (error) {
          set({ error: describeError(error, '保存饮食记录失败') });
          throw error;
        }
      },

      updateFood: async (id, food) => {
        set({ error: null });
        try {
          const saved = await mealRepository.update(id, {
            foodId: food.foodId ?? null,
            foodName: food.name,
            mealType: food.meal,
            consumedAt: resolveConsumedAt(food, get().selectedDate),
            amount: food.amount,
            unit: food.unit,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
          });
          set((state) => ({
            foods: sortFoods(state.foods.map((entry) => entry.id === id ? toFoodEntry(saved) : entry)),
          }));
        } catch (error) {
          set({ error: describeError(error, '修改饮食记录失败') });
          throw error;
        }
      },

      removeFood: async (id) => {
        const removed = get().foods.find((food) => food.id === id);
        if (!removed) throw new Error('找不到要删除的饮食记录');
        set({ error: null });
        try {
          await mealRepository.remove(id);
          set((state) => ({ foods: state.foods.filter((food) => food.id !== id) }));
          return removed;
        } catch (error) {
          set({ error: describeError(error, '删除饮食记录失败') });
          throw error;
        }
      },

      toggleTrainingDay: async () => {
        const trainingDay = !get().trainingDay;
        const dayType: DayType = trainingDay ? 'training' : 'rest';
        try {
          const goal = await goalRepository.get(dayType);
          await dayPlanRepository.save(get().selectedDate, dayType, goal);
          set({ trainingDay, goal, error: null });
        } catch (error) {
          set({ error: describeError(error, '切换营养目标失败') });
        }
      },
    }),
    {
      name: 'fuellog-nutrition',
      partialize: ({ selectedDate }) => ({ selectedDate }),
    },
  ),
);
