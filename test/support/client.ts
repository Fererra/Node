import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { seedIds } from '../../src/app/seed.js';

export const { users, movies, halls, showtimes } = seedIds;
export { seedSeatId as seat } from '../../src/app/seed.js';

export interface BookingBody {
  id: string;
  showtimeId: string;
  status: 'RESERVED' | 'CANCELLED';
  seats: { id: string; row: number; number: number }[];
  createdAt: string;
}

export interface MyBookingBody extends BookingBody {
  movieTitle: string;
  startsAt: string;
}

export interface SeatBody {
  id: string;
  row: number;
  number: number;
  type: 'STANDARD' | 'VIP';
  taken: boolean;
}

export interface ErrorBody {
  error: { code: string; message: string; requestId: string };
}

/** Thin helpers over `app.inject` for the scenario tests. */
export function client(app: FastifyInstance) {
  return {
    book(
      body: unknown,
      {
        user = users.alice,
        key = 'key-1',
        headers = {},
      }: {
        user?: string | null;
        key?: string | null;
        headers?: Record<string, string>;
      } = {},
    ): Promise<LightMyRequestResponse> {
      return app.inject({
        method: 'POST',
        url: '/bookings',
        headers: {
          ...(user === null ? {} : { 'x-user-id': user }),
          ...(key === null ? {} : { 'idempotency-key': key }),
          ...headers,
        },
        payload: body as Record<string, unknown>,
      });
    },

    cancel(
      bookingId: string,
      user: string | null = users.alice,
    ): Promise<LightMyRequestResponse> {
      return app.inject({
        method: 'POST',
        url: `/bookings/${bookingId}/cancel`,
        headers: user === null ? {} : { 'x-user-id': user },
      });
    },

    myBookings(user: string | null = users.alice) {
      return app.inject({
        method: 'GET',
        url: '/me/bookings',
        headers: user === null ? {} : { 'x-user-id': user },
      });
    },

    seats(showtimeId: string): Promise<LightMyRequestResponse> {
      return app.inject({
        method: 'GET',
        url: `/showtimes/${showtimeId}/seats`,
      });
    },

    async takenSeats(showtimeId: string): Promise<string[]> {
      const res = await app.inject({
        method: 'GET',
        url: `/showtimes/${showtimeId}/seats`,
      });
      return res
        .json<SeatBody[]>()
        .filter((s) => s.taken)
        .map((s) => s.id);
    },
  };
}

/** The `error` object of an FR-9 error body. */
export function errorOf(res: LightMyRequestResponse): ErrorBody['error'] {
  return res.json<ErrorBody>().error;
}
