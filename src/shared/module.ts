import type { FastifyPluginAsync } from 'fastify';

/** What every `create<Name>Module` factory returns. */
export interface AppModule<TService> {
  plugin: FastifyPluginAsync;
  service: TService;
}
