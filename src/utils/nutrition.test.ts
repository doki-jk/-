import { describe, expect, it } from 'vitest';
import { isValidNutrition, scaleNutrition } from './nutrition';

describe('scaleNutrition', () => {
  it('scales all macro values from the same base amount', () => {
    expect(scaleNutrition({ calories: 165, protein: 31, carbs: 0, fat: 3.6 }, 200, 100)).toEqual({
      calories: 330,
      protein: 62,
      carbs: 0,
      fat: 7.2,
    });
  });

  it('rounds to one decimal place', () => {
    expect(scaleNutrition({ calories: 70, protein: 6.3, carbs: 0.6, fat: 4.8 }, 1.5, 1)).toEqual({
      calories: 105,
      protein: 9.5,
      carbs: 0.9,
      fat: 7.2,
    });
  });

  it('rejects invalid amounts', () => {
    expect(() => scaleNutrition({ calories: 1, protein: 1, carbs: 1, fat: 1 }, 0, 100)).toThrow('数量必须大于 0');
  });
});

describe('isValidNutrition', () => {
  it('rejects negative or non-finite values', () => {
    expect(isValidNutrition({ calories: 1, protein: 2, carbs: 3, fat: 4 })).toBe(true);
    expect(isValidNutrition({ calories: -1, protein: 2, carbs: 3, fat: 4 })).toBe(false);
    expect(isValidNutrition({ calories: Number.NaN, protein: 2, carbs: 3, fat: 4 })).toBe(false);
  });
});
