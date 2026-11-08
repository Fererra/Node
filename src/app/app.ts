import Fastify, { type FastifyInstance } from 'fastify';
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

export interface AppOptions {
  storage: Storage;
  gitSha?: Config['gitSha'];
  logger?: LoggerOption;
}

export function buildApp({
  storage,
  gitSha = 'unknown',
  logger = false,
}: AppOptions): FastifyInstance {
  if (storage === 'postgres') {
    throw new Error(
      'STORAGE=postgres is not implemented yet (it comes with the PostgreSQL stage of Lab 2); use STORAGE=memory',
    );
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

  // Dependency order from docs/architecture.md: a module is created after
  // the modules it depends on, so their services can be passed as deps.
  const users = createUsersModule();
  const auth = createAuthModule();
  const movies = createMoviesModule();
  const seats = createSeatsModule();
  const showtimes = createShowtimesModule();
  const bookings = createBookingsModule();

  for (const module of [users, auth, movies, seats, showtimes, bookings]) {
    void app.register(module.plugin);
  }

  return app;
}
