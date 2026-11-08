import type {
  FastifyPluginAsync,
  FastifyRequest,
  onRequestAsyncHookHandler,
} from 'fastify';
import { ValidationError } from '../../../shared/errors.js';
import { UUID_PATTERN } from '../../../shared/kernel/uuid.js';
import type { BookingsService } from '../application/bookings.types.js';

const uuid = { type: 'string', pattern: UUID_PATTERN } as const;

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: uuid },
} as const;

const createHeaders = {
  type: 'object',
  required: ['idempotency-key'],
  properties: {
    'idempotency-key': { type: 'string', minLength: 1, maxLength: 255 },
  },
} as const;

const createBody = {
  type: 'object',
  required: ['showtimeId', 'seatIds'],
  properties: {
    showtimeId: uuid,
    seatIds: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      uniqueItems: true,
      items: uuid,
    },
  },
} as const;

const bookingProperties = {
  id: { type: 'string' },
  showtimeId: { type: 'string' },
  status: { type: 'string', enum: ['RESERVED', 'CANCELLED'] },
  seats: {
    type: 'array',
    items: {
      type: 'object',
      required: ['id', 'row', 'number'],
      properties: {
        id: { type: 'string' },
        row: { type: 'integer' },
        number: { type: 'integer' },
      },
    },
  },
  createdAt: { type: 'string', format: 'date-time' },
} as const;

const bookingSchema = {
  type: 'object',
  required: ['id', 'showtimeId', 'status', 'seats', 'createdAt'],
  properties: bookingProperties,
} as const;

const myBookingSchema = {
  type: 'object',
  required: [...bookingSchema.required, 'movieTitle', 'startsAt'],
  properties: {
    ...bookingProperties,
    movieTitle: { type: 'string' },
    startsAt: { type: 'string', format: 'date-time' },
  },
} as const;

const showtimeSeatSchema = {
  type: 'object',
  required: ['id', 'row', 'number', 'type', 'taken'],
  properties: {
    id: { type: 'string' },
    row: { type: 'integer' },
    number: { type: 'integer' },
    type: { type: 'string', enum: ['STANDARD', 'VIP'] },
    taken: { type: 'boolean' },
  },
} as const;

interface CreateBookingRoute {
  Headers: { 'idempotency-key': string };
  Body: { showtimeId: string; seatIds: string[] };
}

/** Ids are compared as lowercase text in every storage. */
function normalizeSeatIds(seatIds: readonly string[]): string[] {
  const lower = seatIds.map((id) => id.toLowerCase());
  if (new Set(lower).size !== lower.length) {
    throw new ValidationError('body/seatIds must NOT have duplicate items');
  }
  return lower;
}

function userIdHeader(request: FastifyRequest): string | undefined {
  const value = request.headers['x-user-id'];
  return typeof value === 'string' ? value : undefined;
}

export function bookingsRoutes(service: BookingsService): FastifyPluginAsync {
  // Route-level onRequest: runs before body parsing, so 401 comes before
  // 400 (docs/api.md#users-and-request-ids).
  const loadUser: onRequestAsyncHookHandler = (request) =>
    service.authenticate(userIdHeader(request));

  return (app) => {
    app.get<{ Params: { id: string } }>(
      '/showtimes/:id/seats',
      {
        schema: {
          params: idParams,
          response: { 200: { type: 'array', items: showtimeSeatSchema } },
        },
      },
      (request) => service.listShowtimeSeats(request.params.id.toLowerCase()),
    );

    app.post<CreateBookingRoute>(
      '/bookings',
      {
        onRequest: loadUser,
        schema: {
          headers: createHeaders,
          body: createBody,
          response: { 201: bookingSchema },
        },
      },
      async (request, reply) => {
        const { showtimeId, seatIds } = request.body;
        request.log.debug({ seats: seatIds.length }, 'create booking request');
        const booking = await service.create({
          showtimeId: showtimeId.toLowerCase(),
          seatIds: normalizeSeatIds(seatIds),
          idempotencyKey: request.headers['idempotency-key'],
        });
        return reply.status(201).send(booking);
      },
    );

    app.post<{ Params: { id: string } }>(
      '/bookings/:id/cancel',
      {
        onRequest: loadUser,
        schema: { params: idParams, response: { 200: bookingSchema } },
      },
      (request) => service.cancel(request.params.id.toLowerCase()),
    );

    app.get(
      '/me/bookings',
      {
        onRequest: loadUser,
        schema: {
          response: { 200: { type: 'array', items: myBookingSchema } },
        },
      },
      () => service.listMine(),
    );

    return Promise.resolve();
  };
}
