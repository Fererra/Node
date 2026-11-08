import type { UsersRepository } from '../application/ports/users.repository.js';
import type { UserSummary } from '../application/users.types.js';
import type { UsersSeed } from './users.seed.js';

export class InMemoryUsersRepository implements UsersRepository {
  readonly #users: UsersSeed['users'];

  constructor(seed: UsersSeed) {
    this.#users = structuredClone(seed.users);
  }

  getById(id: string): Promise<UserSummary | null> {
    const user = this.#users.find((u) => u.id === id);
    return Promise.resolve(user ? { id: user.id, name: user.name } : null);
  }
}
