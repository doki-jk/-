const STORAGE_PREFIX = 'fuellog:web:v2:';

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function readBrowserData<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return cloneValue(fallback);

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (raw == null) return cloneValue(fallback);
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`读取浏览器数据失败：${key}`, error);
    return cloneValue(fallback);
  }
}

export function writeBrowserData<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch (error) {
    console.error(`保存浏览器数据失败：${key}`, error);
    throw new Error('浏览器存储失败，请检查是否禁用了站点存储或存储空间是否已满');
  }
}

export function createLocalId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localDateKeyFromIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('日期时间无效');
  return localDateKey(date);
}
