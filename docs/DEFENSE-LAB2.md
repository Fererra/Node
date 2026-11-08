# DEFENSE — Assignment 2: Working application (prototype -> database)

**1. What I implemented and what I asked the AI.** The main user path of the cinema service (movies -> showtimes -> seats -> book -> my bookings / cancel) through the HTTP API, first on in-memory data (tag `lab2-in-memory`), then on PostgreSQL with the same API and the same scenario tests. The spec, API contract, architecture rules, ADR-0004, evidence and this document are mine; the AI reviewed the spec (6 rounds) and wrote the code in two stages. Prompts and reports: `ai/07`…`ai/12`.

**2. Top-3 discrepancies I found and fixed** (spec <-> AI output):

| #   | What was wrong (against which part of the spec)                                                                                                                                                                                                                                                                                                                                                           | My trace                                              | Fix (commits)                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | NFR-2 / `docs/architecture.md#rules`: `index.ts` may not import `shared/db/`, so the agent re-exported `PostgresStorage` through every module's `infrastructure`. The rule held on paper, `deps:check` was green, but `index.ts` depended on `shared/db` through a detour. Root cause: the rules didn't say how a factory types its `storage` option.                                                     | `ai/11-db-review.md` §1 · `ai/12-storage-type-fix.md` | input: `cae63d3` -> code: `5cc9223` (type-only import, new depcruise rule) |
| 2   | NFR-4 vs architecture: the docs said both "`http` maps application errors" and "one global error handler". The agent picked the second on its own and mentioned it only at the end of the report. Root cause: two rules pulling in different directions.                                                                                                                                                  | `ai/08-in-memory.md` · `ai/09-in-memory-review.md` §1 | input: `8035d0f` (one code -> status table in `src/app/`)                  |
| 3   | FR-4 idempotency: "a parallel request with the same key waits and replays" needed catching a `23505` in `application`, which NFR-4 forbids; the in-memory stage also couldn't roll back a claimed key. Root cause: the spec described the outcome, not a mechanism compatible with my other rules. Redesigned: claim the key first with `ON CONFLICT DO NOTHING` + a deferred FK, conflicts by row count. | `ai/07-spec-review.md` rounds 2–5                     | input: `1450632`, `ef65106`, `6f1cd4c` -> code: `9c2e3b2`, `19c6b26`       |

Check of #3: making the FK `NOT DEFERRABLE` broke 31 tests (every booking -> `500`), see `ai/10-db-stage.md`.

**3. Key decision:** request context and transactions through AsyncLocalStorage, with a `UnitOfWork` port whose implementation keeps the transaction in the same context. Considered: explicit `ctx` parameters (the threading the lab forbids), Fastify decorations only (don't reach `application`), a DI container (duplicates ADR-0001 factories, hides dependencies), a context registry (no per-request scope), Unit of Work with an explicit transaction parameter (threading again, easy to forget), Effect (a different programming model). See `adr/0004-request-context-and-transactions.md`; DB and ORM: `adr/0003-drizzle-orm.md`.

**4. Verification** (on `bf09be2`):

- `npm run check` -> format, lint, types, `deps:check` (0 violations, 104 modules), 171 tests in 24 files (unit, smoke, in-memory scenarios), build: all pass.
- `npm run test:func` -> 78 tests in 8 files on PostgreSQL (the same `test/scenarios/` + `*.pg.test.ts`): all pass.
- `npm run build && npm start`, `curl localhost:3000/version` -> `{"sha":"bf09be2"}`, equal to `git rev-parse --short=7 HEAD`.
- CI: [`check` + `test:func` with a PostgreSQL service container](https://github.com/Fererra/Node/actions/runs/42501901829/job/128796263739?pr=3).
- AC-1: `npm test` on tag `lab2-in-memory`; `git diff lab2-in-memory -- test/scenarios` is empty.

**5. Audit.**

- N+1: possible in `GET /me/bookings`, where each booking needs a showtime, movie and hall through two levels of ports. Broken on purpose: one port call per booking -> 63 queries instead of 6 for 20 bookings, caught by AC-12; prevented by batch ports. [`docs/evidence/lab2-n-plus-one.md`](evidence/lab2-n-plus-one.md).
- Failures: DB stopped while running -> `503 SERVICE_UNAVAILABLE` with the FR-9 body; start without DB -> exit code 1 ([`docs/evidence/lab2-db-failure.md`](evidence/lab2-db-failure.md)). A failure after the seats insert rolls back booking, seats and key (AC-9). Overlapping bookings `[a,b]` / `[b,a]` -> `201` + `409` with no retry thanks to sorted inserts; unsorted inserts deadlocked and were retried (AC-4).
- Edge cases: two parallel bookings of one seat -> one `201`, the rest `409`; two parallel requests with one key -> both `201` with the same body; cancel after start -> `200` if already cancelled, else `422`; `401` before any `400`, because the user is loaded in a route-level `onRequest` hook.
