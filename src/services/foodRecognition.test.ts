import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/foodRepository', () => ({
  foodRepository: {
    getAll: vi.fn(async () => []),
  },
}));

import { recognizeFoodText } from './foodRecognition';

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

  it('returns suggestions instead of fabricating an unrelated food', async () => {
    const response = await recognizeFoodText('一份火星能量块');
    expect(response.result).toBeNull();
    expect(response.error).toContain('无法可靠匹配');
  });
});
