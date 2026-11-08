import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import {
  LogController,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { runWithContext, type RequestContext } from '../shared/context.js';

/** A client `X-Request-Id` is kept only if it matches this (docs/api.md). */
const CLIENT_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** `genReqId`: the client's `X-Request-Id` if valid, else a new UUID (FR-8). */
export function requestIdFor(raw: IncomingMessage): string {
  const header = raw.headers['x-request-id'];
  return typeof header === 'string' && CLIENT_REQUEST_ID.test(header)
    ? header
    : randomUUID();
}

const contexts = new WeakMap<FastifyRequest, RequestContext>();

/** The context of `request`, created on first use. */
export function contextOf(request: FastifyRequest): RequestContext {
  let context = contexts.get(request);
  if (!context) {
    context = { requestId: request.id };
    contexts.set(request, context);
  }
  return context;
}

/**
 * Fastify writes its own request log lines ("incoming request", "request
 * completed", ...) outside the hook chain. This controller writes them
 * inside the request's context, so they get `requestId` and `userId`
 * like every other line.
 */
export class ContextLogController extends LogController {
  override incomingRequest(
    request: FastifyRequest,
    reply: FastifyReply,
    metadata?: Record<string, unknown>,
  ): void {
    runWithContext(contextOf(request), () => {
      super.incomingRequest(request, reply, metadata);
    });
  }

  override requestCompleted(
    error: Error | null | undefined,
    request: FastifyRequest,
    reply: FastifyReply,
    metadata?: Record<string, unknown>,
  ): void {
    runWithContext(contextOf(request), () => {
      super.requestCompleted(error, request, reply, metadata);
    });
  }

  override streamError(
    error: Error,
    request: FastifyRequest,
    reply: FastifyReply,
    metadata?: Record<string, unknown>,
  ): void {
    runWithContext(contextOf(request), () => {
      super.streamError(error, request, reply, metadata);
    });
  }
}

/**
 * Starts the request context (ADR-0004) and returns `X-Request-Id`.
 * Called on the root instance before any route or module is added, so
 * the hooks apply to every route and to the 404 handler.
 */
export function installRequestContext(app: FastifyInstance): void {
  app.addHook('onRequest', (request, _reply, done) => {
    runWithContext(contextOf(request), done);
  });

  // No re-entry is needed after body parsing: Fastify continues from the
  // parser in an AsyncResource created inside this context (guarded by a
  // test over a real socket).

  app.addHook('onSend', (request, reply, payload, done) => {
    void reply.header('x-request-id', request.id);
    done(null, payload);
  });
}
