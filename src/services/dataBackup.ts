import { readBrowserData, writeBrowserData } from '../database/browserStorage';
import { getDatabase, isTauriRuntime } from '../database/client';
import { seedDatabase } from '../database/seed';
import { bodyRecordRepository, type BodyRecord } from '../repositories/bodyRecordRepository';
import { dayPlanRepository, type DailyPlan } from '../repositories/dayPlanRepository';
import { foodRepository, type Food } from '../repositories/foodRepository';
import { goalRepository } from '../repositories/goalRepository';
import type { MealEntry } from '../repositories/mealRepository';
import { defaultGoalProfile, userProfileRepository } from '../repositories/userProfileRepository';
import type { DailyGoal } from '../types';
import type { GoalProfile } from '../utils/goalCalculator';

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

function validateBackup(value: unknown): FuelLogBackup {
  if (!value || typeof value !== 'object') throw new Error('备份文件内容无效');
  const backup = value as Partial<FuelLogBackup>;
  if (backup.format !== 'fuellog-backup' || backup.version !== 1 || !backup.data) {
    throw new Error('不是受支持的 FuelLog 备份文件');
  }
  const data = backup.data as FuelLogBackup['data'];
  if (!Array.isArray(data.foods) || !Array.isArray(data.meals) || !Array.isArray(data.bodyRecords) || !Array.isArray(data.dailyPlans)) {
    throw new Error('备份文件缺少必要的数据表');
  }
  if (!data.goals?.training || !data.goals?.rest) throw new Error('备份文件缺少营养目标');
  return backup as FuelLogBackup;
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
    writeBrowserData('foods', foods);
    writeBrowserData('meal-entries', meals);
    writeBrowserData('goals', goals);
    writeBrowserData('body-records', bodyRecords);
    writeBrowserData('daily-plans', Object.fromEntries(dailyPlans.map((plan) => [plan.date, plan])));
    writeBrowserData('goal-profile', profile);
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
  const header = ['日期时间', '餐次', '食物', '数量', '单位', '热量kcal', '蛋白质g', '碳水g', '脂肪g'];
  const rows = backup.data.meals.map((meal) => [
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
