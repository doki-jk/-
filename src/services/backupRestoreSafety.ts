export const NATIVE_RESTORE_DISABLED_MESSAGE =
  '为保护现有数据，桌面/移动应用中的备份恢复已暂时停用。当前 SQL 接口无法保证跨多次调用的恢复事务原子性；请保留备份文件，等待安全恢复版本。';

export function assertBackupRestoreRuntimeSafe(isNativeRuntime: boolean): void {
  if (isNativeRuntime) throw new Error(NATIVE_RESTORE_DISABLED_MESSAGE);
}
