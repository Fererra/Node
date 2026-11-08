import { asc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../../shared/db/database.js';
import { executor } from '../../../shared/db/executor.js';
import { cinemaHall, seat } from '../../../shared/db/schema/seats.js';
import type { SeatsRepository } from '../application/ports/seats.repository.js';
import type {
  HallSeat,
  HallSummary,
  SeatSummary,
} from '../application/seats.types.js';

export type { PostgresStorage } from '../../../shared/db/database.js';

export class DrizzleSeatsRepository implements SeatsRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  getHallsByIds(ids: readonly string[]): Promise<HallSummary[]> {
    return executor(this.#db)
      .select({ id: cinemaHall.id, number: cinemaHall.hallNumber })
      .from(cinemaHall)
      .where(inArray(cinemaHall.id, [...ids]));
  }

  getByHall(hallId: string): Promise<HallSeat[]> {
    return executor(this.#db)
      .select({
        id: seat.id,
        row: seat.row,
        number: seat.number,
        type: seat.seatType,
      })
      .from(seat)
      .where(eq(seat.hallId, hallId))
      .orderBy(asc(seat.row), asc(seat.number));
  }

  getByIds(ids: readonly string[]): Promise<SeatSummary[]> {
    return executor(this.#db)
      .select({
        id: seat.id,
        hallId: seat.hallId,
        row: seat.row,
        number: seat.number,
      })
      .from(seat)
      .where(inArray(seat.id, [...ids]))
      .orderBy(asc(seat.row), asc(seat.number));
  }
}
