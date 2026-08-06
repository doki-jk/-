import { describe, expect, it } from 'vitest';
import { assertDateKey, isValidDateKey, localDateFromKey, localDateKey } from './date';

describe('strict local dates', () => {
  it('accepts valid leap dates and rejects impossible dates', () => {
    expect(isValidDateKey('2024-02-29')).toBe(true);
    expect(isValidDateKey('2026-02-29')).toBe(false);
    expect(isValidDateKey('2026-04-31')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
  });

  it('round-trips a local date without UTC drift', () => {
    expect(localDateKey(localDateFromKey('2026-08-06'))).toBe('2026-08-06');
  });

  it('throws for invalid keys', () => {
    expect(() => assertDateKey('2026-02-30')).toThrow('YYYY-MM-DD');
  });
});
