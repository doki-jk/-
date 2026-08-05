import { getDatabase } from '../database/client';

export type FoodCategory =
  | '蛋白质来源'
  | '主食'
  | '水果'
  | '蔬菜'
  | '乳制品'
  | '坚果'
  | '补剂'
  | '常见外食'
  | '其他';

export interface Food {
  id: string;
  name: string;
  category: FoodCategory;
  baseAmount: number;
  baseUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isFavorite: boolean;
  isCustom: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface FoodRow {
  id: string;
  name: string;
  category: FoodCategory;
  base_amount: number;
  base_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  is_favorite: number;
  is_custom: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateFoodInput {
  name: string;
  category: FoodCategory;
  baseAmount: number;
  baseUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isCustom?: boolean;
}

function mapFood(row: FoodRow): Food {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    baseAmount: row.base_amount,
    baseUnit: row.base_unit,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    isFavorite: row.is_favorite === 1,
    isCustom: row.is_custom === 1,
    usageCount: row.usage_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function validateFood(input: CreateFoodInput): void {
  if (!input.name.trim()) throw new Error('食物名称不能为空');
  if (!Number.isFinite(input.baseAmount) || input.baseAmount <= 0) {
    throw new Error('基准数量必须大于 0');
  }
  for (const [label, value] of [
    ['热量', input.calories],
    ['蛋白质', input.protein],
    ['碳水', input.carbs],
    ['脂肪', input.fat]
  ] as const) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${label}不能为负数`);
  }
}

export const foodRepository = {
  async getAll(): Promise<Food[]> {
    const db = await getDatabase();
    const rows = await db.select<FoodRow[]>(
      `SELECT * FROM foods
       ORDER BY is_favorite DESC, usage_count DESC, name COLLATE NOCASE ASC`
    );
    return rows.map(mapFood);
  },

  async search(keyword: string): Promise<Food[]> {
    const db = await getDatabase();
    const normalized = keyword.trim();
    const rows = await db.select<FoodRow[]>(
      `SELECT * FROM foods
       WHERE name LIKE ? ESCAPE '\\'
       ORDER BY is_favorite DESC, usage_count DESC, name COLLATE NOCASE ASC
       LIMIT 50`,
      [`%${normalized.replace(/[\\%_]/g, '\\$&')}%`]
    );
    return rows.map(mapFood);
  },

  async getFavorites(): Promise<Food[]> {
    const db = await getDatabase();
    const rows = await db.select<FoodRow[]>(
      `SELECT * FROM foods
       WHERE is_favorite = 1
       ORDER BY usage_count DESC, name COLLATE NOCASE ASC`
    );
    return rows.map(mapFood);
  },

  async create(input: CreateFoodInput): Promise<Food> {
    validateFood(input);
    const db = await getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO foods(
        id, name, category, base_amount, base_unit,
        calories, protein, carbs, fat,
        is_favorite, is_custom, usage_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)`,
      [
        id,
        input.name.trim(),
        input.category,
        input.baseAmount,
        input.baseUnit.trim() || 'g',
        input.calories,
        input.protein,
        input.carbs,
        input.fat,
        input.isCustom === false ? 0 : 1,
        now,
        now
      ]
    );
    const rows = await db.select<FoodRow[]>('SELECT * FROM foods WHERE id = ?', [id]);
    if (!rows[0]) throw new Error('食物保存后未能读取');
    return mapFood(rows[0]);
  },

  async toggleFavorite(id: string): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `UPDATE foods
       SET is_favorite = CASE is_favorite WHEN 1 THEN 0 ELSE 1 END,
           updated_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), id]
    );
  },

  async remove(id: string): Promise<void> {
    const db = await getDatabase();
    await db.execute('DELETE FROM foods WHERE id = ? AND is_custom = 1', [id]);
  }
};
