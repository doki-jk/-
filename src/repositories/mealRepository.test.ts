/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../database/client', () => ({
  isTauriRuntime: () => false,
  getDatabase: vi.fn(),
}));

import { foodRepository } from './foodRepository';
import { mealRepository } from './mealRepository';

describe('mealRepository browser persistence', () => {
  beforeEach(() => window.localStorage.clear());

  it('adds, reads, updates and removes a meal entry', async () => {
    const food = (await foodRepository.getAll()).find((item) => item.id === 'seed-chicken-breast');
    expect(food).toBeDefined();

    const saved = await mealRepository.add({
      foodId: food!.id,
      foodName: food!.name,
      mealType: '午餐',
      consumedAt: '2026-08-06T12:00:00.000Z',
      amount: 100,
      unit: 'g',
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
    });

    expect(await mealRepository.getByDate('2026-08-06')).toHaveLength(1);
    const updated = await mealRepository.update(saved.id, {
      foodId: food!.id,
      foodName: food!.name,
      mealType: '晚餐',
      consumedAt: '2026-08-06T18:00:00.000Z',
      amount: 200,
      unit: 'g',
      calories: 330,
      protein: 62,
      carbs: 0,
      fat: 7.2,
    });
    expect(updated.amount).toBe(200);
    expect(updated.mealType).toBe('晚餐');

    const learnedFood = (await foodRepository.getAll()).find((item) => item.id === food!.id);
    expect(learnedFood?.usageCount).toBe(1);

    await mealRepository.remove(saved.id);
    expect(await mealRepository.getByDate('2026-08-06')).toHaveLength(0);
  });
});
