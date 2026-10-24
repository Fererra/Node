import type { AppModule } from '../../shared/module.js';

export type BookingsService = Record<string, never>;

export function createBookingsModule(): AppModule<BookingsService> {
  return {
    plugin: () => Promise.resolve(),
    service: {},
  };
}
