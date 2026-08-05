import { createLocalId, readBrowserData, writeBrowserData } from '../database/browserStorage';
import { getDatabase, isTauriRuntime } from '../database/client';

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
    updatedAt: row.updated_at,
  };
}

function validateFood(input: CreateFoodInput): void {
  if (!input.name.trim()) throw new Error('食物名称不能为空');
  if (!input.baseUnit.trim()) throw new Error('单位不能为空');
  if (!Number.isFinite(input.baseAmount) || input.baseAmount <= 0) {
    throw new Error('基准数量必须大于 0');
  }
  for (const [label, value] of [
    ['热量', input.calories],
    ['蛋白质', input.protein],
    ['碳水', input.carbs],
    ['脂肪', input.fat],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${label}不能为负数`);
  }
}

const seedDefinitions: Array<[
  string,
  string,
  FoodCategory,
  number,
  string,
  number,
  number,
  number,
  number,
]> = [
  ['seed-chicken-breast', '鸡胸肉', '蛋白质来源', 100, 'g', 165, 31, 0, 3.6],
  ['seed-egg', '鸡蛋', '蛋白质来源', 1, '个', 70, 6.3, 0.6, 4.8],
  ['seed-beef', '瘦牛肉', '蛋白质来源', 100, 'g', 250, 26, 0, 15],
  ['seed-rice', '熟米饭', '主食', 100, 'g', 116, 2.6, 25.9, 0.3],
  ['seed-oats', '燕麦片', '主食', 100, 'g', 380, 13, 68, 7],
  ['seed-banana', '香蕉', '水果', 1, '根', 105, 1.3, 27, 0.4],
  ['seed-milk', '脱脂牛奶', '乳制品', 100, 'ml', 35, 3.4, 5, 0.2],
  ['seed-yogurt', '无糖希腊酸奶', '乳制品', 100, 'g', 73, 9, 4, 2.2],
  ['seed-broccoli', '西兰花', '蔬菜', 100, 'g', 34, 2.8, 6.6, 0.4],
  ['seed-almonds', '杏仁', '坚果', 30, 'g', 174, 6.4, 6.5, 15],
  ['seed-whey', '乳清蛋白粉', '补剂', 30, 'g', 120, 24, 3, 2],
  ['seed-sweet-potato', '红薯', '主食', 100, 'g', 86, 1.6, 20.1, 0.1],
];

function seedBrowserFoods(): Food[] {
  const now = new Date().toISOString();
  return seedDefinitions.map(([
    id,
    name,
    category,
    baseAmount,
    baseUnit,
    calories,
    protein,
    carbs,
    fat,
  ]) => ({
    id,
    name,
    category,
    baseAmount,
    baseUnit,
    calories,
    protein,
    carbs,
    fat,
    isFavorite: false,
    isCustom: false,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  }));
}

function browserFoods(): Food[] {
  const saved = readBrowserData<Food[] | null>('foods', null);
  if (saved !== null) return saved;
  const seeded = seedBrowserFoods();
  writeBrowserData('foods', seeded);
  return seeded;
}

function sortFoods(foods: Food[]): Food[] {
  return [...foods].sort((left, right) =>
    Number(right.isFavorite) - Number(left.isFavorite)
      || right.usageCount - left.usageCount
      || left.name.localeCompare(right.name, 'zh-CN'));
}

export const foodRepository = {
  async getAll(): Promise<Food[]> {
    if (!isTauriRuntime()) return sortFoods(browserFoods());

    const db = await getDatabase();
    const rows = await db.select<FoodRow[]>(
      `SELECT * FROM foods
       ORDER BY is_favorite DESC, usage_count DESC, name COLLATE NOCASE ASC`,
    );
    return rows.map(mapFood);
  },

  async search(keyword: string): Promise<Food[]> {
    const normalized = keyword.trim();
    if (!isTauriRuntime()) {
      if (!normalized) return this.getAll();
      const lower = normalized.toLocaleLowerCase('zh-CN');
      return sortFoods(browserFoods().filter((food) => food.name.toLocaleLowerCase('zh-CN').includes(lower))).slice(0, 50);
    }

    const db = await getDatabase();
    const rows = await db.select<FoodRow[]>(
      `SELECT * FROM foods
       WHERE name LIKE ? ESCAPE '\\'
       ORDER BY is_favorite DESC, usage_count DESC, name COLLATE NOCASE ASC
       LIMIT 50`,
      [`%${normalized.replace(/[\\%_]/g, '\\$&')}%`],
    );
    return rows.map(mapFood);
  },

  async getFavorites(): Promise<Food[]> {
    if (!isTauriRuntime()) return sortFoods(browserFoods().filter((food) => food.isFavorite));

    const db = await getDatabase();
    const rows = await db.select<FoodRow[]>(
      `SELECT * FROM foods
       WHERE is_favorite = 1
       ORDER BY usage_count DESC, name COLLATE NOCASE ASC`,
    );
    return rows.map(mapFood);
  },

  async create(input: CreateFoodInput): Promise<Food> {
    validateFood(input);
    const now = new Date().toISOString();

    if (!isTauriRuntime()) {
      const food: Food = {
        id: createLocalId('food'),
        name: input.name.trim(),
        category: input.category,
        baseAmount: input.baseAmount,
        baseUnit: input.baseUnit.trim(),
        calories: input.calories,
        protein: input.protein,
        carbs: input.carbs,
        fat: input.fat,
        isFavorite: false,
        isCustom: input.isCustom !== false,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      writeBrowserData('foods', [...browserFoods(), food]);
      return food;
    }

    const db = await getDatabase();
    const id = crypto.randomUUID();
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
        input.baseUnit.trim(),
        input.calories,
        input.protein,
        input.carbs,
        input.fat,
        input.isCustom === false ? 0 : 1,
        now,
        now,
      ],
    );
    const rows = await db.select<FoodRow[]>('SELECT * FROM foods WHERE id = ?', [id]);
    if (!rows[0]) throw new Error('食物保存后未能读取');
    return mapFood(rows[0]);
  },

  async toggleFavorite(id: string): Promise<void> {
    if (!isTauriRuntime()) {
      writeBrowserData('foods', browserFoods().map((food) =>
        food.id === id
          ? { ...food, isFavorite: !food.isFavorite, updatedAt: new Date().toISOString() }
          : food));
      return;
    }

    const db = await getDatabase();
    await db.execute(
      `UPDATE foods
       SET is_favorite = CASE is_favorite WHEN 1 THEN 0 ELSE 1 END,
           updated_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), id],
    );
  },

  async remove(id: string): Promise<void> {
    if (!isTauriRuntime()) {
      writeBrowserData('foods', browserFoods().filter((food) => food.id !== id || !food.isCustom));
      return;
    }

    const db = await getDatabase();
    await db.execute('DELETE FROM foods WHERE id = ? AND is_custom = 1', [id]);
  },
};
