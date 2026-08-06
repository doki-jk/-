/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
}));

vi.mock('../database/client', () => ({
  isTauriRuntime: () => true,
  getDatabase: async () => ({
    execute: mocks.execute,
    select: mocks.select,
  }),
}));

import { goalRepository } from './goalRepository';

const training = { calories: 3227, protein: 160, carbs: 503, fat: 64 };
const rest = { calories: 3027, protein: 160, carbs: 453, fat: 64 };

describe('goalRepository desktop persistence', () => {
  beforeEach(() => {
    mocks.execute.mockReset().mockResolvedValue({ rowsAffected: 2 });
    mocks.select.mockReset();
  });

  it('saves training and rest goals in one SQL-plugin invocation', async () => {
    await goalRepository.saveBoth(training, rest);

    expect(mocks.execute).toHaveBeenCalledTimes(1);
    const [sql, values] = mocks.execute.mock.calls[0] ?? [];
    expect(sql).toContain('INSERT INTO nutrition_goals');
    expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
    expect(sql).not.toContain('BEGIN');
    expect(sql).not.toContain('COMMIT');
    expect(values).toEqual(expect.arrayContaining([
      'goal-current-training',
      'training',
      3227,
      160,
      503,
      64,
      'goal-current-rest',
      'rest',
      3027,
      453,
    ]));
  });

  it('prefers the deterministic current row when reading goals', async () => {
    mocks.select.mockResolvedValueOnce([training]);

    await expect(goalRepository.get('training')).resolves.toEqual(training);

    expect(mocks.select).toHaveBeenCalledWith(
      expect.stringContaining('CASE WHEN id = ? THEN 0 ELSE 1 END'),
      ['training', 'goal-current-training'],
    );
  });

  it('exposes a readable SQLite error without leaving a transaction open', async () => {
    mocks.execute.mockRejectedValueOnce({ message: 'database is locked' });

    await expect(goalRepository.saveBoth(training, rest))
      .rejects.toThrow('SQLite 保存营养目标失败：database is locked');

    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
});
