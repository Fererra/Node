# ADR-0004: Request context and transactions through AsyncLocalStorage

- Status: accepted
- Date: 2026-11-08

## Context

From Lab 2 the app has real scenarios and a database (spec `specs/02-working-app.md`). Code in every layer needs three things that belong to the current request or operation:

- the current user (for access checks and logs);
- a business-process ID (`requestId`) that must appear in every log line from any layer (FR-8);
- the current transaction, because one operation can span several repositories, including repositories of other modules (booking checks that seats belong to the showtime's hall, and seats are owned by `seats`).

Long-lived resources (DB pool, config, base logger) are already handled: `src/app/` creates them once and passes them to module factories (ADR-0001). This ADR is about per-request data and transactions. The lab requires them to reach any layer without passing 10–15 parameters (NFR-3), and SQL and transactions must stay out of routes and services (NFR-2).

## Decision Drivers

- No context parameters threaded through every call.
- `requestId` and `userId` in every log line, from any layer, without the caller adding them.
- Services decide what is atomic, but never see SQL or the ORM.
- Repositories of different modules can join one transaction without crossing module boundaries.
- Fits ADR-0001 (factories and ports) and ADR-0002 (no framework DI); no decorators that hide dependencies from dependency-cruiser.
- `domain` stays free of packages and of any transaction handle.

## Considered Options

### Option A: Explicit context parameter

Every function takes `ctx: { requestId, user, log, tx }` and passes it on.

- Pros: everything is visible in signatures; no hidden state; simple to test.
- Cons: this is exactly the parameter threading the lab forbids; `ctx` goes through functions that only need it for logs; easy to drift as the code grows.

### Option B: Fastify request decorations only

Use `request.id`, `request.log` and a decorated `request.user`.

- Pros: built in, nothing to build.
- Cons: available only in the `http` layer; `application` must not know Fastify, so deeper layers fall back to Option A.

### Option C: DI container with a request scope

A container creates request-scoped services that receive the user, request ID and transaction.

- Pros: a common pattern; request scope out of the box.
- Cons: a second assembly mechanism next to the factories of ADR-0001; popular containers rely on decorators and reflection, which hide dependencies from dependency-cruiser; a new concept and package to defend.

### Option D: Context registry (service locator)

One shared registry object; any code gets what it needs by key, e.g. `registry.get('db')`.

- Pros: simple; no parameters; one place to see all registered resources.
- Cons: a global registry has no per-request scope, so the current user, request ID and transaction can't live in it safely with parallel requests; dependencies are hidden behind string keys, so neither the compiler nor dependency-cruiser sees them; it overlaps with the module factories of ADR-0001 for long-lived resources.

### Option E: AsyncLocalStorage for request context, Unit of Work port for transactions

An `onRequest` hook starts a context `{ requestId, user }` with `AsyncLocalStorage.run`. Any code reads it through `getContext()`. The logger adds `requestId` and `userId` to every line from the context. Services mark atomic steps with a `UnitOfWork` port (`uow.run(work)`); its implementation opens a database transaction and stores it in the same context, and repositories use the transaction from the context if there is one, otherwise the pool.

- Pros: no parameters; logs get the IDs automatically; services see only `uow.run`; repositories of several modules join one transaction through their own ports; built into Node (`node:async_hooks`), no new package; retries live in one place (`uow.run`).
- Cons: implicit: a signature doesn't show that code reads the context; the context can be lost in code outside the async chain (timers, event emitters); a repository behaves differently inside and outside `uow.run`; tests must run code inside a context.

### Option F: Unit of Work with the transaction passed explicitly

Same `UnitOfWork` port, but `run` gives the transaction to the callback, and every repository method takes it as an optional parameter.

- Pros: explicit; easy to see which calls are transactional.
- Cons: an extra parameter on every repository method (parameter threading again); if a call forgets to pass it, the repository silently runs outside the transaction; the transaction type (or `unknown`) leaks into repository ports.

### Option G: Effect (typed context and layers)

Dependencies are part of each effect's type, checked by the compiler.

- Pros: strongest type safety; built-in retries, errors and resources.
- Cons: a different programming model for the whole codebase, not only for dependencies; steep learning curve; needs wrappers around Fastify and Drizzle; too much for this course.

## Decision

Option E: request context in AsyncLocalStorage, and transactions through a `UnitOfWork` port whose implementation keeps the transaction in the same context.

- The context store, `getContext()` and the `UnitOfWork` interface live in `src/shared/` (not in `shared/kernel/`, so `domain` doesn't use them).
- The database implementation (pool, `UnitOfWork`, "transaction or pool" executor) lives in `src/shared/db/` and is used only by module `infrastructure` layers.
- `src/app/` creates the pool and the `UnitOfWork` at startup and passes them to module factories.

## Consequences

- Good: no context parameters in any signature; every log line has `requestId` and, when known, `userId`.
- Good: services stay free of SQL and the ORM; the only transaction concept they see is `uow.run`.
- Good: one operation can use repositories of several modules in one transaction, each through its own module's port.
- Good: retries on `40001` / `40P01` are implemented once, in `uow.run` (NFR-6).
- Bad: dependencies on the context are implicit; they must be documented and covered by tests (spec AC-6).
- Bad: tests must start a context; a test helper is needed.
- Bad: in the in-memory stage (NFR-1), `UnitOfWork` just runs `work` without a transaction or retries; atomicity and retries are only guaranteed from the DB stage.
- Rules for implementation:
  - All checks an operation relies on (seat belongs to the hall, showtime hasn't started) run inside `uow.run`, not before it.
  - `uow.run` may be retried, so `work` must have no external side effects (emails, HTTP calls).
  - A nested `uow.run` reuses the outer transaction.
  - `uow.run` retries only on `40001` / `40P01` and rethrows every other error unchanged. Repositories translate constraint violations into application errors (e.g. the `booking_seat` primary key -> "seat taken" -> `409`), so the global error handler can map them.
