export const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;

export function assertBackupFileSize(file: Pick<File, 'size'>): void {
  if (!Number.isFinite(file.size) || file.size < 0) {
    throw new Error('无法读取备份文件大小');
  }
  if (file.size > MAX_BACKUP_FILE_BYTES) {
    throw new Error('备份文件超过 25 MB，已拒绝导入');
  }
}
