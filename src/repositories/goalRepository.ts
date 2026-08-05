import { readBrowserData, writeBrowserData } from '../database/browserStorage';
import { getDatabase, isTauriRuntime } from '../database/client';
import type { DailyGoal } from '../types';

export type DayType = 'training' | 'rest';

interface GoalRow {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const defaults: Record<DayType, DailyGoal> = {
  training: { calories: 2300, protein: 170, carbs: 260, fat: 70 },
  rest: { calories: 2050, protein: 170, carbs: 205, fat: 70 },
};

function validate(goal: DailyGoal): void {
  const values: Array<[string, number]> = [
    ['热量', goal.calories],
    ['蛋白质', goal.protein],
    ['碳水', goal.carbs],
    ['脂肪', goal.fat],
  ];
  for (const [label, value] of values) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${label}目标不能为负数`);
  }
  if (goal.calories <= 0) throw new Error('热量目标必须大于 0');
}

function browserGoals(): Record<DayType, DailyGoal> {
  return readBrowserData('goals', defaults);
}

export const goalRepository = {
  defaults,

  async get(dayType: DayType): Promise<DailyGoal> {
    if (!isTauriRuntime()) return browserGoals()[dayType] ?? defaults[dayType];

    const db = await getDatabase();
    const rows = await db.select<GoalRow[]>(
      `SELECT calories, protein, carbs, fat
       FROM nutrition_goals
       WHERE day_type = ? AND effective_to IS NULL
       ORDER BY effective_from DESC, created_at DESC
       LIMIT 1`,
      [dayType],
    );
    return rows[0] ?? defaults[dayType];
  },

  async save(dayType: DayType, goal: DailyGoal): Promise<void> {
    validate(goal);

    if (!isTauriRuntime()) {
      const goals = browserGoals();
      writeBrowserData('goals', { ...goals, [dayType]: { ...goal } });
      return;
    }

    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.execute('BEGIN IMMEDIATE');
    try {
      await db.execute(
        `UPDATE nutrition_goals
         SET effective_to = ?
         WHERE day_type = ? AND effective_to IS NULL`,
        [now, dayType],
      );
      await db.execute(
        `INSERT INTO nutrition_goals(
          id, goal_type, day_type, calories, protein, carbs, fat,
          effective_from, effective_to, created_at
        ) VALUES (?, 'daily_macro', ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [crypto.randomUUID(), dayType, goal.calories, goal.protein, goal.carbs, goal.fat, now, now],
      );
      await db.execute('COMMIT');
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
    }
  },
};
