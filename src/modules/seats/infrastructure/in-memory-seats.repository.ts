import type { SeatsRepository } from '../application/ports/seats.repository.js';
import type {
  HallSeat,
  HallSummary,
  SeatSummary,
} from '../application/seats.types.js';
import type { SeatsSeed } from './seats.seed.js';

type SeatRow = SeatsSeed['seats'][number];

function byRowAndNumber(a: SeatRow, b: SeatRow): number {
  return a.row - b.row || a.number - b.number;
}

export class InMemorySeatsRepository implements SeatsRepository {
  readonly #seed: SeatsSeed;

  constructor(seed: SeatsSeed) {
    this.#seed = structuredClone(seed);
  }

  getHallsByIds(ids: readonly string[]): Promise<HallSummary[]> {
    const wanted = new Set(ids);
    return Promise.resolve(
      this.#seed.halls
        .filter((h) => wanted.has(h.id))
        .map((h) => ({ id: h.id, number: h.hallNumber })),
    );
  }

  getByHall(hallId: string): Promise<HallSeat[]> {
    return Promise.resolve(
      this.#seed.seats
        .filter((s) => s.hallId === hallId)
        .sort(byRowAndNumber)
        .map((s) => ({
          id: s.id,
          row: s.row,
          number: s.number,
          type: s.seatType,
        })),
    );
  }

  getByIds(ids: readonly string[]): Promise<SeatSummary[]> {
    const wanted = new Set(ids);
    return Promise.resolve(
      this.#seed.seats
        .filter((s) => wanted.has(s.id))
        .sort(byRowAndNumber)
        .map((s) => ({
          id: s.id,
          hallId: s.hallId,
          row: s.row,
          number: s.number,
        })),
    );
  }
}
