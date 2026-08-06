import { getDatabase, isTauriRuntime } from '../database/client';
import { assertDateKey, localDateFromKey, localDateKey } from '../utils/date';
import { mealRepository } from './mealRepository';

export interface DailyNutritionPoint {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function localDayToIso(date: string): string {
  return localDateFromKey(date, 0).toISOString();
}

function nextLocalDayToIso(date: string): string {
  const value = localDateFromKey(date, 0);
  value.setDate(value.getDate() + 1);
  return value.toISOString();
}

export const analyticsRepository = {
  async getDailyNutrition(startDate: string, endDate: string): Promise<DailyNutritionPoint[]> {
    assertDateKey(startDate, '开始日期格式必须为 YYYY-MM-DD');
    assertDateKey(endDate, '结束日期格式必须为 YYYY-MM-DD');
    if (startDate > endDate) throw new Error('开始日期不能晚于结束日期');

    if (!isTauriRuntime()) {
      const start = localDateFromKey(startDate);
      const end = localDateFromKey(endDate);
      const points: DailyNutritionPoint[] = [];
      for (const current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
        const date = localDateKey(current);
        const summary = await mealRepository.getDailySummary(date);
        points.push({ date, ...summary });
      }
      return points;
    }

    const db = await getDatabase();
    const rows = await db.select<DailyNutritionPoint[]>(
      `SELECT
         DATE(consumed_at, 'localtime') AS date,
         ROUND(COALESCE(SUM(calories), 0), 1) AS calories,
         ROUND(COALESCE(SUM(protein), 0), 1) AS protein,
         ROUND(COALESCE(SUM(carbs), 0), 1) AS carbs,
         ROUND(COALESCE(SUM(fat), 0), 1) AS fat
       FROM meal_entries
       WHERE consumed_at >= ? AND consumed_at < ?
       GROUP BY DATE(consumed_at, 'localtime')
       ORDER BY date ASC`,
      [localDayToIso(startDate), nextLocalDayToIso(endDate)],
    );

    return rows;
  },

  async getLastSevenDays(): Promise<DailyNutritionPoint[]> {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    const values = await this.getDailyNutrition(localDateKey(start), localDateKey(end));
    const byDate = new Map(values.map((item) => [item.date, item]));
    const result: DailyNutritionPoint[] = [];

    for (let index = 0; index < 7; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = localDateKey(date);
      result.push(
        byDate.get(dateKey) ?? {
          date: dateKey,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        },
      );
    }

    return result;
  },
};
