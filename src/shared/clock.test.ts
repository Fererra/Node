import { describe, expect, it } from 'vitest';
import { fixedClock } from './clock.js';

describe('fixedClock', () => {
  it('always returns the same instant, as a fresh Date', () => {
    const clock = fixedClock(new Date('2026-06-01T12:00:00.000Z'));
    const first = clock.now();
    first.setFullYear(2000);
    expect(clock.now().toISOString()).toBe('2026-06-01T12:00:00.000Z');
  });
});
