import { describe, expect, it } from 'vitest';
import { assertBackupFileSize, MAX_BACKUP_FILE_BYTES } from './backupFileLimits';

describe('backup file limits', () => {
  it('accepts files at the configured limit', () => {
    expect(() => assertBackupFileSize({ size: MAX_BACKUP_FILE_BYTES })).not.toThrow();
  });

  it('rejects oversized files before they are read or parsed', () => {
    expect(() => assertBackupFileSize({ size: MAX_BACKUP_FILE_BYTES + 1 }))
      .toThrow('备份文件超过 25 MB，已拒绝导入');
  });

  it('rejects invalid file metadata', () => {
    expect(() => assertBackupFileSize({ size: Number.NaN })).toThrow('无法读取备份文件大小');
  });
});
