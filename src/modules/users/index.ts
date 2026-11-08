import type { AppModule } from '../../shared/module.js';
import { createUsersService } from './application/users.service.js';
import type { UsersService } from './application/users.types.js';
import { InMemoryUsersRepository } from './infrastructure/in-memory-users.repository.js';
import type { UsersSeed } from './infrastructure/users.seed.js';

export type { UserSummary, UsersService } from './application/users.types.js';
export type { UsersSeed } from './infrastructure/users.seed.js';

/** Where the module keeps its data; `postgres` comes with the DB stage. */
export interface UsersStorage {
  kind: 'memory';
  seed: UsersSeed;
}

/** `users` has no routes in Lab 2: bookings loads the user through it. */
export function createUsersModule(deps: {
  storage: UsersStorage;
}): AppModule<UsersService> {
  const repository = new InMemoryUsersRepository(deps.storage.seed);
  const service = createUsersService({ repository });
  return { plugin: () => Promise.resolve(), service };
}
