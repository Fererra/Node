import { describe, expect, it } from 'vitest';
import { compareText } from '../../src/shared/kernel/compare.js';

describe('compareText', () => {
  it('is negative when a comes first', () => {
    expect(compareText('a', 'b')).toBe(-1);
  });

  it('is positive when b comes first', () => {
    expect(compareText('b', 'a')).toBe(1);
  });

  it('is 0 for equal strings', () => {
    expect(compareText('a', 'a')).toBe(0);
  });

  it('orders by code point, like the C collation: upper case before lower case', () => {
    expect(['b', 'a', 'B', 'A'].sort(compareText)).toEqual([
      'A',
      'B',
      'a',
      'b',
    ]);
  });
});
