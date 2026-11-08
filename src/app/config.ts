export type Storage = 'memory' | 'postgres';

export interface Config {
  port: number;
  host: string;
  gitSha: string;
  storage: Storage;
  databaseUrl: string | undefined;
}

/** `STORAGE` env value; unset or empty means `postgres` (NFR-1). */
export function parseStorage(value: string | undefined): Storage {
  if (value === undefined || value === '') return 'postgres';
  if (value === 'memory' || value === 'postgres') return value;
  throw new Error(
    `STORAGE must be "memory" or "postgres", got ${JSON.stringify(value)}`,
  );
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '127.0.0.1',
    gitSha: env.GIT_SHA || 'unknown',
    storage: parseStorage(env.STORAGE),
    databaseUrl: env.DATABASE_URL || undefined,
  };
}
