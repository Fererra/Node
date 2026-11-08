import { createHash } from 'node:crypto';
import { compareText } from '../../../shared/kernel/compare.js';

export type BookingStatus = 'RESERVED' | 'CANCELLED';

/** Seat ids in one fixed order: the insert order and the hash input. */
export function sortSeatIds(seatIds: readonly string[]): string[] {
  return [...seatIds].sort(compareText);
}

/**
 * Idempotency request hash: `showtimeId` + sorted `seatIds`, so `[a,b]`
 * and `[b,a]` are the same request (docs/api.md#idempotency).
 */
export function requestHash(
  showtimeId: string,
  seatIds: readonly string[],
): string {
  return createHash('sha256')
    .update(JSON.stringify([showtimeId, sortSeatIds(seatIds)]))
    .digest('hex');
}
