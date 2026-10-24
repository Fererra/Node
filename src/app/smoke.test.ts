import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';

describe('smoke', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('starts without DATABASE_URL and GET /health returns 200 { status: "ok" }', async () => {
    const app = buildApp({ gitSha: 'unknown' });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(process.env.DATABASE_URL).toBeUndefined();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });

    await app.close();
  });
});
