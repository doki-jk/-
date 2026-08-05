import { getDatabase } from '../database/client';

export interface DailyNutritionPoint {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function assertDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00`))) {
    throw new Error(`${label}格式必须为 YYYY-MM-DD`);
  }
}

function localDayToIso(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

function nextLocalDayToIso(date: string): string {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + 1);
  return value.toISOString();
}

export const analyticsRepository = {
  async getDailyNutrition(startDate: string, endDate: string): Promise<DailyNutritionPoint[]> {
    assertDate(startDate, '开始日期');
    assertDate(endDate, '结束日期');
    if (startDate > endDate) throw new Error('开始日期不能晚于结束日期');

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

    const key = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const values = await this.getDailyNutrition(key(start), key(end));
    const byDate = new Map(values.map((item) => [item.date, item]));
    const result: DailyNutritionPoint[] = [];

    for (let index = 0; index < 7; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = key(date);
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
