import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { systemRoutes } from './routes.js';

export interface AppOptions {
  gitSha: Config['gitSha'];
  logger?: boolean;
}

export function buildApp({
  gitSha,
  logger = false,
}: AppOptions): FastifyInstance {
  const app = Fastify({ logger });

  void app.register(systemRoutes, { gitSha });

  return app;
}
