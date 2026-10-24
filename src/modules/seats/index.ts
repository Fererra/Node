import type { AppModule } from '../../shared/module.js';

export type SeatsService = Record<string, never>;

export function createSeatsModule(): AppModule<SeatsService> {
  return {
    plugin: () => Promise.resolve(),
    service: {},
  };
}
