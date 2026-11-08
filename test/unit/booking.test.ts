import { describe, expect, it } from 'vitest';
import {
  requestHash,
  sortSeatIds,
} from '../../src/modules/bookings/domain/booking.js';

describe('requestHash', () => {
  it('is the same for [a,b] and [b,a]', () => {
    expect(requestHash('s1', ['a', 'b'])).toBe(requestHash('s1', ['b', 'a']));
  });

  it('differs for another showtime or other seats', () => {
    const base = requestHash('s1', ['a', 'b']);
    expect(requestHash('s2', ['a', 'b'])).not.toBe(base);
    expect(requestHash('s1', ['a'])).not.toBe(base);
    expect(requestHash('s1', ['a', 'c'])).not.toBe(base);
  });

  it("can't be fooled by joining ids differently", () => {
    expect(requestHash('s1', ['a,b'])).not.toBe(requestHash('s1', ['a', 'b']));
  });
});

describe('sortSeatIds', () => {
  it('sorts by code point and does not change its input', () => {
    const input = ['c', 'a', 'b'];
    expect(sortSeatIds(input)).toEqual(['a', 'b', 'c']);
    expect(input).toEqual(['c', 'a', 'b']);
  });
});
