import type { AppModule } from '../../shared/module.js';

export type UsersService = Record<string, never>;

export function createUsersModule(): AppModule<UsersService> {
  return {
    plugin: () => Promise.resolve(),
    service: {},
  };
}
