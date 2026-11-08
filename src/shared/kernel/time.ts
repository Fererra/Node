/**
 * A showtime has started when `startsAt <= now` (NFR-9). A showtime that
 * starts exactly now is started: it is not listed and can't be booked.
 */
export function hasStarted(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() <= now.getTime();
}
