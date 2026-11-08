import { describe, expect, it } from 'vitest';
import { loadConfig, parseStorage } from './config.js';

describe('STORAGE', () => {
  it('defaults to postgres', () => {
    expect(loadConfig({}).storage).toBe('postgres');
    expect(parseStorage('')).toBe('postgres');
  });

  it.each(['memory', 'postgres'] as const)('accepts %s', (value) => {
    expect(parseStorage(value)).toBe(value);
  });

  it('rejects anything else', () => {
    expect(() => parseStorage('mysql')).toThrow(/STORAGE must be/);
  });
});
