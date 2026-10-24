import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig(process.env);
const app = buildApp({ gitSha: config.gitSha, logger: true });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close();
  });
}

await app.listen({ port: config.port, host: config.host });
