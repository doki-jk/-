import type Database from '@tauri-apps/plugin-sql';
import {
  createLocalId,
  readBrowserData,
  writeBrowserData,
} from '../database/browserStorage';
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

function databaseErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; error?: unknown; code?: unknown };
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message;
    if (typeof candidate.error === 'string' && candidate.error.trim()) return candidate.error;
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== '{}') return serialized;
    } catch {
      // Fall through to a stable message.
    }
  }
  return '数据库没有返回具体错误信息';
}

async function saveDesktopGoals(
  db: Database,
  updates: Array<[DayType, DailyGoal]>,
): Promise<void> {
  const now = new Date().toISOString();
  await db.execute('BEGIN IMMEDIATE');
  try {
    for (const [dayType, goal] of updates) {
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
        [
          createLocalId('goal'),
          dayType,
          goal.calories,
          goal.protein,
          goal.carbs,
          goal.fat,
          now,
          now,
        ],
      );
    }
    await db.execute('COMMIT');
  } catch (error) {
    try {
      await db.execute('ROLLBACK');
    } catch (rollbackError) {
      console.error('回滚营养目标事务失败', rollbackError);
    }
    throw new Error(`SQLite 保存营养目标失败：${databaseErrorMessage(error)}`);
  }
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
    await saveDesktopGoals(db, [[dayType, goal]]);
  },

  async saveBoth(training: DailyGoal, rest: DailyGoal): Promise<void> {
    validate(training);
    validate(rest);

    if (!isTauriRuntime()) {
      writeBrowserData('goals', {
        training: { ...training },
        rest: { ...rest },
      });
      return;
    }

    const db = await getDatabase();
    await saveDesktopGoals(db, [
      ['training', training],
      ['rest', rest],
    ]);
  },
};
