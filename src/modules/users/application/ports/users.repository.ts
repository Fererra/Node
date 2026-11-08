import type { UserSummary } from '../users.types.js';

export interface UsersRepository {
  getById(id: string): Promise<UserSummary | null>;
}
