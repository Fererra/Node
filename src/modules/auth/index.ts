import type { AppModule } from '../../shared/module.js';

export type AuthService = Record<string, never>;

export function createAuthModule(): AppModule<AuthService> {
  return {
    plugin: () => Promise.resolve(),
    service: {},
  };
}
