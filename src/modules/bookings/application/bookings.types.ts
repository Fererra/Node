import type { BookingStatus } from '../domain/booking.js';

/** Booking body (docs/api.md#responses). */
export interface BookingDto {
  id: string;
  showtimeId: string;
  status: BookingStatus;
  seats: { id: string; row: number; number: number }[];
  createdAt: Date;
}

/** `GET /me/bookings` item. */
export interface MyBookingDto extends BookingDto {
  movieTitle: string;
  startsAt: Date;
}

/** `GET /showtimes/:id/seats` item. */
export interface ShowtimeSeatDto {
  id: string;
  row: number;
  number: number;
  type: 'STANDARD' | 'VIP';
  taken: boolean;
}

export interface CreateBookingInput {
  showtimeId: string;
  seatIds: string[];
  idempotencyKey: string;
}

export interface BookingsService {
  /** Loads the user from `X-User-Id` into the request context, or 401. */
  authenticate(userId: string | undefined): Promise<void>;
  listShowtimeSeats(showtimeId: string): Promise<ShowtimeSeatDto[]>;
  create(input: CreateBookingInput): Promise<BookingDto>;
  cancel(bookingId: string): Promise<BookingDto>;
  listMine(): Promise<MyBookingDto[]>;
}
