// AC-7: a throwing repository -> 500 INTERNAL_ERROR from the global
// handler. In-memory only: the fake replaces a method of the in-memory
// repository class, so this file is not a scenario test.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryBookingsRepository } from '../../src/modules/bookings/infrastructure/in-memory-bookings.repository.js';
import { InMemoryMoviesRepository } from '../../src/modules/movies/infrastructure/in-memory-movies.repository.js';
import { createTestApp } from '../support/app.js';
import { client, seat, showtimes, type ErrorBody } from '../support/client.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function captureLogs() {
  const lines: Record<string, unknown>[] = [];
  const stream = {
    write: (line: string) => {
      lines.push(JSON.parse(line) as Record<string, unknown>);
    },
  };
  return { lines, stream };
}

describe('AC-7: a throwing repository', () => {
  it('GET /movies -> 500 INTERNAL_ERROR with a generic message, error logged', async () => {
    vi.spyOn(
      InMemoryMoviesRepository.prototype,
      'listWithGenres',
    ).mockRejectedValue(new Error('connection refused at 10.0.0.5'));
    const { lines, stream } = captureLogs();
    const { app } = await createTestApp({ logger: { stream } });

    const res = await app.inject({
      method: 'GET',
      url: '/movies',
      headers: { 'x-request-id': 'boom-1' },
    });
    await app.close();

    expect(res.statusCode).toBe(500);
    expect(res.json<ErrorBody>()).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: 'boom-1',
      },
    });
    expect(res.body).not.toContain('10.0.0.5');
    expect(lines).toContainEqual(
      expect.objectContaining({
        level: 50,
        msg: 'request failed',
        requestId: 'boom-1',
        err: expect.objectContaining({
          message: 'connection refused at 10.0.0.5',
        }) as unknown,
      }),
    );
  });

  it('POST /bookings with a throwing save -> 500, nothing booked', async () => {
    vi.spyOn(InMemoryBookingsRepository.prototype, 'save').mockRejectedValue(
      new Error('disk full'),
    );
    const { app } = await createTestApp();
    const api = client(app);

    const res = await api.book({
      showtimeId: showtimes.orbitTomorrow,
      seatIds: [seat(1, 1, 1)],
    });

    expect(res.statusCode).toBe(500);
    expect(res.json<ErrorBody>().error.code).toBe('INTERNAL_ERROR');
    expect(await api.takenSeats(showtimes.orbitTomorrow)).toEqual([]);
    await app.close();
  });
});
