import { AsyncLocalStorage } from 'node:async_hooks';

/** The user loaded from `X-User-Id` (FR-7). */
export interface CurrentUser {
  id: string;
  name: string;
}

/**
 * Per-request data that any layer except `domain` can read without
 * parameters (ADR-0004). The current transaction is added by the
 * database `UnitOfWork`; the in-memory stage has none.
 */
export interface RequestContext {
  readonly requestId: string;
  user?: CurrentUser;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs `fn` with `context` as the current request context. */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** The current request context, or `undefined` outside a request. */
export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Stores the loaded user in the current request context. */
export function setCurrentUser(user: CurrentUser): void {
  const context = storage.getStore();
  if (!context) {
    throw new Error('setCurrentUser() called outside a request context');
  }
  context.user = user;
}
