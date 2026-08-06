import { localDateKey, localDateKeyFromIso } from '../utils/date';

const STORAGE_PREFIX = 'fuellog:web:v2:';
const RECOVERY_PREFIX = 'fuellog:recovery:';

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function serializeValue(value: unknown, key: string): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error(`序列化浏览器数据失败：${key}`, error);
    throw new Error(`“${key}”包含无法保存的数据`);
  }
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
  const serialized = serializeValue(value, key);

  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, serialized);
  } catch (error) {
    console.error(`保存浏览器数据失败：${key}`, error);
    throw new Error('浏览器存储失败，请检查是否禁用了站点存储或存储空间是否已满');
  }
}

export function writeBrowserDataBatch(values: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const serialized = Object.entries(values).map(([key, value]) => ({
    key,
    storageKey: `${STORAGE_PREFIX}${key}`,
    value: serializeValue(value, key),
  }));
  const previous = new Map<string, string | null>();

  try {
    for (const item of serialized) previous.set(item.storageKey, window.localStorage.getItem(item.storageKey));
    for (const item of serialized) window.localStorage.setItem(item.storageKey, item.value);
  } catch (error) {
    for (const [storageKey, oldValue] of previous) {
      try {
        if (oldValue == null) window.localStorage.removeItem(storageKey);
        else window.localStorage.setItem(storageKey, oldValue);
      } catch (rollbackError) {
        console.error(`回滚浏览器数据失败：${storageKey}`, rollbackError);
      }
    }
    console.error('批量恢复浏览器数据失败，已尝试回滚', error);
    throw new Error('恢复数据失败，已保留恢复前的数据；请检查浏览器存储空间');
  }
}

export function createLocalId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export { localDateKey, localDateKeyFromIso };
