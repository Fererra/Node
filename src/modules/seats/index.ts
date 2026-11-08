import type { PostgresStorage } from '../../shared/db/database.js';
import type { AppModule } from '../../shared/module.js';
import { createSeatsService } from './application/seats.service.js';
import type { SeatsService } from './application/seats.types.js';
import { InMemorySeatsRepository } from './infrastructure/in-memory-seats.repository.js';
import { DrizzleSeatsRepository } from './infrastructure/drizzle-seats.repository.js';
import type { SeatsSeed } from './infrastructure/seats.seed.js';

export type {
  HallSeat,
  HallSummary,
  SeatSummary,
  SeatsService,
  SeatType,
} from './application/seats.types.js';
export type { SeatsSeed } from './infrastructure/seats.seed.js';

/** Where the module keeps its data. */
export type SeatsStorage =
  { kind: 'memory'; seed: SeatsSeed } | PostgresStorage;

/** `seats` has no routes in Lab 2: it serves other modules through ports. */
export function createSeatsModule(deps: {
  storage: SeatsStorage;
}): AppModule<SeatsService> {
  const repository =
    deps.storage.kind === 'memory'
      ? new InMemorySeatsRepository(deps.storage.seed)
      : new DrizzleSeatsRepository(deps.storage.db);
  const service = createSeatsService({ repository });
  return { plugin: () => Promise.resolve(), service };
}
