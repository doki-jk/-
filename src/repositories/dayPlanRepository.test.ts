/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../database/client', () => ({
  isTauriRuntime: () => false,
  getDatabase: vi.fn(),
}));

import { dayPlanRepository } from './dayPlanRepository';

describe('dayPlanRepository browser persistence', () => {
  beforeEach(() => window.localStorage.clear());

  it('saves independent plans for different dates', async () => {
    await dayPlanRepository.save('2026-08-05', 'training', { calories: 2300, protein: 170, carbs: 260, fat: 70 });
    await dayPlanRepository.save('2026-08-06', 'rest', { calories: 2050, protein: 170, carbs: 205, fat: 70 });

    expect((await dayPlanRepository.get('2026-08-05'))?.dayType).toBe('training');
    expect((await dayPlanRepository.get('2026-08-06'))?.dayType).toBe('rest');
    expect((await dayPlanRepository.get('2026-08-06'))?.goal.calories).toBe(2050);
  });

  it('does not overwrite an existing snapshot when ensure is called', async () => {
    await dayPlanRepository.save('2026-08-06', 'rest', { calories: 1900, protein: 150, carbs: 180, fat: 60 });
    const value = await dayPlanRepository.ensure('2026-08-06', 'training', { calories: 2400, protein: 180, carbs: 280, fat: 75 });
    expect(value.dayType).toBe('rest');
    expect(value.goal.calories).toBe(1900);
  });
});
