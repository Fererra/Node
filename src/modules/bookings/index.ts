import type { AppModule } from '../../shared/module.js';
import { createBookingsService } from './application/bookings.service.js';
import type { BookingsServiceDeps } from './application/bookings.service.js';
import type { BookingsService } from './application/bookings.types.js';
import { bookingsRoutes } from './http/bookings.routes.js';
import { InMemoryBookingsRepository } from './infrastructure/in-memory-bookings.repository.js';

export type {
  BookingDto,
  BookingsService,
  MyBookingDto,
  ShowtimeSeatDto,
} from './application/bookings.types.js';
export {
  IdempotencyKeyReusedError,
  SeatNotInHallError,
  SeatTakenError,
  ShowtimeStartedError,
} from './application/errors.js';
export type { BookingStatus } from './domain/booking.js';

/** Where the module keeps its data; bookings start empty. */
export interface BookingsStorage {
  kind: 'memory';
}

export function createBookingsModule(
  deps: Omit<BookingsServiceDeps, 'repository'> & { storage: BookingsStorage },
): AppModule<BookingsService> {
  const repository = new InMemoryBookingsRepository(deps.log);
  const service = createBookingsService({
    repository,
    showtimes: deps.showtimes,
    seats: deps.seats,
    users: deps.users,
    uow: deps.uow,
    clock: deps.clock,
    log: deps.log,
  });
  return { plugin: bookingsRoutes(service), service };
}
