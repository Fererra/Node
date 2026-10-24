import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

async function getVersion(env: NodeJS.ProcessEnv): Promise<unknown> {
  const app = buildApp({ gitSha: loadConfig(env).gitSha });
  const res = await app.inject({ method: 'GET', url: '/version' });
  await app.close();

  expect(res.statusCode).toBe(200);
  return res.json();
}

describe('GET /version', () => {
  it('returns GIT_SHA when it is set', async () => {
    expect(await getVersion({ GIT_SHA: 'abc1234' })).toEqual({
      sha: 'abc1234',
    });
  });

  it('returns "unknown" when GIT_SHA is unset', async () => {
    expect(await getVersion({})).toEqual({ sha: 'unknown' });
  });
});
