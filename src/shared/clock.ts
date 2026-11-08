/** Shared port: the source of "now" and of `created_at` values (NFR-9). */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** A clock that always returns the same instant. */
export function fixedClock(instant: Date): Clock {
  const time = instant.getTime();
  return { now: () => new Date(time) };
}
