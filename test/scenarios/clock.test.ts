import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../support/app.js';
import { client, errorOf, movies, seat, showtimes } from '../support/client.js';

let t: TestApp;
beforeEach(async () => {
  t = await createTestApp();
});
afterEach(async () => {
  await t.app.close();
});

describe('AC-13: fixed clock, a showtime that starts exactly now', () => {
  it('is not listed in GET /movies/:id/showtimes', async () => {
    const res = await t.app.inject({
      method: 'GET',
      url: `/movies/${movies.orbitNine}/showtimes`,
    });
    const ids = res.json<{ id: string }[]>().map((s) => s.id);

    expect(ids).not.toContain(showtimes.orbitNow);
    expect(ids).not.toContain(showtimes.orbitPast);
  });

  it('booking it -> 422 SHOWTIME_STARTED', async () => {
    const res = await client(t.app).book({
      showtimeId: showtimes.orbitNow,
      seatIds: [seat(2, 1, 1)],
    });

    expect(res.statusCode).toBe(422);
    expect(errorOf(res).code).toBe('SHOWTIME_STARTED');
  });

  it('its seats are still served (past showtimes allowed)', async () => {
    const res = await client(t.app).seats(showtimes.orbitNow);
    expect(res.statusCode).toBe(200);
  });
});
