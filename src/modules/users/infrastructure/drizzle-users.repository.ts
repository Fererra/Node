import { eq } from 'drizzle-orm';
import type { Database } from '../../../shared/db/database.js';
import { executor } from '../../../shared/db/executor.js';
import { users } from '../../../shared/db/schema/users.js';
import type { UsersRepository } from '../application/ports/users.repository.js';
import type { UserSummary } from '../application/users.types.js';

export class DrizzleUsersRepository implements UsersRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  async getById(id: string): Promise<UserSummary | null> {
    const [user] = await executor(this.#db)
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, id));
    return user ?? null;
  }
}
