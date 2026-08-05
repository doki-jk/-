import { getDatabase } from '../database/client';
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

export const goalRepository = {
  defaults,

  async get(dayType: DayType): Promise<DailyGoal> {
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
