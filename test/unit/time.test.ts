import { describe, expect, it } from 'vitest';
import { hasStarted } from '../../src/shared/kernel/time.js';

const now = new Date('2026-06-01T12:00:00.000Z');

describe('hasStarted', () => {
  it('is true for a showtime in the past', () => {
    expect(hasStarted(new Date('2026-06-01T11:59:59.999Z'), now)).toBe(true);
  });

  it('is true for a showtime that starts exactly now', () => {
    expect(hasStarted(new Date(now), now)).toBe(true);
  });

  it('is false for a showtime in the future', () => {
    expect(hasStarted(new Date('2026-06-01T12:00:00.001Z'), now)).toBe(false);
  });
});
