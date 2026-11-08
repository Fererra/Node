import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../support/app.js';
import {
  client,
  errorOf,
  seat,
  showtimes,
  users,
  type BookingBody,
} from '../support/client.js';

let t: TestApp;
let api: ReturnType<typeof client>;
beforeEach(async () => {
  t = await createTestApp();
  api = client(t.app);
});
afterEach(async () => {
  await t.app.close();
});

const a = seat(1, 1, 1);
const b = seat(1, 1, 2);
const request = (seatIds: string[]) => ({
  showtimeId: showtimes.orbitTomorrow,
  seatIds,
});

describe('AC-5: Idempotency-Key on POST /bookings', () => {
  it('same key and body -> 201 with the same body, one booking', async () => {
    const first = await api.book(request([a, b]), { key: 'k' });
    const second = await api.book(request([a, b]), { key: 'k' });

    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual(first.json());
    expect((await api.myBookings()).json()).toHaveLength(1);
  });

  it('[b,a] is the same request as [a,b]', async () => {
    const first = await api.book(request([a, b]), { key: 'k' });
    const second = await api.book(request([b, a]), { key: 'k' });

    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual(first.json());
  });

  it('same key, other body -> 422 IDEMPOTENCY_KEY_REUSED', async () => {
    await api.book(request([a, b]), { key: 'k' });

    for (const body of [
      request([a]),
      { showtimeId: showtimes.blueHarbor, seatIds: [a, b] },
    ]) {
      const res = await api.book(body, { key: 'k' });
      expect(res.statusCode).toBe(422);
      expect(errorOf(res).code).toBe('IDEMPOTENCY_KEY_REUSED');
    }
    expect((await api.myBookings()).json()).toHaveLength(1);
  });

  it('the key is scoped to the user', async () => {
    await api.book(request([a]), { key: 'k' });
    const bob = await api.book(request([b]), { key: 'k', user: users.bob });

    expect(bob.statusCode).toBe(201);
    expect(bob.json<BookingBody>().seats.map((s) => s.id)).toEqual([b]);
  });

  it('a replay returns the current state, also CANCELLED', async () => {
    const { id } = (
      await api.book(request([a]), { key: 'k' })
    ).json<BookingBody>();
    await api.cancel(id);

    const replay = await api.book(request([a]), { key: 'k' });
    expect(replay.statusCode).toBe(201);
    expect(replay.json()).toMatchObject({ id, status: 'CANCELLED', seats: [] });
  });

  it('a failed request stores nothing, so the key can be reused', async () => {
    await api.book(request([a]), { key: 'alice', user: users.alice });

    const failed = await api.book(request([a, b]), {
      key: 'k',
      user: users.bob,
    });
    expect(failed.statusCode).toBe(409);

    const retried = await api.book(request([b]), { key: 'k', user: users.bob });
    expect(retried.statusCode).toBe(201);
  });

  it('two parallel requests with one key -> both 201 with the same body', async () => {
    const [first, second] = await Promise.all([
      api.book(request([a, b]), { key: 'k' }),
      api.book(request([b, a]), { key: 'k' }),
    ]);

    expect([first.statusCode, second.statusCode]).toEqual([201, 201]);
    expect(second.json()).toEqual(first.json());
    expect((await api.myBookings()).json()).toHaveLength(1);
  });
});
