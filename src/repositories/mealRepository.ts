import {
  createLocalId,
  localDateKeyFromIso,
  readBrowserData,
  writeBrowserData,
} from '../database/browserStorage';
import { getDatabase, isTauriRuntime } from '../database/client';
import type { MealType } from '../types';
import { assertDateKey, localDateFromKey } from '../utils/date';
import { foodRepository } from './foodRepository';

export interface MealEntry {
  id: string;
  foodId: string | null;
  foodName: string;
  mealType: MealType;
  consumedAt: string;
  amount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: string;
  updatedAt: string;
}

interface MealEntryRow {
  id: string;
  food_id: string | null;
  food_name: string;
  meal_type: MealType;
  consumed_at: string;
  amount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMealEntryInput {
  foodId?: string | null;
  foodName: string;
  mealType: MealType;
  consumedAt: string;
  amount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DailyNutritionSummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function mapRow(row: MealEntryRow): MealEntry {
  return {
    id: row.id,
    foodId: row.food_id,
    foodName: row.food_name,
    mealType: row.meal_type,
    consumedAt: row.consumed_at,
    amount: row.amount,
    unit: row.unit,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validate(input: CreateMealEntryInput): void {
  if (!input.foodName.trim()) throw new Error('食物名称不能为空');
  if (!input.unit.trim()) throw new Error('单位不能为空');
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('数量必须大于 0');
  if (Number.isNaN(new Date(input.consumedAt).getTime())) throw new Error('食用时间无效');
  for (const [label, value] of [
    ['热量', input.calories],
    ['蛋白质', input.protein],
    ['碳水', input.carbs],
    ['脂肪', input.fat],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${label}不能为负数`);
  }
}

function dayRange(date: string): [string, string] {
  const start = localDateFromKey(date, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return [start.toISOString(), end.toISOString()];
}

function browserEntries(): MealEntry[] {
  return readBrowserData<MealEntry[]>('meal-entries', []);
}

function sortEntries(entries: MealEntry[]): MealEntry[] {
  return [...entries].sort((left, right) =>
    left.consumedAt.localeCompare(right.consumedAt)
      || left.createdAt.localeCompare(right.createdAt));
}

export const mealRepository = {
  async getByDate(date: string): Promise<MealEntry[]> {
    assertDateKey(date);

    if (!isTauriRuntime()) {
      return sortEntries(browserEntries().filter((entry) => localDateKeyFromIso(entry.consumedAt) === date));
    }

    const db = await getDatabase();
    const [start, end] = dayRange(date);
    const rows = await db.select<MealEntryRow[]>(
      `SELECT * FROM meal_entries
       WHERE consumed_at >= ? AND consumed_at < ?
       ORDER BY consumed_at ASC, created_at ASC`,
      [start, end],
    );
    return rows.map(mapRow);
  },

  async add(input: CreateMealEntryInput): Promise<MealEntry> {
    validate(input);
    const now = new Date().toISOString();

    if (!isTauriRuntime()) {
      const entry: MealEntry = {
        id: createLocalId('meal'),
        foodId: input.foodId ?? null,
        foodName: input.foodName.trim(),
        mealType: input.mealType,
        consumedAt: input.consumedAt,
        amount: input.amount,
        unit: input.unit.trim(),
        calories: input.calories,
        protein: input.protein,
        carbs: input.carbs,
        fat: input.fat,
        createdAt: now,
        updatedAt: now,
      };
      writeBrowserData('meal-entries', [...browserEntries(), entry]);
      if (entry.foodId) await foodRepository.incrementUsage(entry.foodId);
      return entry;
    }

    const db = await getDatabase();
    const id = crypto.randomUUID();
    await db.execute(
      `INSERT INTO meal_entries(
        id,food_id,food_name,meal_type,consumed_at,amount,unit,
        calories,protein,carbs,fat,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        input.foodId ?? null,
        input.foodName.trim(),
        input.mealType,
        input.consumedAt,
        input.amount,
        input.unit.trim(),
        input.calories,
        input.protein,
        input.carbs,
        input.fat,
        now,
        now,
      ],
    );
    if (input.foodId) await foodRepository.incrementUsage(input.foodId);
    const rows = await db.select<MealEntryRow[]>('SELECT * FROM meal_entries WHERE id = ?', [id]);
    if (!rows[0]) throw new Error('饮食记录保存后未能读取');
    return mapRow(rows[0]);
  },

  async update(id: string, input: CreateMealEntryInput): Promise<MealEntry> {
    validate(input);
    const updatedAt = new Date().toISOString();

    if (!isTauriRuntime()) {
      const entries = browserEntries();
      const existing = entries.find((entry) => entry.id === id);
      if (!existing) throw new Error('找不到要修改的饮食记录');
      const updated: MealEntry = {
        ...existing,
        foodId: input.foodId ?? null,
        foodName: input.foodName.trim(),
        mealType: input.mealType,
        consumedAt: input.consumedAt,
        amount: input.amount,
        unit: input.unit.trim(),
        calories: input.calories,
        protein: input.protein,
        carbs: input.carbs,
        fat: input.fat,
        updatedAt,
      };
      writeBrowserData('meal-entries', entries.map((entry) => entry.id === id ? updated : entry));
      return updated;
    }

    const db = await getDatabase();
    const result = await db.execute(
      `UPDATE meal_entries SET
        food_id = ?, food_name = ?, meal_type = ?, consumed_at = ?, amount = ?, unit = ?,
        calories = ?, protein = ?, carbs = ?, fat = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.foodId ?? null,
        input.foodName.trim(),
        input.mealType,
        input.consumedAt,
        input.amount,
        input.unit.trim(),
        input.calories,
        input.protein,
        input.carbs,
        input.fat,
        updatedAt,
        id,
      ],
    );
    if (result.rowsAffected === 0) throw new Error('找不到要修改的饮食记录');
    const rows = await db.select<MealEntryRow[]>('SELECT * FROM meal_entries WHERE id = ?', [id]);
    if (!rows[0]) throw new Error('饮食记录修改后未能读取');
    return mapRow(rows[0]);
  },

  async remove(id: string): Promise<void> {
    if (!isTauriRuntime()) {
      const entries = browserEntries();
      if (!entries.some((entry) => entry.id === id)) throw new Error('找不到要删除的饮食记录');
      writeBrowserData('meal-entries', entries.filter((entry) => entry.id !== id));
      return;
    }

    const db = await getDatabase();
    const result = await db.execute('DELETE FROM meal_entries WHERE id = ?', [id]);
    if (result.rowsAffected === 0) throw new Error('找不到要删除的饮食记录');
  },

  async getDailySummary(date: string): Promise<DailyNutritionSummary> {
    assertDateKey(date);
    if (!isTauriRuntime()) {
      const entries = await this.getByDate(date);
      return entries.reduce<DailyNutritionSummary>((total, entry) => ({
        calories: total.calories + entry.calories,
        protein: total.protein + entry.protein,
        carbs: total.carbs + entry.carbs,
        fat: total.fat + entry.fat,
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    }

    const db = await getDatabase();
    const [start, end] = dayRange(date);
    const rows = await db.select<DailyNutritionSummary[]>(
      `SELECT COALESCE(SUM(calories),0) AS calories,
              COALESCE(SUM(protein),0) AS protein,
              COALESCE(SUM(carbs),0) AS carbs,
              COALESCE(SUM(fat),0) AS fat
       FROM meal_entries WHERE consumed_at >= ? AND consumed_at < ?`,
      [start, end],
    );
    return rows[0] ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
  },

  async copyDay(sourceDate: string, targetDate: string): Promise<number> {
    assertDateKey(sourceDate);
    assertDateKey(targetDate, '目标日期格式必须为 YYYY-MM-DD');
    const entries = await this.getByDate(sourceDate);
    const target = localDateFromKey(targetDate);
    let copied = 0;
    for (const entry of entries) {
      await this.add({
        foodId: entry.foodId,
        foodName: entry.foodName,
        mealType: entry.mealType,
        consumedAt: target.toISOString(),
        amount: entry.amount,
        unit: entry.unit,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
      });
      copied += 1;
    }
    return copied;
  },
};
