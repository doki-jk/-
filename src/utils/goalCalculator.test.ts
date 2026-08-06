import { describe, expect, it } from 'vitest';
import { calculateGoalRecommendation } from './goalCalculator';

describe('calculateGoalRecommendation', () => {
  it('creates separate training and rest goals', () => {
    const result = calculateGoalRecommendation({
      sex: 'male', age: 21, heightCm: 175, weightKg: 70, activityLevel: 'moderate', objective: 'maintain',
    });
    expect(result.training.calories).toBeGreaterThan(result.rest.calories);
    expect(result.training.protein).toBe(126);
    expect(result.training.carbs).toBeGreaterThan(result.rest.carbs);
  });

  it('reduces calories for cutting and increases them for gaining', () => {
    const base = { sex: 'female' as const, age: 30, heightCm: 165, weightKg: 60, activityLevel: 'light' as const };
    const cut = calculateGoalRecommendation({ ...base, objective: 'cut' });
    const gain = calculateGoalRecommendation({ ...base, objective: 'gain' });
    expect(gain.maintenanceCalories).toBe(cut.maintenanceCalories);
    expect(gain.training.calories).toBeGreaterThan(cut.training.calories);
  });

  it('validates profile ranges', () => {
    expect(() => calculateGoalRecommendation({
      sex: 'male', age: 10, heightCm: 175, weightKg: 70, activityLevel: 'moderate', objective: 'maintain',
    })).toThrow('年龄');
  });
});
