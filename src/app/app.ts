import Fastify, { type FastifyInstance } from 'fastify';
import { systemClock, type Clock } from '../shared/clock.js';
import type { Logger } from '../shared/logger.js';
import { inMemoryUnitOfWork, type UnitOfWork } from '../shared/unit-of-work.js';
import { createDatabase, type Database } from '../shared/db/database.js';
import { createDbUnitOfWork } from '../shared/db/unit-of-work.js';
import { createAuthModule } from '../modules/auth/index.js';
import { createBookingsModule } from '../modules/bookings/index.js';
import { createMoviesModule } from '../modules/movies/index.js';
import { createSeatsModule } from '../modules/seats/index.js';
import { createShowtimesModule } from '../modules/showtimes/index.js';
import { createUsersModule } from '../modules/users/index.js';
import type { Config, Storage } from './config.js';
import { installErrorHandler } from './error-handler.js';
import { loggerOptions, type LoggerOption } from './logger.js';
import {
  ContextLogController,
  installRequestContext,
  requestIdFor,
} from './request-context.js';
import { systemRoutes } from './routes.js';
import { buildSeed, type Seed } from './seed.js';

export interface AppOptions {
  storage: Storage;
  gitSha?: Config['gitSha'];
  logger?: LoggerOption;
  /** Source of "now"; tests pass a fixed clock. */
  clock?: Clock;
  /** Required with `postgres`: `DATABASE_URL`, or `TEST_DATABASE_URL` in tests. */
  databaseUrl?: string;
}

/** Per-module storage options for the chosen storage. */
function storages(
  storage: { kind: 'memory'; seed: Seed } | { kind: 'postgres'; db: Database },
) {
  if (storage.kind === 'postgres') {
    const pg = { kind: 'postgres', db: storage.db } as const;
    return { users: pg, movies: pg, seats: pg, showtimes: pg, bookings: pg };
  }
  const { seed } = storage;
  return {
    users: { kind: 'memory', seed: seed.users },
    movies: { kind: 'memory', seed: seed.movies },
    seats: { kind: 'memory', seed: seed.seats },
    showtimes: { kind: 'memory', seed: seed.showtimes },
    bookings: { kind: 'memory' },
  } as const;
}

export function buildApp({
  storage,
  gitSha = 'unknown',
  logger = false,
  clock = systemClock,
  databaseUrl,
}: AppOptions): FastifyInstance {
  if (storage === 'postgres' && !databaseUrl) {
    throw new Error('STORAGE=postgres needs DATABASE_URL');
  }

  const app = Fastify({
    logger: loggerOptions(logger),
    logController: new ContextLogController(),
    // requestId and userId come from the context mixin, not child bindings.
    childLoggerFactory: (parent, _bindings, options) =>
      parent.child({}, options),
    requestIdHeader: false,
    genReqId: requestIdFor,
    // Bodies are strict JSON: `seatIds: "x"` is a 400, not `["x"]`.
    ajv: { customOptions: { coerceTypes: false } },
  });

  installRequestContext(app);
  installErrorHandler(app);

  void app.register(systemRoutes, { gitSha });

  // Long-lived resources are created once and passed to modules (ADR-0001).
  const log: Logger = app.log;

  // The one pool of the app (NFR-3). With postgres, the app checks the
  // database on start and fails to start without it (NFR-5); in memory,
  // storage starts from the seed, built for the app's "now".
  let uow: UnitOfWork = inMemoryUnitOfWork;
  let stores: ReturnType<typeof storages>;
  if (storage === 'postgres' && databaseUrl) {
    const database = createDatabase({ url: databaseUrl, log });
    uow = createDbUnitOfWork(database.db, log);
    stores = storages({ kind: 'postgres', db: database.db });
    app.addHook('onReady', async () => {
      const now = await database.checkConnection();
      log.info({ databaseTime: now }, 'database is available');
    });
    app.addHook('onClose', () => database.close());
  } else {
    stores = storages({ kind: 'memory', seed: buildSeed(clock.now()) });
  }

  // Dependency order from docs/architecture.md: a module is created after
  // the modules it depends on, so their services can be passed as deps.
  const users = createUsersModule({ storage: stores.users });
  const auth = createAuthModule();
  const movies = createMoviesModule({ storage: stores.movies });
  const seats = createSeatsModule({ storage: stores.seats });
  const showtimes = createShowtimesModule({
    storage: stores.showtimes,
    movies: movies.service,
    seats: seats.service,
    clock,
  });
  const bookings = createBookingsModule({
    storage: stores.bookings,
    showtimes: showtimes.service,
    seats: seats.service,
    users: users.service,
    uow,
    clock,
    log,
  });

  for (const module of [users, auth, movies, seats, showtimes, bookings]) {
    void app.register(module.plugin);
  }

  return app;
}
