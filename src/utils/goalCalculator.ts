import type { DailyGoal } from '../types';
import { roundNutrition } from './nutrition';

export type BiologicalSex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high';
export type NutritionObjective = 'cut' | 'maintain' | 'gain';

export interface GoalProfile {
  sex: BiologicalSex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  objective: NutritionObjective;
}

export interface GoalRecommendation {
  bmr: number;
  maintenanceCalories: number;
  training: DailyGoal;
  rest: DailyGoal;
}

const activityFactors: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

const objectiveAdjustments: Record<NutritionObjective, number> = {
  cut: -300,
  maintain: 0,
  gain: 250,
};

function validate(profile: GoalProfile) {
  if (!Number.isInteger(profile.age) || profile.age < 14 || profile.age > 100) throw new Error('年龄需在 14 到 100 岁之间');
  if (!Number.isFinite(profile.heightCm) || profile.heightCm < 120 || profile.heightCm > 230) throw new Error('身高需在 120 到 230 cm 之间');
  if (!Number.isFinite(profile.weightKg) || profile.weightKg < 30 || profile.weightKg > 300) throw new Error('体重需在 30 到 300 kg 之间');
}

function createGoal(calories: number, profile: GoalProfile): DailyGoal {
  const proteinFactor = profile.objective === 'maintain' ? 1.8 : 2;
  const protein = Math.round(profile.weightKg * proteinFactor);
  const fat = Math.round(profile.weightKg * 0.8);
  const remainingCalories = Math.max(0, calories - protein * 4 - fat * 9);
  const carbs = Math.round(remainingCalories / 4);
  return { calories: Math.round(calories), protein, carbs, fat };
}

export function calculateGoalRecommendation(profile: GoalProfile): GoalRecommendation {
  validate(profile);
  const sexOffset = profile.sex === 'male' ? 5 : -161;
  const bmr = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + sexOffset;
  const maintenanceCalories = bmr * activityFactors[profile.activityLevel];
  const averageTarget = Math.max(1200, maintenanceCalories + objectiveAdjustments[profile.objective]);
  const trainingCalories = averageTarget + 100;
  const restCalories = Math.max(1200, averageTarget - 100);

  return {
    bmr: roundNutrition(bmr),
    maintenanceCalories: roundNutrition(maintenanceCalories),
    training: createGoal(trainingCalories, profile),
    rest: createGoal(restCalories, profile),
  };
}
