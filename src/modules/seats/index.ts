import type { AppModule } from '../../shared/module.js';
import { createSeatsService } from './application/seats.service.js';
import type { SeatsService } from './application/seats.types.js';
import { InMemorySeatsRepository } from './infrastructure/in-memory-seats.repository.js';
import type { SeatsSeed } from './infrastructure/seats.seed.js';

export type {
  HallSeat,
  HallSummary,
  SeatSummary,
  SeatsService,
  SeatType,
} from './application/seats.types.js';
export type { SeatsSeed } from './infrastructure/seats.seed.js';

/** Where the module keeps its data; `postgres` comes with the DB stage. */
export interface SeatsStorage {
  kind: 'memory';
  seed: SeatsSeed;
}

/** `seats` has no routes in Lab 2: it serves other modules through ports. */
export function createSeatsModule(deps: {
  storage: SeatsStorage;
}): AppModule<SeatsService> {
  const repository = new InMemorySeatsRepository(deps.storage.seed);
  const service = createSeatsService({ repository });
  return { plugin: () => Promise.resolve(), service };
}
