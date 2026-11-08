import type { AppModule } from '../../shared/module.js';
import { createUsersService } from './application/users.service.js';
import type { UsersService } from './application/users.types.js';
import { InMemoryUsersRepository } from './infrastructure/in-memory-users.repository.js';
import {
  DrizzleUsersRepository,
  type PostgresStorage,
} from './infrastructure/drizzle-users.repository.js';
import type { UsersSeed } from './infrastructure/users.seed.js';

export type { UserSummary, UsersService } from './application/users.types.js';
export type { UsersSeed } from './infrastructure/users.seed.js';

/** Where the module keeps its data. */
export type UsersStorage =
  { kind: 'memory'; seed: UsersSeed } | PostgresStorage;

/** `users` has no routes in Lab 2: bookings loads the user through it. */
export function createUsersModule(deps: {
  storage: UsersStorage;
}): AppModule<UsersService> {
  const repository =
    deps.storage.kind === 'memory'
      ? new InMemoryUsersRepository(deps.storage.seed)
      : new DrizzleUsersRepository(deps.storage.db);
  const service = createUsersService({ repository });
  return { plugin: () => Promise.resolve(), service };
}
