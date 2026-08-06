import { readBrowserData, writeBrowserData } from '../database/browserStorage';
import { getDatabase, isTauriRuntime } from '../database/client';
import type { DailyGoal } from '../types';
import type { DayType } from './goalRepository';

export interface DailyPlan {
  date: string;
  dayType: DayType;
  goal: DailyGoal;
  updatedAt: string;
}

interface DailyPlanRow {
  date: string;
  day_type: DayType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  updated_at: string;
}

function assertDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00`))) {
    throw new Error('日期格式必须为 YYYY-MM-DD');
  }
}

function validateGoal(goal: DailyGoal): void {
  if (!Number.isFinite(goal.calories) || goal.calories <= 0) throw new Error('热量目标必须大于 0');
  for (const [label, value] of [
    ['蛋白质', goal.protein],
    ['碳水', goal.carbs],
    ['脂肪', goal.fat],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${label}目标不能为负数`);
  }
}

function browserPlans(): Record<string, DailyPlan> {
  return readBrowserData<Record<string, DailyPlan>>('daily-plans', {});
}

function mapRow(row: DailyPlanRow): DailyPlan {
  return {
    date: row.date,
    dayType: row.day_type,
    goal: {
      calories: row.calories,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
    },
    updatedAt: row.updated_at,
  };
}

export const dayPlanRepository = {
  async get(date: string): Promise<DailyPlan | null> {
    assertDate(date);
    if (!isTauriRuntime()) return browserPlans()[date] ?? null;

    const db = await getDatabase();
    const rows = await db.select<DailyPlanRow[]>(
      'SELECT * FROM daily_plans WHERE date = ? LIMIT 1',
      [date],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  },

  async save(date: string, dayType: DayType, goal: DailyGoal): Promise<DailyPlan> {
    assertDate(date);
    validateGoal(goal);
    const updatedAt = new Date().toISOString();
    const plan: DailyPlan = { date, dayType, goal: { ...goal }, updatedAt };

    if (!isTauriRuntime()) {
      writeBrowserData('daily-plans', { ...browserPlans(), [date]: plan });
      return plan;
    }

    const db = await getDatabase();
    await db.execute(
      `INSERT INTO daily_plans(date, day_type, calories, protein, carbs, fat, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         day_type = excluded.day_type,
         calories = excluded.calories,
         protein = excluded.protein,
         carbs = excluded.carbs,
         fat = excluded.fat,
         updated_at = excluded.updated_at`,
      [date, dayType, goal.calories, goal.protein, goal.carbs, goal.fat, updatedAt],
    );
    return plan;
  },

  async ensure(date: string, dayType: DayType, goal: DailyGoal): Promise<DailyPlan> {
    return (await this.get(date)) ?? this.save(date, dayType, goal);
  },
};
