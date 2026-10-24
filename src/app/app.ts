import Fastify, { type FastifyInstance } from 'fastify';
import { createAuthModule } from '../modules/auth/index.js';
import { createBookingsModule } from '../modules/bookings/index.js';
import { createMoviesModule } from '../modules/movies/index.js';
import { createSeatsModule } from '../modules/seats/index.js';
import { createShowtimesModule } from '../modules/showtimes/index.js';
import { createUsersModule } from '../modules/users/index.js';
import type { Config } from './config.js';
import { systemRoutes } from './routes.js';

export interface AppOptions {
  gitSha: Config['gitSha'];
  logger?: boolean;
}

export function buildApp({
  gitSha,
  logger = false,
}: AppOptions): FastifyInstance {
  const app = Fastify({ logger });

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
