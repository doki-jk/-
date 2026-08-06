/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  incrementUsage: vi.fn(),
}));

vi.mock('../database/client', () => ({
  isTauriRuntime: () => true,
  getDatabase: async () => ({
    execute: mocks.execute,
    select: mocks.select,
  }),
}));

vi.mock('./foodRepository', () => ({
  foodRepository: {
    incrementUsage: mocks.incrementUsage,
  },
}));

import { mealRepository } from './mealRepository';

const input = {
  foodId: 'catalog-food',
  foodName: '鸡胸肉',
  mealType: '午餐' as const,
  consumedAt: '2026-08-06T04:00:00.000Z',
  amount: 100,
  unit: 'g',
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
};

function savedRow(foodId: string | null) {
  return {
    id: 'meal-saved',
    food_id: foodId,
    food_name: '鸡胸肉',
    meal_type: '午餐' as const,
    consumed_at: input.consumedAt,
    amount: 100,
    unit: 'g',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    created_at: '2026-08-06T04:00:01.000Z',
    updated_at: '2026-08-06T04:00:01.000Z',
  };
}

describe('mealRepository desktop persistence', () => {
  beforeEach(() => {
    mocks.execute.mockReset().mockResolvedValue({ rowsAffected: 1 });
    mocks.select.mockReset();
    mocks.incrementUsage.mockReset();
  });

  it('keeps the meal saved when usage tracking fails', async () => {
    mocks.select
      .mockResolvedValueOnce([{ id: 'catalog-food' }])
      .mockResolvedValueOnce([savedRow('catalog-food')]);
    mocks.incrementUsage.mockRejectedValueOnce(new Error('usage update failed'));

    const saved = await mealRepository.add(input);

    expect(saved.foodName).toBe('鸡胸肉');
    expect(saved.foodId).toBe('catalog-food');
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it('drops a stale food reference instead of failing the meal insert', async () => {
    mocks.select
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([savedRow(null)]);

    const saved = await mealRepository.add(input);

    expect(saved.foodId).toBeNull();
    const insertParameters = mocks.execute.mock.calls[0]?.[1] as unknown[];
    expect(insertParameters[1]).toBeNull();
    expect(mocks.incrementUsage).not.toHaveBeenCalled();
  });
});
