/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import { readBrowserData, writeBrowserData } from './browserStorage';

describe('browser storage safety', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips structured data', () => {
    writeBrowserData('test', { value: 42 });
    expect(readBrowserData('test', { value: 0 })).toEqual({ value: 42 });
  });

  it('returns a cloned fallback only when data is absent', () => {
    const fallback = { values: [1] };
    const result = readBrowserData('missing', fallback);
    result.values.push(2);
    expect(fallback.values).toEqual([1]);
  });

  it('does not silently replace corrupt data with an empty fallback', () => {
    window.localStorage.setItem('fuellog:web:v2:broken', '{invalid');
    expect(() => readBrowserData('broken', [])).toThrow('数据无法解析');
    expect(window.localStorage.getItem('fuellog:web:v2:broken')).toBe('{invalid');
    const recoveryKey = Object.keys(window.localStorage).find((key) => key.startsWith('fuellog:recovery:broken:'));
    expect(recoveryKey).toBeDefined();
  });
});
