import { describe, expect, it } from 'vitest';
import {
  assertBackupRestoreRuntimeSafe,
  NATIVE_RESTORE_DISABLED_MESSAGE,
} from './backupRestoreSafety';

describe('backup restore runtime safety', () => {
  it('allows browser restore', () => {
    expect(() => assertBackupRestoreRuntimeSafe(false)).not.toThrow();
  });

  it('blocks native restore before destructive database writes', () => {
    expect(() => assertBackupRestoreRuntimeSafe(true)).toThrow(NATIVE_RESTORE_DISABLED_MESSAGE);
  });
});
