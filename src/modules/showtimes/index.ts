import type { AppModule } from '../../shared/module.js';

export type ShowtimesService = Record<string, never>;

export function createShowtimesModule(): AppModule<ShowtimesService> {
  return {
    plugin: () => Promise.resolve(),
    service: {},
  };
}
