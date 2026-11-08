import type { FastifyPluginAsync } from 'fastify';
import type { MoviesService } from '../application/movies.types.js';

const movieSchema = {
  type: 'object',
  required: ['id', 'title', 'durationMin', 'ageLimit', 'genres'],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    durationMin: { type: 'integer' },
    ageLimit: { type: 'integer' },
    genres: { type: 'array', items: { type: 'string' } },
  },
} as const;

export function moviesRoutes(service: MoviesService): FastifyPluginAsync {
  return (app) => {
    app.get(
      '/movies',
      { schema: { response: { 200: { type: 'array', items: movieSchema } } } },
      () => service.listMovies(),
    );
    return Promise.resolve();
  };
}
