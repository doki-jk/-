import { FOOD_CATALOG, type CatalogFoodCategory } from '../data/foodCatalog';
import { createLocalId, readBrowserData, writeBrowserData, writeBrowserDataBatch } from '../database/browserStorage';
import { getDatabase, isTauriRuntime } from '../database/client';
import type { MealEntry } from './mealRepository';

export type FoodCategory = CatalogFoodCategory;

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
  if (!Number.isFinite(input.baseAmount) || input.baseAmount <= 0) throw new Error('基准数量必须大于 0');
  for (const [label, value] of [
    ['热量', input.calories],
    ['蛋白质', input.protein],
    ['碳水', input.carbs],
    ['脂肪', input.fat],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${label}不能为负数`);
  }
}

function catalogFoods(): Food[] {
  const now = new Date().toISOString();
  return FOOD_CATALOG.map((definition) => ({
    id: definition.id,
    name: definition.name,
    category: definition.category,
    baseAmount: definition.baseAmount,
    baseUnit: definition.baseUnit,
    calories: definition.calories,
    protein: definition.protein,
    carbs: definition.carbs,
    fat: definition.fat,
    isFavorite: false,
    isCustom: false,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  }));
}

function browserFoods(): Food[] {
  const saved = readBrowserData<Food[] | null>('foods', null);
  const canonical = catalogFoods();
  if (saved === null) {
    writeBrowserData('foods', canonical);
    return canonical;
  }

  const definitions = new Map(canonical.map((food) => [food.id, food]));
  const merged = saved.map((food) => {
    const definition = definitions.get(food.id);
    if (!definition || food.isCustom) return food;
    definitions.delete(food.id);
    return {
      ...definition,
      isFavorite: food.isFavorite,
      usageCount: food.usageCount,
      createdAt: food.createdAt,
      updatedAt: food.updatedAt,
    };
  });
  merged.push(...definitions.values());

  if (merged.length !== saved.length || merged.some((food, index) => JSON.stringify(food) !== JSON.stringify(saved[index]))) {
    writeBrowserData('foods', merged);
  }
  return merged;
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
      const matchingIds = new Set(
        FOOD_CATALOG
          .filter((item) => [item.name, ...item.aliases].some((value) => value.toLocaleLowerCase('zh-CN').includes(lower)))
          .map((item) => item.id),
      );
      return sortFoods(browserFoods().filter((food) =>
        food.name.toLocaleLowerCase('zh-CN').includes(lower) || matchingIds.has(food.id))).slice(0, 50);
    }

    const catalogMatches = FOOD_CATALOG
      .filter((item) => [item.name, ...item.aliases].some((value) => value.includes(normalized)))
      .map((item) => item.id);
    const db = await getDatabase();
    const escaped = `%${normalized.replace(/[\\%_]/g, '\\$&')}%`;
    const rows = catalogMatches.length > 0
      ? await db.select<FoodRow[]>(
        `SELECT * FROM foods
         WHERE name LIKE ? ESCAPE '\\' OR id IN (${catalogMatches.map(() => '?').join(',')})
         ORDER BY is_favorite DESC, usage_count DESC, name COLLATE NOCASE ASC
         LIMIT 50`,
        [escaped, ...catalogMatches],
      )
      : await db.select<FoodRow[]>(
        `SELECT * FROM foods
         WHERE name LIKE ? ESCAPE '\\'
         ORDER BY is_favorite DESC, usage_count DESC, name COLLATE NOCASE ASC
         LIMIT 50`,
        [escaped],
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

  async incrementUsage(id: string): Promise<void> {
    if (!id) return;
    const now = new Date().toISOString();
    if (!isTauriRuntime()) {
      writeBrowserData('foods', browserFoods().map((food) =>
        food.id === id ? { ...food, usageCount: food.usageCount + 1, updatedAt: now } : food));
      return;
    }

    const db = await getDatabase();
    await db.execute(
      'UPDATE foods SET usage_count = usage_count + 1, updated_at = ? WHERE id = ?',
      [now, id],
    );
  },

  async remove(id: string): Promise<void> {
    if (!isTauriRuntime()) {
      const foods = browserFoods();
      const target = foods.find((food) => food.id === id);
      if (!target?.isCustom) return;

      const meals = readBrowserData<MealEntry[]>('meal-entries', []);
      writeBrowserDataBatch({
        foods: foods.filter((food) => food.id !== id),
        'meal-entries': meals.map((meal) => meal.foodId === id ? { ...meal, foodId: null } : meal),
      });
      return;
    }

    const db = await getDatabase();
    await db.execute('DELETE FROM foods WHERE id = ? AND is_custom = 1', [id]);
  },
};
