export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isValidDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function assertDateKey(value: string, message = '日期格式必须为 YYYY-MM-DD'): void {
  if (!isValidDateKey(value)) throw new Error(message);
}

export function localDateFromKey(value: string, hour = 12): Date {
  assertDateKey(value);
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

export function localDateKeyFromIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('日期时间无效');
  return localDateKey(date);
}
