import { readBrowserData, writeBrowserDataBatch } from '../database/browserStorage';
import { getDatabase, isTauriRuntime } from '../database/client';
import { seedDatabase } from '../database/seed';
import { bodyRecordRepository, type BodyRecord } from '../repositories/bodyRecordRepository';
import { dayPlanRepository, type DailyPlan } from '../repositories/dayPlanRepository';
import { foodRepository, type Food } from '../repositories/foodRepository';
import { goalRepository } from '../repositories/goalRepository';
import type { MealEntry } from '../repositories/mealRepository';
import { defaultGoalProfile, userProfileRepository } from '../repositories/userProfileRepository';
import type { DailyGoal, MealType } from '../types';
import { assertDateKey } from '../utils/date';
import { calculateGoalRecommendation, type GoalProfile } from '../utils/goalCalculator';

export interface FuelLogBackup {
  format: 'fuellog-backup';
  version: 1;
  appVersion: '0.3.0';
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

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}格式无效`);
}

function assertText(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空`);
}

function assertNumber(value: unknown, label: string, minimum = 0): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) throw new Error(`${label}数值无效`);
}

function assertTimestamp(value: unknown, label: string): asserts value is string {
  assertText(value, label);
  if (Number.isNaN(new Date(value).getTime())) throw new Error(`${label}时间无效`);
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label}包含重复标识`);
}

function validateGoal(value: unknown, label: string): asserts value is DailyGoal {
  assertObject(value, label);
  assertNumber(value.calories, `${label}热量`, 0.1);
  assertNumber(value.protein, `${label}蛋白质`);
  assertNumber(value.carbs, `${label}碳水`);
  assertNumber(value.fat, `${label}脂肪`);
}

function validateFood(value: unknown, index: number): asserts value is Food {
  const label = `食物第 ${index + 1} 项`;
  assertObject(value, label);
  assertText(value.id, `${label} ID`);
  assertText(value.name, `${label}名称`);
  assertText(value.category, `${label}分类`);
  assertNumber(value.baseAmount, `${label}基准数量`, 0.0001);
  assertText(value.baseUnit, `${label}单位`);
  assertNumber(value.calories, `${label}热量`);
  assertNumber(value.protein, `${label}蛋白质`);
  assertNumber(value.carbs, `${label}碳水`);
  assertNumber(value.fat, `${label}脂肪`);
  if (typeof value.isFavorite !== 'boolean' || typeof value.isCustom !== 'boolean') throw new Error(`${label}标记无效`);
  assertNumber(value.usageCount, `${label}使用次数`);
  assertTimestamp(value.createdAt, `${label}创建`);
  assertTimestamp(value.updatedAt, `${label}更新`);
}

function validateMeal(value: unknown, index: number, foodIds: Set<string>): asserts value is MealEntry {
  const label = `饮食第 ${index + 1} 项`;
  assertObject(value, label);
  assertText(value.id, `${label} ID`);
  if (value.foodId != null && (typeof value.foodId !== 'string' || !foodIds.has(value.foodId))) {
    throw new Error(`${label}引用了不存在的食物`);
  }
  assertText(value.foodName, `${label}名称`);
  if (!mealTypes.has(value.mealType as MealType)) throw new Error(`${label}餐次无效`);
  assertTimestamp(value.consumedAt, `${label}食用`);
  assertNumber(value.amount, `${label}数量`, 0.0001);
  assertText(value.unit, `${label}单位`);
  assertNumber(value.calories, `${label}热量`);
  assertNumber(value.protein, `${label}蛋白质`);
  assertNumber(value.carbs, `${label}碳水`);
  assertNumber(value.fat, `${label}脂肪`);
  assertTimestamp(value.createdAt, `${label}创建`);
  assertTimestamp(value.updatedAt, `${label}更新`);
}

function validateBodyRecord(value: unknown, index: number): asserts value is BodyRecord {
  const label = `身体数据第 ${index + 1} 项`;
  assertObject(value, label);
  assertText(value.id, `${label} ID`);
  assertText(value.recordedDate, `${label}日期`);
  assertDateKey(value.recordedDate, `${label}日期无效`);
  assertNumber(value.weight, `${label}体重`, 0.0001);
  if (value.bodyFat != null) {
    assertNumber(value.bodyFat, `${label}体脂率`);
    if (value.bodyFat > 100) throw new Error(`${label}体脂率不能超过 100`);
  }
  if (value.muscleMass != null) assertNumber(value.muscleMass, `${label}肌肉量`);
  if (value.waist != null) assertNumber(value.waist, `${label}腰围`);
  if (value.note != null && typeof value.note !== 'string') throw new Error(`${label}备注无效`);
  assertTimestamp(value.createdAt, `${label}创建`);
  assertTimestamp(value.updatedAt, `${label}更新`);
}

function validatePlan(value: unknown, index: number): asserts value is DailyPlan {
  const label = `每日计划第 ${index + 1} 项`;
  assertObject(value, label);
  assertText(value.date, `${label}日期`);
  assertDateKey(value.date, `${label}日期无效`);
  if (value.dayType !== 'training' && value.dayType !== 'rest') throw new Error(`${label}日程类型无效`);
  validateGoal(value.goal, `${label}目标`);
  assertTimestamp(value.updatedAt, `${label}更新`);
}

function validateProfile(value: unknown): asserts value is GoalProfile {
  assertObject(value, '个人资料');
  calculateGoalRecommendation(value as unknown as GoalProfile);
}

function validateBackup(value: unknown): FuelLogBackup {
  assertObject(value, '备份文件');
  if (value.format !== 'fuellog-backup' || value.version !== 1) throw new Error('不是受支持的 FuelLog 备份文件');
  assertTimestamp(value.exportedAt, '备份导出');
  assertObject(value.data, '备份数据');
  const data = value.data;
  for (const [label, rows] of [
    ['食物', data.foods],
    ['饮食', data.meals],
    ['身体数据', data.bodyRecords],
    ['每日计划', data.dailyPlans],
  ] as const) {
    if (!Array.isArray(rows)) throw new Error(`备份文件缺少${label}数据`);
    if (rows.length > MAX_BACKUP_ROWS) throw new Error(`${label}数据超过允许的 ${MAX_BACKUP_ROWS} 条`);
  }
  assertObject(data.goals, '营养目标');
  validateGoal(data.goals.training, '训练日目标');
  validateGoal(data.goals.rest, '休息日目标');

  data.foods.forEach(validateFood);
  assertUnique(data.foods.map((food) => food.id), '食物数据');
  const foodIds = new Set(data.foods.map((food) => food.id));
  data.meals.forEach((meal, index) => validateMeal(meal, index, foodIds));
  assertUnique(data.meals.map((meal) => meal.id), '饮食数据');
  data.bodyRecords.forEach(validateBodyRecord);
  assertUnique(data.bodyRecords.map((record) => record.id), '身体数据');
  assertUnique(data.bodyRecords.map((record) => record.recordedDate), '身体日期');
  data.dailyPlans.forEach(validatePlan);
  assertUnique(data.dailyPlans.map((plan) => plan.date), '每日计划');
  if (data.profile != null) validateProfile(data.profile);

  return value as unknown as FuelLogBackup;
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
