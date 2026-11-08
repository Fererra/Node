import type { UsersRepository } from './ports/users.repository.js';
import type { UsersService } from './users.types.js';

export function createUsersService(deps: {
  repository: UsersRepository;
}): UsersService {
  return { getById: (id) => deps.repository.getById(id) };
}
