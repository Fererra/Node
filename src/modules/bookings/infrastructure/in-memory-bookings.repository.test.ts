import { describe, expect, it } from 'vitest';
import type { Logger } from '../../../shared/logger.js';
import type { NewBooking } from '../application/ports/bookings.repository.js';
import { InMemoryBookingsRepository } from './in-memory-bookings.repository.js';

const silent: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function newBooking(overrides: Partial<NewBooking> = {}): NewBooking {
  return {
    id: 'b1',
    userId: 'u1',
    showtimeId: 's1',
    seatIds: ['seat-1', 'seat-2'],
    createdAt: new Date('2026-06-01T12:00:00.000Z'),
    idempotencyKey: 'k1',
    requestHash: 'h1',
    ...overrides,
  };
}

describe('InMemoryBookingsRepository', () => {
  it('writes key, booking and seats together', async () => {
    const repo = new InMemoryBookingsRepository(silent);
    expect(await repo.save(newBooking())).toBe('created');

    expect(await repo.claimKey(newBooking())).toEqual({
      requestHash: 'h1',
      bookingId: 'b1',
    });
    expect(await repo.getById('b1')).toMatchObject({
      status: 'RESERVED',
      seatIds: ['seat-1', 'seat-2'],
    });
    expect(await repo.takenSeatIds('s1')).toEqual(['seat-1', 'seat-2']);
  });

  it('a taken seat writes nothing: no booking, no seats, and the key stays free', async () => {
    const repo = new InMemoryBookingsRepository(silent);
    await repo.save(newBooking({ seatIds: ['seat-2'] }));

    const second = newBooking({
      id: 'b2',
      idempotencyKey: 'k2',
      seatIds: ['seat-1', 'seat-2'],
    });
    expect(await repo.save(second)).toBe('seat-taken');

    expect(await repo.getById('b2')).toBeNull();
    expect(await repo.claimKey(second)).toBeNull();
    expect(await repo.takenSeatIds('s1')).toEqual(['seat-2']);
  });

  it('reports key-taken when the key was stored meanwhile', async () => {
    const repo = new InMemoryBookingsRepository(silent);
    await repo.save(newBooking());
    expect(await repo.save(newBooking({ id: 'b2', seatIds: ['seat-9'] }))).toBe(
      'key-taken',
    );
    expect(await repo.getById('b2')).toBeNull();
  });

  it('the same seat may be booked for another showtime', async () => {
    const repo = new InMemoryBookingsRepository(silent);
    await repo.save(newBooking());
    expect(
      await repo.save(
        newBooking({ id: 'b2', idempotencyKey: 'k2', showtimeId: 's2' }),
      ),
    ).toBe('created');
  });

  it('cancel sets CANCELLED and frees the seats: a cancelled booking holds none', async () => {
    const repo = new InMemoryBookingsRepository(silent);
    await repo.save(newBooking());
    await repo.cancel('b1');

    expect(await repo.getById('b1')).toMatchObject({
      status: 'CANCELLED',
      seatIds: [],
    });
    expect(await repo.takenSeatIds('s1')).toEqual([]);
    expect(
      await repo.save(newBooking({ id: 'b2', idempotencyKey: 'k2' })),
    ).toBe('created');
  });

  it("lists a user's bookings by createdAt desc, then id desc", async () => {
    const repo = new InMemoryBookingsRepository(silent);
    const t = (m: number) => new Date(Date.UTC(2026, 5, 1, 12, m));
    await repo.save(
      newBooking({
        id: 'a',
        idempotencyKey: '1',
        seatIds: ['x1'],
        createdAt: t(0),
      }),
    );
    await repo.save(
      newBooking({
        id: 'c',
        idempotencyKey: '2',
        seatIds: ['x2'],
        createdAt: t(5),
      }),
    );
    await repo.save(
      newBooking({
        id: 'b',
        idempotencyKey: '3',
        seatIds: ['x3'],
        createdAt: t(0),
      }),
    );
    await repo.save(
      newBooking({
        id: 'z',
        userId: 'u2',
        idempotencyKey: '4',
        seatIds: ['x4'],
      }),
    );

    expect((await repo.listByUser('u1')).map((b) => b.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });
});
