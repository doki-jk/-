import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
}));

vi.mock('./client', () => ({
  getDatabase: async () => ({
    execute: mocks.execute,
    select: mocks.select,
  }),
}));

import { initializeDatabase } from './migrations';

describe('database migrations', () => {
  beforeEach(() => {
    mocks.execute.mockReset().mockResolvedValue({ rowsAffected: 0 });
    mocks.select.mockReset().mockResolvedValue([]);
  });

  it('does not split BEGIN and COMMIT across pooled SQL-plugin calls', async () => {
    await initializeDatabase();

    const statements = mocks.execute.mock.calls.map(([sql]) => String(sql));
    expect(statements).not.toContain('BEGIN IMMEDIATE');
    expect(statements).not.toContain('COMMIT');
    expect(statements).not.toContain('ROLLBACK');

    const markers = statements.filter((sql) =>
      sql.startsWith('INSERT INTO schema_migrations'));
    expect(markers).toHaveLength(3);
  });
});
