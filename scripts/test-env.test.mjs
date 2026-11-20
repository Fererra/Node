import { describe, expect, it } from 'vitest';
import {
  databaseOf,
  databaseUrls,
  maintenanceUrl,
  parseEnvText,
  sameDatabasePairs,
} from './test-env.mjs';

const example = {
  DATABASE_URL: 'postgres://u:p@localhost:55432/cinema',
  TEST_DATABASE_URL: 'postgres://u:p@localhost:55432/cinema_test',
  E2E_DATABASE_URL: 'postgres://u:p@localhost:55432/cinema_e2e',
};

describe('databaseUrls', () => {
  it('takes every URL from .env.example when there is no .env', () => {
    expect(databaseUrls(parseEnvText(undefined), example)).toEqual(example);
  });

  it('takes each variable from .env, and a missing or empty one from .env.example', () => {
    const dotEnv = parseEnvText(
      'STORAGE=postgres\nDATABASE_URL=postgres://u:p@localhost:55432/dev\nTEST_DATABASE_URL=\n',
    );
    expect(databaseUrls(dotEnv, example)).toEqual({
      DATABASE_URL: 'postgres://u:p@localhost:55432/dev',
      TEST_DATABASE_URL: example.TEST_DATABASE_URL,
      E2E_DATABASE_URL: example.E2E_DATABASE_URL,
    });
  });

  it('returns only the database URLs', () => {
    const dotEnv = { STORAGE: 'postgres', PORT: '1' };
    expect(Object.keys(databaseUrls(dotEnv, example))).toEqual([
      'DATABASE_URL',
      'TEST_DATABASE_URL',
      'E2E_DATABASE_URL',
    ]);
  });

  it('fails when a URL is in neither file', () => {
    const withoutE2e = { ...example, E2E_DATABASE_URL: undefined };
    expect(() => databaseUrls({}, withoutE2e)).toThrow(/E2E_DATABASE_URL/);
  });
});

describe('sameDatabasePairs', () => {
  it('is empty for three different databases', () => {
    expect(sameDatabasePairs(example)).toEqual([]);
  });

  it('finds two variables that name the same database', () => {
    expect(
      sameDatabasePairs({
        ...example,
        E2E_DATABASE_URL: example.TEST_DATABASE_URL,
      }),
    ).toEqual([['TEST_DATABASE_URL', 'E2E_DATABASE_URL']]);
  });

  it('treats other spellings of one database as the same', () => {
    expect(
      sameDatabasePairs({
        DATABASE_URL: 'postgres://a:x@localhost:5432/cinema',
        TEST_DATABASE_URL: 'postgresql://b:y@127.0.0.1/cinema?sslmode=disable',
      }),
    ).toEqual([['DATABASE_URL', 'TEST_DATABASE_URL']]);
  });

  it('keeps the same name on another port or host apart', () => {
    expect(
      sameDatabasePairs({
        A: 'postgres://u@localhost:5432/cinema',
        B: 'postgres://u@localhost:5433/cinema',
        C: 'postgres://u@db.example:5432/cinema',
      }),
    ).toEqual([]);
  });
});

describe('databaseOf', () => {
  it('defaults the database name to the user name', () => {
    expect(databaseOf('postgres://cinema@localhost')).toEqual({
      host: 'localhost',
      port: '5432',
      name: 'cinema',
    });
  });
});

describe('maintenanceUrl', () => {
  it('points at the postgres database of the same server', () => {
    expect(maintenanceUrl(example.E2E_DATABASE_URL)).toBe(
      'postgres://u:p@localhost:55432/postgres',
    );
  });
});
