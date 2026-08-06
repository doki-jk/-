/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../database/client', () => ({
  isTauriRuntime: () => false,
  getDatabase: vi.fn(),
}));

import { readBrowserData } from '../database/browserStorage';
import {
  createMealsCsv,
  parseFuelLogBackup,
  restoreFuelLogBackup,
  type FuelLogBackup,
} from './dataBackup';

function validBackup(): FuelLogBackup {
  return {
    format: 'fuellog-backup',
    version: 1,
    appVersion: '0.3.0',
    exportedAt: '2026-08-06T00:00:00.000Z',
    data: {
      foods: [{
        id: 'food-1', name: '鸡胸肉', category: '蛋白质来源', baseAmount: 100, baseUnit: 'g',
        calories: 165, protein: 31, carbs: 0, fat: 3.6, isFavorite: true, isCustom: false,
        usageCount: 2, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
      }],
      meals: [{
        id: 'meal-1', foodId: 'food-1', foodName: '鸡胸肉', mealType: '午餐',
        consumedAt: '2026-08-06T04:00:00.000Z', amount: 200, unit: 'g', calories: 330,
        protein: 62, carbs: 0, fat: 7.2, createdAt: '2026-08-06T04:00:00.000Z', updatedAt: '2026-08-06T04:00:00.000Z',
      }],
      goals: {
        training: { calories: 2300, protein: 170, carbs: 260, fat: 70 },
        rest: { calories: 2050, protein: 170, carbs: 205, fat: 70 },
      },
      bodyRecords: [{
        id: 'body-1', recordedDate: '2026-08-06', weight: 70, bodyFat: 15, muscleMass: 55,
        waist: 78, note: null, createdAt: '2026-08-06T00:00:00.000Z', updatedAt: '2026-08-06T00:00:00.000Z',
      }],
      dailyPlans: [{
        date: '2026-08-06', dayType: 'training', goal: { calories: 2300, protein: 170, carbs: 260, fat: 70 },
        updatedAt: '2026-08-06T00:00:00.000Z',
      }],
      profile: { sex: 'male', age: 21, heightCm: 175, weightKg: 70, activityLevel: 'moderate', objective: 'maintain' },
    },
  };
}

describe('FuelLog backups', () => {
  beforeEach(() => window.localStorage.clear());

  it('parses and restores a valid backup', async () => {
    const backup = parseFuelLogBackup(JSON.stringify(validBackup()));
    await restoreFuelLogBackup(backup);
    expect(readBrowserData('meal-entries', [])).toHaveLength(1);
    expect(readBrowserData<{ sex: string }>('goal-profile', { sex: '' }).sex).toBe('male');
  });

  it('rejects meal references to missing foods before overwriting data', async () => {
    const backup = validBackup();
    backup.data.meals[0].foodId = 'missing-food';
    expect(() => parseFuelLogBackup(JSON.stringify(backup))).toThrow('不存在的食物');
    expect(window.localStorage.length).toBe(0);
  });

  it('rejects impossible body and plan dates', () => {
    const backup = validBackup();
    backup.data.bodyRecords[0].recordedDate = '2026-02-30';
    expect(() => parseFuelLogBackup(JSON.stringify(backup))).toThrow('日期无效');
  });

  it('rejects duplicate IDs', () => {
    const backup = validBackup();
    backup.data.foods.push({ ...backup.data.foods[0] });
    expect(() => parseFuelLogBackup(JSON.stringify(backup))).toThrow('重复标识');
  });

  it('exports Excel-friendly CSV with all macro columns', () => {
    const csv = createMealsCsv(validBackup());
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('热量kcal');
    expect(csv).toContain('"鸡胸肉"');
    expect(csv).toContain('"330"');
  });

  it('neutralizes spreadsheet formulas in user-controlled CSV cells', () => {
    const backup = validBackup();
    backup.data.meals[0].foodName = '=HYPERLINK("https://example.invalid","click")';
    backup.data.meals[0].unit = '@SUM(1,1)';
    const csv = createMealsCsv(backup);
    expect(csv).toContain('"\'=HYPERLINK(""https://example.invalid"",""click"")"');
    expect(csv).toContain('"\'@SUM(1,1)"');
    expect(csv).not.toContain('"=HYPERLINK');
    expect(csv).not.toContain('"@SUM');
  });
});
