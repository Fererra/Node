import type { FastifyPluginAsync } from 'fastify';
import { UUID_PATTERN } from '../../../shared/kernel/uuid.js';
import type { ShowtimesService } from '../application/showtimes.types.js';

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', pattern: UUID_PATTERN } },
} as const;

const showtimeSchema = {
  type: 'object',
  required: ['id', 'startsAt', 'hall'],
  properties: {
    id: { type: 'string' },
    startsAt: { type: 'string', format: 'date-time' },
    hall: {
      type: 'object',
      required: ['id', 'number'],
      properties: { id: { type: 'string' }, number: { type: 'integer' } },
    },
  },
} as const;

export function showtimesRoutes(service: ShowtimesService): FastifyPluginAsync {
  return (app) => {
    app.get<{ Params: { id: string } }>(
      '/movies/:id/showtimes',
      {
        schema: {
          params: idParams,
          response: { 200: { type: 'array', items: showtimeSchema } },
        },
      },
      // Ids are compared as lowercase text in every storage.
      (request) => service.listForMovie(request.params.id.toLowerCase()),
    );
    return Promise.resolve();
  };
}
