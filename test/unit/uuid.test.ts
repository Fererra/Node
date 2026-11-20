import { describe, expect, it } from 'vitest';
import { isUuid } from '../../src/shared/kernel/uuid.js';

describe('isUuid', () => {
  it.each([
    ['a v4 UUID', '60000000-0000-4000-8000-000000000001'],
    ['upper case', 'ABCDEF01-2345-4678-9ABC-DEF012345678'],
    ['any version', '00000000-0000-0000-0000-000000000000'],
  ])('accepts %s', (_name, value) => {
    expect(isUuid(value)).toBe(true);
  });

  it.each([
    ['an empty string', ''],
    ['no dashes', '60000000000040008000000000000001'],
    ['a non-hex digit', 'g0000000-0000-4000-8000-000000000001'],
    ['a short group', '6000000-0000-4000-8000-000000000001'],
    ['a long last group', '60000000-0000-4000-8000-0000000000012'],
    ['leading text', 'x60000000-0000-4000-8000-000000000001'],
    ['trailing text', '60000000-0000-4000-8000-000000000001x'],
    ['braces', '{60000000-0000-4000-8000-000000000001}'],
  ])('rejects %s', (_name, value) => {
    expect(isUuid(value)).toBe(false);
  });
});
