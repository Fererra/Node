import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig(process.env);
const app = buildApp({
  storage: config.storage,
  gitSha: config.gitSha,
  databaseUrl: config.databaseUrl,
  logger: true,
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close();
  });
}

try {
  // With STORAGE=postgres, `listen` runs `SELECT now()` first (onReady).
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.fatal({ err: error }, 'the app failed to start');
  await app.close();
  process.exit(1);
}
