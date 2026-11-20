// E2E helpers: plain `fetch` against the server that
// scripts/test-all.mjs starts (built dist/, STORAGE=postgres, port 3100).
export const BASE_URL = 'http://localhost:3100';

export interface Booking {
  id: string;
  showtimeId: string;
  status: 'RESERVED' | 'CANCELLED';
  seats: { id: string; row: number; number: number }[];
  createdAt: string;
}

export interface MyBooking extends Booking {
  movieTitle: string;
  startsAt: string;
}

export interface Movie {
  id: string;
  title: string;
}

export interface Showtime {
  id: string;
  startsAt: string;
  hall: { id: string; number: number };
}

export interface Seat {
  id: string;
  row: number;
  number: number;
  taken: boolean;
}

export interface ErrorBody {
  error: { code: string; message: string; requestId: string };
}

export interface Reply<T> {
  status: number;
  body: T;
}

async function call<T>(
  method: 'GET' | 'POST',
  path: string,
  { headers = {}, body }: { headers?: Record<string, string>; body?: unknown },
): Promise<Reply<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: (await res.json()) as T };
}

export function get<T>(
  path: string,
  headers: Record<string, string> = {},
): Promise<Reply<T>> {
  return call<T>('GET', path, { headers });
}

export function book(
  body: { showtimeId: string; seatIds: string[] },
  { user, key }: { user: string | undefined; key: string },
): Promise<Reply<Booking | ErrorBody>> {
  return call('POST', '/bookings', {
    headers: {
      ...(user === undefined ? {} : { 'x-user-id': user }),
      'idempotency-key': key,
    },
    body,
  });
}

export function cancel(
  bookingId: string,
  user: string,
): Promise<Reply<Booking | ErrorBody>> {
  return call('POST', `/bookings/${bookingId}/cancel`, {
    headers: { 'x-user-id': user },
  });
}

/** The first future showtime of the movie with this title. */
export async function firstShowtimeOf(title: string): Promise<Showtime> {
  const movies = await get<Movie[]>('/movies');
  const movie = movies.body.find((m) => m.title === title);
  if (!movie) throw new Error(`movie ${title} not found`);
  const showtimes = await get<Showtime[]>(`/movies/${movie.id}/showtimes`);
  const first = showtimes.body[0];
  if (!first) throw new Error(`no future showtimes of ${title}`);
  return first;
}

export async function seatAt(
  showtimeId: string,
  row: number,
  number: number,
): Promise<Seat> {
  const seats = await get<Seat[]>(`/showtimes/${showtimeId}/seats`);
  const seat = seats.body.find((s) => s.row === row && s.number === number);
  if (!seat) {
    throw new Error(`seat ${String(row)}-${String(number)} not found`);
  }
  return seat;
}
