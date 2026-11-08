# 08 — In-memory stage (Lab 2)

## Prompt

> Implement stage 1 of specs/02-working-app.md: the in-memory stage only. Read the spec, docs/api.md, docs/architecture.md, adr/ (especially 0004) and standards/ first.
>
> Scope of this stage:
>
> - All scenarios FR-1…FR-9 through the HTTP API with STORAGE=memory: in-memory repositories behind the module ports, buildSeed(now) with fixed UUIDs, Clock port, request context (AsyncLocalStorage) with requestId and user, logger that adds requestId and userId from the context, user loading in a route-level onRequest hook, one global error handler with the error codes from docs/api.md, in-memory UnitOfWork, withRetry (unit-tested now, used by the DB UnitOfWork later).
> - buildApp({ storage }) with 'memory' working; 'postgres' is not implemented yet and fails with a clear error.
> - Scenario tests in test/scenarios/ that will later run unchanged on PostgreSQL, plus unit tests.
> - ESLint rule that forbids try in http/** and application/**; dependency-cruiser rules for the new shared files (context, unit-of-work, clock, retry) per docs/architecture.md#rules.
>
> Not in this stage: Drizzle, schema, migrations, Docker, test:func, \*.pg.test.ts, PostgreSQL in CI. Don't add them.
>
> Constraints:
>
> - Do not change specs/, docs/, adr/, standards/, ai/ or README.md. If something in them is wrong, unclear or impossible, stop and tell me instead of working around it.
> - Commit in small steps with Conventional Commits (e.g. shared context and clock -> error handler -> movies -> seats -> showtimes -> users -> bookings -> scenario tests). Run npm run check before each commit.
> - Do not push and do not create tags.
>
> At the end, report for each AC that applies to this stage (AC-1 memory part, AC-2, AC-3, AC-5 except the parallel case, AC-6, AC-7, AC-8, AC-10 for the rules that exist now, AC-11, AC-13) how you verified it. Break things where the AC says so (temporary imports, a try in application) and revert them. List decisions you made that the docs don't cover.

## Answer

Stage 1 is done: all of FR-1…FR-9 work through the HTTP API with `STORAGE=memory`. It's in 10 commits on `lab2-working-app` (`8f7598b`…`a4d9fdf`). `npm run check` passed before each commit and passes now (155 tests, no boundary violations). I didn't push, tag, or change anything in specs/, docs/, adr/, standards/, ai/ or README.md. Nothing in those docs was wrong enough to stop for.

One thing to know first: `npm start` with no `STORAGE` set now exits with "STORAGE=postgres is not implemented yet… use STORAGE=memory". That's the spec's default, so you need `STORAGE=memory` until the DB stage. I tried both by hand: the default fails as expected, and with memory `/movies` returns `200` and echoes `X-Request-Id`.

### How each AC was verified

| AC                                   | How                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC-1** (memory)                    | `npm test` runs `test/scenarios/*.test.ts` on memory. `test/support/app.ts` reads `STORAGE` (default `memory`), so the same files can later run on PostgreSQL. `*.pg.test.ts` is excluded from `npm test`.                                                                                                                                                                                                                                                                               |
| **AC-2**                             | Scenario tests compare whole bodies and order for FR-1…FR-6: movies by title, genres by name; only future showtimes by `startsAt`; seats by row and number; `/me/bookings` newest first, ties by `id`, cancelled ones included with movie title and start.                                                                                                                                                                                                                               |
| **AC-3**                             | Scenario test: book → seats `taken`; cancel → `CANCELLED` with `seats: []` and the seats free (and bookable again); cancel again → `200` with the same body, also after the clock is moved past the start. Cancelling a `RESERVED` booking after start → `422`.                                                                                                                                                                                                                          |
| **AC-5** (without the parallel case) | Same key → same body and one booking; `[b,a]` counts as `[a,b]`; another body → `422`; keys are per user; a replay after cancel returns `CANCELLED`; a failed `409` stores nothing, so the key can be reused. I also added a parallel same-key test (`Promise.all`); it passes in memory.                                                                                                                                                                                                |
| **AC-6**                             | `test/scenarios/errors.test.ts` checks every 4xx in `docs/api.md` for its status, code, and full body, with `requestId` equal to the header. It also checks the documented order: `401` before `400` (even with malformed JSON), `400` before idempotency, reused key before `404`, started before not-in-hall, not-in-hall before `409`, and for cancel `401 → 400 → 404 → CANCELLED → started`.                                                                                        |
| **AC-7**                             | `test/integration/internal-error.test.ts` makes a repository method throw (via `vi.spyOn`). Result: `500 INTERNAL_ERROR` with a generic message, no leaked details, the error logged with `requestId`, and nothing booked. ESLint rule checked by adding a `try` in application and in http, and a `.catch()` in application. All three failed lint, then I reverted them.                                                                                                               |
| **AC-8**                             | `test/integration/request-logs.test.ts` captures the logs. Lines from http, application and infrastructure carry the same `requestId` and `userId`; every line of the request has `requestId`, including Fastify's own; the header is returned; an invalid client ID is replaced by a UUID. Another test checks the context survives body parsing on a real socket, not just `inject`.                                                                                                   |
| **AC-10** (rules that exist now)     | 13 temporary forbidden imports, each failing `deps:check`, then reverted: another module's internals; a value import from another module; another module from http; edges outside the graph and cycles; `fastify` in application; `shared/context` in domain; http or application → infrastructure; an npm package or `shared/module` in the shared files; shared → app; module → app. Access checks (user required, booking owner) are in the bookings service, for your manual review. |
| **AC-11**                            | Unit tests for `withRetry`: `40001`/`40P01` retried, 3 attempts in total, then `503` keeping the original error as the cause; `23505` and other errors rethrown after one attempt; every attempt logged with an `attempt` field.                                                                                                                                                                                                                                                         |
| **AC-13**                            | Fixed clock: the showtime at exactly `now` isn't listed, and booking it gives `422 SHOWTIME_STARTED`.                                                                                                                                                                                                                                                                                                                                                                                    |

The tests passed on the first run, so I checked they actually bite. I made 10 deliberate code breaks, and each one made its tests fail. Examples: a non-atomic in-memory write, `<` instead of `<=` for "started", unsorted seat ids, cancel checking the start time first, swapped check order, retrying `23505`, no context in the logger, loading the user in `preHandler`, leaking the 500 message. All were reverted and the tree is clean.

### Decisions the docs don't cover

1. **Two extra shared files:** `src/shared/errors.ts` (`AppError` with the documented codes) and `src/shared/logger.ts` (`Logger` interface and the context log fields). The new dependency-cruiser rules cover them along with context, unit-of-work, clock and retry: no npm packages, and imports only from each other and `shared/kernel`.
2. **Error → status mapping** is one table in the global handler in `src/app/`, instead of each module's http layer, so there is a single handler. All of Fastify's own 4xx errors (bad JSON, 415, 413) become `400 VALIDATION_ERROR`.
3. **Logging:** pino adds `requestId` and `userId` from the context to every line. Fastify's own `reqId` binding is dropped so there's one ID field. A small Fastify log-controller subclass puts Fastify's request lines inside the context.
4. **No transaction field in the context yet.** The architecture says the context holds the current transaction; that comes with the DB `UnitOfWork`.
5. **UUIDs are case-insensitive and lowercased in http**, so memory and PostgreSQL agree. Seat ids that only differ in case count as duplicates (`400`). Ajv type coercion is off, so `seatIds: "x"` is a `400`, not `["x"]`.
6. **"Started"** (`startsAt <= now`) is one function in `shared/kernel/time.ts`, used by both showtimes and bookings. Text sorts by code point, like PostgreSQL's `C` collation.
7. **Module factories** take `storage: { kind: 'memory', seed }` (bookings: `{ kind: 'memory' }`). The repository port uses `claimKey` + `save` returning `'created' | 'seat-taken' | 'key-taken'`, so one service works with both stages.
8. **Seed:** ids are `<type prefix>-0000-4000-8000-<n>`, and seat ids encode hall/row/seat. Two halls (3×4 and 2×3, last row VIP), 4 movies (one with no showtimes), 6 showtimes including one in the past and one at exactly `now`, and 2 users.
9. **Smaller choices:**
   - Seats inside a booking are sorted by row and number.
   - `withRetry` has no backoff and also finds the error code in wrapped errors (`cause` chain).
   - ESLint also bans `.catch()` in http/application; test files are exempt.
   - The 404 message names the method and path.
10. **Tests:**
    - Unit tests for domain and kernel code live in `test/unit/`, because dependency-cruiser also checks tests under `src/` and they import vitest.
    - The AC-7 and AC-8 tests live in `test/integration/`, not `test/scenarios/`: they hook into in-memory internals and log messages, so they don't run on PostgreSQL.
11. **For the DB stage:**
    - `buildApp` is still synchronous, so the `SELECT now()` startup check will need an `onReady` hook or an async `buildApp`.
    - A cancel sent with `content-type: application/json` and an empty body gets Fastify's `400`.
