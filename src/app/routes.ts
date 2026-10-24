import type { FastifyPluginCallback } from 'fastify';

export interface SystemRoutesOptions {
  gitSha: string;
}

export const systemRoutes: FastifyPluginCallback<SystemRoutesOptions> = (
  app,
  { gitSha },
  done,
) => {
  app.get(
    '/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: { status: { type: 'string', const: 'ok' } },
            required: ['status'],
          },
        },
      },
    },
    () => ({ status: 'ok' }),
  );

  app.get(
    '/version',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: { sha: { type: 'string' } },
            required: ['sha'],
          },
        },
      },
    },
    () => ({ sha: gitSha }),
  );

  done();
};
