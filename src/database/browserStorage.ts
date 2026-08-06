import { localDateKey, localDateKeyFromIso } from '../utils/date';

const STORAGE_PREFIX = 'fuellog:web:v2:';
const RECOVERY_PREFIX = 'fuellog:recovery:';

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function readBrowserData<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return cloneValue(fallback);

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
  } catch (error) {
    console.error(`无法访问浏览器存储：${key}`, error);
    throw new Error('无法读取浏览器存储，请检查是否禁用了站点存储');
  }

  if (raw == null) return cloneValue(fallback);

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const recoveryKey = `${RECOVERY_PREFIX}${key}:${Date.now()}`;
    try {
      window.localStorage.setItem(recoveryKey, raw);
    } catch {
      // The raw value is still untouched at its original key.
    }
    console.error(`浏览器数据损坏：${key}`, error);
    throw new Error(`“${key}”数据无法解析，原始内容已保留，请使用备份恢复或导出恢复副本`);
  }
}

export function writeBrowserData<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    console.error(`序列化浏览器数据失败：${key}`, error);
    throw new Error('数据内容无法保存，请检查是否包含不支持的值');
  }

  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, serialized);
  } catch (error) {
    console.error(`保存浏览器数据失败：${key}`, error);
    throw new Error('浏览器存储失败，请检查是否禁用了站点存储或存储空间是否已满');
  }
}

export function createLocalId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export { localDateKey, localDateKeyFromIso };
