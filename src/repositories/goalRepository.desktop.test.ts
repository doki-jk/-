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
    mocks.execute.mockReset().mockResolvedValue({ rowsAffected: 1 });
    mocks.select.mockReset();
  });

  it('saves training and rest goals in one transaction', async () => {
    await goalRepository.saveBoth(training, rest);

    expect(mocks.execute.mock.calls[0]?.[0]).toBe('BEGIN IMMEDIATE');
    expect(mocks.execute.mock.calls.at(-1)?.[0]).toBe('COMMIT');

    const inserts = mocks.execute.mock.calls.filter(([sql]) =>
      typeof sql === 'string' && sql.includes('INSERT INTO nutrition_goals'));
    expect(inserts).toHaveLength(2);
    expect(inserts[0]?.[1]).toEqual(expect.arrayContaining(['training', 3227, 160, 503, 64]));
    expect(inserts[1]?.[1]).toEqual(expect.arrayContaining(['rest', 3027, 160, 453, 64]));
  });

  it('rolls back and exposes a readable SQLite error', async () => {
    mocks.execute
      .mockResolvedValueOnce({ rowsAffected: 0 })
      .mockResolvedValueOnce({ rowsAffected: 1 })
      .mockRejectedValueOnce({ message: 'no such column: effective_to' })
      .mockResolvedValueOnce({ rowsAffected: 0 });

    await expect(goalRepository.saveBoth(training, rest))
      .rejects.toThrow('SQLite 保存营养目标失败：no such column: effective_to');

    expect(mocks.execute).toHaveBeenCalledWith('ROLLBACK');
  });
});
