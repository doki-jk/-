import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/foodRepository', () => ({
  foodRepository: {
    getAll: vi.fn(async () => []),
  },
}));

import {
  confirmFoodSuggestion,
  recognizeFoodBatchText,
  recognizeFoodText,
  splitFoodDescriptions,
} from './foodRecognition';

describe('recognizeFoodText', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recognizes grams and scales chicken breast nutrition', async () => {
    const response = await recognizeFoodText('200g鸡胸肉');
    expect(response.error).toBeNull();
    expect(response.result?.food.name).toBe('鸡胸肉');
    expect(response.result?.amount).toBe(200);
    expect(response.result?.nutrition).toEqual({ calories: 330, protein: 62, carbs: 0, fat: 7.2 });
  });

  it('recognizes Chinese portions', async () => {
    const response = await recognizeFoodText('两 个 鸡蛋');
    expect(response.result?.food.name).toBe('鸡蛋');
    expect(response.result?.amount).toBe(2);
    expect(response.result?.nutrition.calories).toBe(140);
  });

  it('recognizes common Traditional Chinese food names', async () => {
    const response = await recognizeFoodText('兩顆雞蛋');
    expect(response.error).toBeNull();
    expect(response.result?.food.name).toBe('鸡蛋');
    expect(response.result?.amount).toBe(2);
    expect(response.result?.nutrition.calories).toBe(140);
  });

  it('recognizes expanded common foods and portion estimates', async () => {
    const response = await recognizeFoodText('一碗白粥');
    expect(response.error).toBeNull();
    expect(response.result?.food.name).toBe('白粥');
    expect(response.result?.equivalentBaseAmount).toBe(300);
    expect(response.result?.nutrition.calories).toBe(138);
  });

  it('recognizes common prepared foods without falling back to unrelated matches', async () => {
    const response = await recognizeFoodText('一碗牛肉麵');
    expect(response.error).toBeNull();
    expect(response.result?.food.name).toBe('牛肉面');
    expect(response.result?.nutrition.calories).toBe(650);
  });

  it('returns suggestions instead of fabricating an unrelated food', async () => {
    const response = await recognizeFoodText('一份火星能量块');
    expect(response.result).toBeNull();
    expect(response.error).toContain('无法可靠匹配');
  });

  it('lets the user confirm a candidate without changing the parsed amount', async () => {
    const response = await recognizeFoodText('200g鸡胸');
    const candidate = response.suggestions.find((item) => item.food.name === '鸡胸肉');
    expect(candidate).toBeDefined();
    const confirmed = await confirmFoodSuggestion('200g鸡胸', candidate!.food);
    expect(confirmed.food.name).toBe('鸡胸肉');
    expect(confirmed.amount).toBe(200);
    expect(confirmed.confidence).toBeGreaterThanOrEqual(80);
  });
});

describe('multi-food recognition', () => {
  it('splits common Chinese separators without duplicating items', () => {
    expect(splitFoodDescriptions('200g鸡胸肉 + 一碗米饭和2个鸡蛋')).toEqual([
      '200g鸡胸肉',
      '一碗米饭',
      '2个鸡蛋',
    ]);
  });

  it('recognizes multiple foods independently', async () => {
    const response = await recognizeFoodBatchText('200g鸡胸肉、一碗米饭、2个鸡蛋');
    expect(response.isBatch).toBe(true);
    expect(response.items).toHaveLength(3);
    expect(response.items.map((item) => item.response.result?.food.name)).toEqual([
      '鸡胸肉',
      '熟米饭',
      '鸡蛋',
    ]);
  });
});
