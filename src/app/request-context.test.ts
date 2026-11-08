import { describe, expect, it } from 'vitest';
import { getContext } from '../shared/context.js';
import { buildApp } from './app.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function captureLogs() {
  const lines: Record<string, unknown>[] = [];
  return {
    lines,
    stream: {
      write(line: string) {
        lines.push(JSON.parse(line) as Record<string, unknown>);
      },
    },
  };
}

async function healthWith(headers: Record<string, string>) {
  const app = buildApp({ storage: 'memory' });
  const res = await app.inject({ method: 'GET', url: '/health', headers });
  await app.close();
  return res;
}

describe('X-Request-Id', () => {
  it('keeps a valid client id', async () => {
    const res = await healthWith({ 'x-request-id': 'Client_id-42' });
    expect(res.headers['x-request-id']).toBe('Client_id-42');
  });

  it('generates a UUID when the header is missing', async () => {
    const res = await healthWith({});
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it.each([
    ['too long', 'a'.repeat(65)],
    ['bad characters', 'id with spaces'],
    ['a log-injection attempt', 'abc\\n{"level":60}'],
    ['empty', ''],
  ])('replaces an invalid client id (%s) with a UUID', async (_name, id) => {
    const res = await healthWith({ 'x-request-id': id });
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('accepts exactly 64 characters', async () => {
    const id = 'a'.repeat(64);
    const res = await healthWith({ 'x-request-id': id });
    expect(res.headers['x-request-id']).toBe(id);
  });
});

describe('request context', () => {
  it('is available in handlers, also after the body is parsed', async () => {
    const app = buildApp({ storage: 'memory' });
    app.post('/test/context', () => ({
      requestId: getContext()?.requestId,
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/test/context',
      headers: { 'x-request-id': 'ctx-1' },
      payload: { any: 'body' },
    });

    expect(res.json()).toEqual({ requestId: 'ctx-1' });
    await app.close();
  });

  it('survives body parsing over a real socket (not only inject)', async () => {
    const app = buildApp({ storage: 'memory' });
    app.post('/test/context', () => ({
      requestId: getContext()?.requestId,
    }));
    const address = await app.listen({ port: 0, host: '127.0.0.1' });

    const res = await fetch(`${address}/test/context`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'net-1' },
      body: JSON.stringify({ any: 'x'.repeat(100_000) }),
    });

    expect(await res.json()).toEqual({ requestId: 'net-1' });
    await app.close();
  });

  it('adds requestId to every log line of the request, including Fastify ones', async () => {
    const { lines, stream } = captureLogs();
    const app = buildApp({ storage: 'memory', logger: { stream } });
    app.get('/test/log', (request) => {
      request.log.info('from the handler');
      app.log.info('from the base logger');
      return {};
    });

    await app.inject({
      method: 'GET',
      url: '/test/log',
      headers: { 'x-request-id': 'log-1' },
    });
    await app.close();

    const requestLines = lines.filter((l) =>
      [
        'incoming request',
        'from the handler',
        'from the base logger',
        'request completed',
      ].includes(l.msg as string),
    );
    expect(requestLines).toHaveLength(4);
    for (const line of requestLines) {
      expect(line.requestId).toBe('log-1');
      // One id field only: no duplicate Fastify `reqId`.
      expect(line).not.toHaveProperty('reqId');
    }
  });
});

describe('buildApp storage', () => {
  it('refuses postgres without a database URL', () => {
    expect(() => buildApp({ storage: 'postgres' })).toThrow(
      /STORAGE=postgres needs DATABASE_URL/,
    );
  });

  it('with postgres, fails to start when the database is unavailable (NFR-5)', async () => {
    // Nothing listens on port 1: SELECT now() in onReady fails.
    const app = buildApp({
      storage: 'postgres',
      databaseUrl: 'postgres://nobody:nothing@127.0.0.1:1/none',
    });
    await expect(app.ready()).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    await app.close();
  });
});

describe('error log lines', () => {
  it.each([
    ['a malformed JSON body', { payload: '{"a":', status: 400 }],
    ['a thrown error', { payload: '{}', status: 500 }],
  ])('carry requestId for %s', async (_name, { payload, status }) => {
    const { lines, stream } = captureLogs();
    const app = buildApp({ storage: 'memory', logger: { stream } });
    app.post('/test/fail', () => {
      throw new Error('boom');
    });
    const address = await app.listen({ port: 0, host: '127.0.0.1' });

    const res = await fetch(`${address}/test/fail`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': 'err-1' },
      body: payload,
    });
    await app.close();

    expect(res.status).toBe(status);
    const requestLines = lines.filter(
      (l) => !String(l.msg).startsWith('Server listening'),
    );
    // incoming request, the error handler's line, request completed
    expect(requestLines.map((l) => l.msg)).toHaveLength(3);
    expect(requestLines[1]).toMatchObject(
      status === 500
        ? { msg: 'request failed' }
        : { code: 'VALIDATION_ERROR', statusCode: 400 },
    );
    for (const line of requestLines) {
      expect(line.requestId).toBe('err-1');
    }
  });
});
