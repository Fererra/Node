// AC-8: one requestId and userId in log lines from http, application and
// infrastructure, without passing them as parameters (ADR-0004).
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../support/app.js';
import {
  client,
  seat,
  showtimes,
  users,
  type BookingBody,
} from '../support/client.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Line = Record<string, unknown>;

async function bookWithLogs(headers: Record<string, string>) {
  const lines: Line[] = [];
  const { app } = await createTestApp({
    logger: {
      level: 'debug',
      stream: {
        write: (line) => {
          lines.push(JSON.parse(line) as Line);
        },
      },
    },
  });
  const res = await client(app).book(
    { showtimeId: showtimes.orbitTomorrow, seatIds: [seat(1, 1, 1)] },
    { headers },
  );
  await app.close();
  return { res, lines };
}

const byMessage = (lines: Line[], msg: string) =>
  lines.find((l) => l.msg === msg);

describe('AC-8: request id and user id in logs', () => {
  it('lines from http, application and infrastructure carry the same requestId and userId', async () => {
    const { res, lines } = await bookWithLogs({ 'x-request-id': 'trace-42' });

    expect(res.statusCode).toBe(201);
    expect(res.headers['x-request-id']).toBe('trace-42');

    const fromLayers = {
      http: byMessage(lines, 'create booking request'),
      application: byMessage(lines, 'booking created'),
      infrastructure: byMessage(lines, 'booking rows written'),
    };
    for (const [layer, line] of Object.entries(fromLayers)) {
      expect(line, `${layer} line`).toMatchObject({
        requestId: 'trace-42',
        userId: users.alice,
      });
    }
    expect(fromLayers.application).toMatchObject({
      bookingId: res.json<BookingBody>().id,
    });
  });

  it('every line of the request has requestId; userId appears once the user is loaded', async () => {
    const { lines } = await bookWithLogs({ 'x-request-id': 'trace-43' });
    const requestLines = lines.filter(
      (l) => !String(l.msg).startsWith('Server'),
    );

    expect(requestLines.length).toBeGreaterThanOrEqual(5);
    for (const line of requestLines) {
      expect(line.requestId).toBe('trace-43');
    }
    // "incoming request" is logged before the onRequest user hook.
    expect(byMessage(lines, 'incoming request')).not.toHaveProperty('userId');
    expect(byMessage(lines, 'request completed')).toMatchObject({
      userId: users.alice,
    });
  });

  it('an invalid client X-Request-Id is replaced by a UUID, in the header and the logs', async () => {
    const { res, lines } = await bookWithLogs({
      'x-request-id': 'bad id with spaces',
    });

    const id = res.headers['x-request-id'];
    expect(id).toMatch(UUID);
    expect(byMessage(lines, 'booking created')).toMatchObject({
      requestId: id,
    });
    expect(JSON.stringify(lines)).not.toContain('bad id with spaces');
  });
});
