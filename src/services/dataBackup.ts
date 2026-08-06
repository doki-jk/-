import { readBrowserData, writeBrowserDataBatch } from '../database/browserStorage';
import { getDatabase, isTauriRuntime } from '../database/client';
import { seedDatabase } from '../database/seed';
import { bodyRecordRepository, type BodyRecord } from '../repositories/bodyRecordRepository';
import { dayPlanRepository, type DailyPlan } from '../repositories/dayPlanRepository';
import { foodRepository, type Food, type FoodCategory } from '../repositories/foodRepository';
import { goalRepository } from '../repositories/goalRepository';
import type { MealEntry } from '../repositories/mealRepository';
import { defaultGoalProfile, userProfileRepository } from '../repositories/userProfileRepository';
import type { DailyGoal, MealType } from '../types';
import { assertDateKey } from '../utils/date';
import { calculateGoalRecommendation, type GoalProfile } from '../utils/goalCalculator';

export interface FuelLogBackup {
  format: 'fuellog-backup';
  version: 1;
  appVersion: string;
  exportedAt: string;
  data: {
    foods: Food[];
    meals: MealEntry[];
    goals: { training: DailyGoal; rest: DailyGoal };
    bodyRecords: BodyRecord[];
    dailyPlans: DailyPlan[];
    profile?: GoalProfile;
  };
}

type MealRow = {
  id: string;
  food_id: string | null;
  food_name: string;
  meal_type: MealEntry['mealType'];
  consumed_at: string;
  amount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
  updated_at: string;
};

const mealTypes = new Set<MealType>(['早餐', '午餐', '晚餐', '加餐']);
const foodCategories = new Set<FoodCategory>([
  '蛋白质来源',
  '主食',
  '水果',
  '蔬菜',
  '乳制品',
  '坚果',
  '补剂',
  '常见外食',
  '其他',
]);
const MAX_BACKUP_ROWS = 100_000;

function mapMealRow(row: MealRow): MealEntry {
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

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}格式无效`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`备份文件缺少${label}数据`);
  if (value.length > MAX_BACKUP_ROWS) throw new Error(`${label}数据超过允许的 ${MAX_BACKUP_ROWS} 条`);
  return value;
}

function readText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空`);
  return value;
}

function readNumber(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new Error(`${label}数值无效`);
  }
  return value;
}

function readInteger(value: unknown, label: string, minimum = 0): number {
  const number = readNumber(value, label, minimum);
  if (!Number.isInteger(number)) throw new Error(`${label}必须为整数`);
  return number;
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label}标记无效`);
  return value;
}

function readTimestamp(value: unknown, label: string): string {
  const text = readText(value, label);
  if (Number.isNaN(new Date(text).getTime())) throw new Error(`${label}时间无效`);
  return text;
}

function readNullableNumber(value: unknown, label: string, maximum?: number): number | null {
  if (value == null) return null;
  const number = readNumber(value, label);
  if (maximum != null && number > maximum) throw new Error(`${label}不能超过 ${maximum}`);
  return number;
}

function readNullableText(value: unknown, label: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new Error(`${label}无效`);
  return value;
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label}包含重复标识`);
}

function parseGoal(value: unknown, label: string): DailyGoal {
  const record = asRecord(value, label);
  return {
    calories: readNumber(record.calories, `${label}热量`, 0.1),
    protein: readNumber(record.protein, `${label}蛋白质`),
    carbs: readNumber(record.carbs, `${label}碳水`),
    fat: readNumber(record.fat, `${label}脂肪`),
  };
}

function parseFood(value: unknown, index: number): Food {
  const label = `食物第 ${index + 1} 项`;
  const record = asRecord(value, label);
  const category = readText(record.category, `${label}分类`);
  if (!foodCategories.has(category as FoodCategory)) throw new Error(`${label}分类无效`);

  return {
    id: readText(record.id, `${label} ID`),
    name: readText(record.name, `${label}名称`),
    category: category as FoodCategory,
    baseAmount: readNumber(record.baseAmount, `${label}基准数量`, 0.0001),
    baseUnit: readText(record.baseUnit, `${label}单位`),
    calories: readNumber(record.calories, `${label}热量`),
    protein: readNumber(record.protein, `${label}蛋白质`),
    carbs: readNumber(record.carbs, `${label}碳水`),
    fat: readNumber(record.fat, `${label}脂肪`),
    isFavorite: readBoolean(record.isFavorite, `${label}收藏`),
    isCustom: readBoolean(record.isCustom, `${label}自定义`),
    usageCount: readInteger(record.usageCount, `${label}使用次数`),
    createdAt: readTimestamp(record.createdAt, `${label}创建`),
    updatedAt: readTimestamp(record.updatedAt, `${label}更新`),
  };
}

function parseMeal(value: unknown, index: number, foodIds: Set<string>): MealEntry {
  const label = `饮食第 ${index + 1} 项`;
  const record = asRecord(value, label);
  const mealType = readText(record.mealType, `${label}餐次`);
  if (!mealTypes.has(mealType as MealType)) throw new Error(`${label}餐次无效`);

  let foodId: string | null = null;
  if (record.foodId != null) {
    foodId = readText(record.foodId, `${label}食物 ID`);
    if (!foodIds.has(foodId)) throw new Error(`${label}引用了不存在的食物`);
  }

  return {
    id: readText(record.id, `${label} ID`),
    foodId,
    foodName: readText(record.foodName, `${label}名称`),
    mealType: mealType as MealType,
    consumedAt: readTimestamp(record.consumedAt, `${label}食用`),
    amount: readNumber(record.amount, `${label}数量`, 0.0001),
    unit: readText(record.unit, `${label}单位`),
    calories: readNumber(record.calories, `${label}热量`),
    protein: readNumber(record.protein, `${label}蛋白质`),
    carbs: readNumber(record.carbs, `${label}碳水`),
    fat: readNumber(record.fat, `${label}脂肪`),
    createdAt: readTimestamp(record.createdAt, `${label}创建`),
    updatedAt: readTimestamp(record.updatedAt, `${label}更新`),
  };
}

function parseBodyRecord(value: unknown, index: number): BodyRecord {
  const label = `身体数据第 ${index + 1} 项`;
  const record = asRecord(value, label);
  const recordedDate = readText(record.recordedDate, `${label}日期`);
  assertDateKey(recordedDate, `${label}日期无效`);

  return {
    id: readText(record.id, `${label} ID`),
    recordedDate,
    weight: readNumber(record.weight, `${label}体重`, 0.0001),
    bodyFat: readNullableNumber(record.bodyFat, `${label}体脂率`, 100),
    muscleMass: readNullableNumber(record.muscleMass, `${label}肌肉量`),
    waist: readNullableNumber(record.waist, `${label}腰围`),
    note: readNullableText(record.note, `${label}备注`),
    createdAt: readTimestamp(record.createdAt, `${label}创建`),
    updatedAt: readTimestamp(record.updatedAt, `${label}更新`),
  };
}

function parsePlan(value: unknown, index: number): DailyPlan {
  const label = `每日计划第 ${index + 1} 项`;
  const record = asRecord(value, label);
  const date = readText(record.date, `${label}日期`);
  assertDateKey(date, `${label}日期无效`);
  if (record.dayType !== 'training' && record.dayType !== 'rest') throw new Error(`${label}日程类型无效`);

  return {
    date,
    dayType: record.dayType,
    goal: parseGoal(record.goal, `${label}目标`),
    updatedAt: readTimestamp(record.updatedAt, `${label}更新`),
  };
}

function parseProfile(value: unknown): GoalProfile {
  const record = asRecord(value, '个人资料');
  const sex = readText(record.sex, '个人资料性别');
  const activityLevel = readText(record.activityLevel, '个人资料活动量');
  const objective = readText(record.objective, '个人资料目标');
  if (sex !== 'male' && sex !== 'female') throw new Error('个人资料性别无效');
  if (!['sedentary', 'light', 'moderate', 'high'].includes(activityLevel)) throw new Error('个人资料活动量无效');
  if (!['cut', 'maintain', 'gain'].includes(objective)) throw new Error('个人资料目标无效');

  const profile: GoalProfile = {
    sex,
    age: readInteger(record.age, '个人资料年龄'),
    heightCm: readNumber(record.heightCm, '个人资料身高'),
    weightKg: readNumber(record.weightKg, '个人资料体重'),
    activityLevel: activityLevel as GoalProfile['activityLevel'],
    objective: objective as GoalProfile['objective'],
  };
  calculateGoalRecommendation(profile);
  return profile;
}

function validateBackup(value: unknown): FuelLogBackup {
  const root = asRecord(value, '备份文件');
  if (root.format !== 'fuellog-backup' || root.version !== 1) {
    throw new Error('不是受支持的 FuelLog 备份文件');
  }

  const dataRecord = asRecord(root.data, '备份数据');
  const foods = asArray(dataRecord.foods, '食物').map(parseFood);
  assertUnique(foods.map((food) => food.id), '食物数据');
  const foodIds = new Set(foods.map((food) => food.id));

  const meals = asArray(dataRecord.meals, '饮食').map((meal, index) => parseMeal(meal, index, foodIds));
  assertUnique(meals.map((meal) => meal.id), '饮食数据');

  const bodyRecords = asArray(dataRecord.bodyRecords, '身体数据').map(parseBodyRecord);
  assertUnique(bodyRecords.map((record) => record.id), '身体数据');
  assertUnique(bodyRecords.map((record) => record.recordedDate), '身体日期');

  const dailyPlans = asArray(dataRecord.dailyPlans, '每日计划').map(parsePlan);
  assertUnique(dailyPlans.map((plan) => plan.date), '每日计划');

  const goalsRecord = asRecord(dataRecord.goals, '营养目标');
  const goals = {
    training: parseGoal(goalsRecord.training, '训练日目标'),
    rest: parseGoal(goalsRecord.rest, '休息日目标'),
  };
  const profile = dataRecord.profile == null ? undefined : parseProfile(dataRecord.profile);

  return {
    format: 'fuellog-backup',
    version: 1,
    appVersion: readText(root.appVersion, '应用版本'),
    exportedAt: readTimestamp(root.exportedAt, '备份导出'),
    data: { foods, meals, goals, bodyRecords, dailyPlans, profile },
  };
}

async function readMeals(): Promise<MealEntry[]> {
  if (!isTauriRuntime()) return readBrowserData<MealEntry[]>('meal-entries', []);
  const db = await getDatabase();
  const rows = await db.select<MealRow[]>('SELECT * FROM meal_entries ORDER BY consumed_at ASC, created_at ASC');
  return rows.map(mapMealRow);
}

export async function createFuelLogBackup(): Promise<FuelLogBackup> {
  const [foods, meals, training, rest, bodyRecords, dailyPlans, profile] = await Promise.all([
    foodRepository.getAll(),
    readMeals(),
    goalRepository.get('training'),
    goalRepository.get('rest'),
    bodyRecordRepository.getAll(),
    dayPlanRepository.getAll(),
    userProfileRepository.get(),
  ]);

  return {
    format: 'fuellog-backup',
    version: 1,
    appVersion: '0.3.0',
    exportedAt: new Date().toISOString(),
    data: { foods, meals, goals: { training, rest }, bodyRecords, dailyPlans, profile },
  };
}

export async function restoreFuelLogBackup(input: unknown): Promise<void> {
  const backup = validateBackup(input);
  const { foods, meals, goals, bodyRecords, dailyPlans } = backup.data;
  const profile = backup.data.profile ?? defaultGoalProfile;

  if (!isTauriRuntime()) {
    writeBrowserDataBatch({
      foods,
      'meal-entries': meals,
      goals,
      'body-records': bodyRecords,
      'daily-plans': Object.fromEntries(dailyPlans.map((plan) => [plan.date, plan])),
      'goal-profile': profile,
    });
    return;
  }

  const db = await getDatabase();
  await db.execute('BEGIN IMMEDIATE');
  try {
    await db.execute('DELETE FROM meal_entries');
    await db.execute('DELETE FROM daily_plans');
    await db.execute('DELETE FROM body_records');
    await db.execute('DELETE FROM nutrition_goals');
    await db.execute('DELETE FROM user_profile');
    await db.execute('DELETE FROM foods');

    for (const food of foods) {
      await db.execute(
        `INSERT INTO foods(
          id,name,category,base_amount,base_unit,calories,protein,carbs,fat,
          is_favorite,is_custom,usage_count,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [food.id, food.name, food.category, food.baseAmount, food.baseUnit, food.calories, food.protein, food.carbs, food.fat, Number(food.isFavorite), Number(food.isCustom), food.usageCount, food.createdAt, food.updatedAt],
      );
    }

    const now = new Date().toISOString();
    for (const [dayType, goal] of Object.entries(goals) as Array<['training' | 'rest', DailyGoal]>) {
      await db.execute(
        `INSERT INTO nutrition_goals(
          id,goal_type,day_type,calories,protein,carbs,fat,effective_from,effective_to,created_at
        ) VALUES (?, 'daily_macro', ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [crypto.randomUUID(), dayType, goal.calories, goal.protein, goal.carbs, goal.fat, now, now],
      );
    }

    await db.execute(
      `INSERT INTO user_profile(id,sex,age,height_cm,weight_kg,activity_level,objective,updated_at)
       VALUES (1,?,?,?,?,?,?,?)`,
      [profile.sex, profile.age, profile.heightCm, profile.weightKg, profile.activityLevel, profile.objective, now],
    );

    for (const record of bodyRecords) {
      await db.execute(
        `INSERT INTO body_records(id,recorded_date,weight,body_fat,muscle_mass,waist,note,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [record.id, record.recordedDate, record.weight, record.bodyFat, record.muscleMass, record.waist, record.note, record.createdAt, record.updatedAt],
      );
    }

    for (const meal of meals) {
      await db.execute(
        `INSERT INTO meal_entries(
          id,food_id,food_name,meal_type,consumed_at,amount,unit,calories,protein,carbs,fat,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [meal.id, meal.foodId, meal.foodName, meal.mealType, meal.consumedAt, meal.amount, meal.unit, meal.calories, meal.protein, meal.carbs, meal.fat, meal.createdAt, meal.updatedAt],
      );
    }

    for (const plan of dailyPlans) {
      await db.execute(
        `INSERT INTO daily_plans(date,day_type,calories,protein,carbs,fat,updated_at)
         VALUES (?,?,?,?,?,?,?)`,
        [plan.date, plan.dayType, plan.goal.calories, plan.goal.protein, plan.goal.carbs, plan.goal.fat, plan.updatedAt],
      );
    }

    await db.execute('COMMIT');
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }

  await seedDatabase();
}

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export function createMealsCsv(backup: FuelLogBackup): string {
  const validated = validateBackup(backup);
  const header = ['日期时间', '餐次', '食物', '数量', '单位', '热量kcal', '蛋白质g', '碳水g', '脂肪g'];
  const rows = validated.data.meals.map((meal) => [
    meal.consumedAt,
    meal.mealType,
    meal.foodName,
    meal.amount,
    meal.unit,
    meal.calories,
    meal.protein,
    meal.carbs,
    meal.fat,
  ]);
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}`;
}

export function parseFuelLogBackup(text: string): FuelLogBackup {
  try {
    return validateBackup(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('备份文件不是有效的 JSON');
    throw error;
  }
}
