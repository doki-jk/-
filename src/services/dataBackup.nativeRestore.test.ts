import { describe, expect, it, vi } from 'vitest';

const { getDatabase } = vi.hoisted(() => ({ getDatabase: vi.fn() }));

vi.mock('../database/client', () => ({
  isTauriRuntime: () => true,
  getDatabase,
}));

import { restoreFuelLogBackup } from './dataBackup';
import { NATIVE_RESTORE_DISABLED_MESSAGE } from './backupRestoreSafety';

describe('native backup restore service guard', () => {
  it('rejects native restore before validation or database access', async () => {
    await expect(restoreFuelLogBackup(null)).rejects.toThrow(NATIVE_RESTORE_DISABLED_MESSAGE);
    expect(getDatabase).not.toHaveBeenCalled();
  });
});
