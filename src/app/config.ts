export interface Config {
  port: number;
  host: string;
  gitSha: string;
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '127.0.0.1',
    gitSha: env.GIT_SHA || 'unknown',
  };
}
