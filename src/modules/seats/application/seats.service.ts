import type { SeatsRepository } from './ports/seats.repository.js';
import type { SeatsService } from './seats.types.js';

export function createSeatsService(deps: {
  repository: SeatsRepository;
}): SeatsService {
  const { repository } = deps;
  return {
    getHallsByIds: (ids) =>
      ids.length === 0 ? Promise.resolve([]) : repository.getHallsByIds(ids),
    getByHall: (hallId) => repository.getByHall(hallId),
    getByIds: (ids) =>
      ids.length === 0 ? Promise.resolve([]) : repository.getByIds(ids),
  };
}
