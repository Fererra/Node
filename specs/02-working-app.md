# 02 — Working application: prototype, then database

## Problem

The app has module skeletons but no behaviour: no scenario can be run through the API, and there is no database.

## Goal

The main user path (browse -> choose seats -> book -> view / cancel) works through the HTTP API: first on in-memory data, then on PostgreSQL, with the same API and the same scenario tests.

## Functional requirements

Bodies, error codes, order of checks and idempotency rules: [`docs/api.md`](../docs/api.md).

- FR-1: `GET /movies` — movies with genre names.
- FR-2: `GET /movies/:id/showtimes` — future showtimes of a movie with hall number.
- FR-3: `GET /showtimes/:id/seats` — seats of the showtime's hall with type and `taken`; served by `bookings`.
- FR-4: `POST /bookings` — `{ showtimeId, seatIds }` with a required `Idempotency-Key`; one transaction creates the key, `Booking` (`RESERVED`) and its seats; `201`.
- FR-5: `POST /bookings/:id/cancel` — one transaction sets `CANCELLED` and frees the seats; an already cancelled booking -> `200`, same state.
- FR-6: `GET /me/bookings` — my bookings, cancelled included, with showtime, movie title and seats.
- FR-7: FR-4…FR-6 need `X-User-Id` of a seeded user, else `401`; FR-1…FR-3 ignore it.
- FR-8: Every request has a business-process ID (`X-Request-Id` from the client if valid, else generated), returned in the response header and present in every log line within the request.
- FR-9: All errors, including validation errors and unknown routes, have one body: `{ "error": { "code", "message", "requestId" } }`. Database unavailable -> `503`.

## Non-functional requirements

- NFR-1: `buildApp({ storage: 'memory' | 'postgres' })`; `npm start` reads `STORAGE` (default `postgres`). History has two stages: in-memory repositories first (tag `lab2-in-memory`), then Drizzle repositories behind the same ports.
- NFR-2: Routes know only HTTP; services hold business rules and access checks and mark atomic steps with `UnitOfWork`; SQL and transactions live only in `infrastructure` and `src/shared/db/`. A module's `infrastructure` queries only its own tables.
- NFR-3: Current user, request ID and transaction reach any layer without parameters (ADR-0004); the DB pool is created once and passed to module factories (ADR-0001).
- NFR-4: One global error handler; no try/catch in `http` and `application`.
- NFR-5: With `postgres`, the app runs `SELECT now()` on start and exits if the database is unavailable.
- NFR-6: Booking and cancel run in `uow.run` at `READ COMMITTED`, up to 3 attempts in total on `40001` / `40P01`, then `503`.
- NFR-7: No N+1: each endpoint runs a fixed number of queries; cross-module ports are batch where a list is involved.
- NFR-8: Local DB in Docker on a non-default port; tests use a separate test database (`TEST_DATABASE_URL`), reset and reseeded before each test; `db:migrate`, `db:seed`; CI runs `test:func` with PostgreSQL.
- NFR-9: "Now" and `created_at` come from a `Clock` port; "started" means `starts_at <= now`.

## Design

Schema, ports, seed (`buildSeed(now)`, fixed UUIDs) and module rules: [`docs/architecture.md`](../docs/architecture.md). Context and transactions: ADR-0004.

## Acceptance criteria

- AC-1 (covers NFR-1): `test/scenarios/` passes with `memory` (`npm test`) and `postgres` (`npm run test:func`) — check: `npm test` on tag `lab2-in-memory`; both on the DB commit.
- AC-2 (covers FR-1…FR-6): bodies, fields and order match `docs/api.md` — check: scenario tests.
- AC-3 (covers FR-4, FR-5): book -> seat `taken`; cancel -> free; cancel again, even after start -> `200` — check: scenario test.
- AC-4 (covers FR-4, NFR-6): parallel bookings of one seat -> `201` + `409`; `[a,b]` vs `[b,a]` -> `201` + `409` with no retry — check: `*.pg.test.ts`; retries are seen in the `attempt` field that `withRetry` logs.
- AC-5 (covers FR-4): same key -> same body, one booking; `[b,a]` is the same request; other body -> `422`; two parallel requests with one key -> both `201`, same body — check: scenario test, parallel in `*.pg.test.ts`.
- AC-6 (covers FR-1…FR-7, FR-9): every 4xx in `docs/api.md` returns its status, code and body, in the documented order — check: scenario tests.
- AC-7 (covers FR-9, NFR-4): a throwing repository -> `500 INTERNAL_ERROR` from the global handler — check: test with a fake; ESLint forbids `try` in `http/**`, `application/**`.
- AC-8 (covers FR-8, NFR-3): one `requestId` and `userId` in logs from http, application, infrastructure; `X-Request-Id` in the response; an invalid client ID is replaced — check: test captures logs; pool created once in `src/app/` — check: manual review.
- AC-9 (covers NFR-2, NFR-3): a failure after the seats insert leaves no booking, seats or key — check: `*.pg.test.ts`.
- AC-10 (covers NFR-2): `drizzle-orm` only in `infrastructure` and `shared/db/`; a module's `infrastructure` imports only its own schema file — check: `deps:check`, temporary forbidden imports fail; access checks are in services — check: manual review.
- AC-11 (covers NFR-6): `withRetry` retries `40001` / `40P01` up to 3 attempts, not `23505`; exhausted -> `503` — check: unit tests.
- AC-12 (covers NFR-7): same query count for FR-1, FR-3, FR-6 with 1 vs 20 items and FR-4 with 1 vs 10 seats — check: `*.pg.test.ts`, extra rows added by `test/support/fixtures.ts`.
- AC-13 (covers NFR-9): fixed clock: a showtime at `now` is not listed; booking it -> `422 SHOWTIME_STARTED` — check: scenario test.
- AC-14 (covers FR-9, NFR-5): DB stopped -> `503`; `postgres` start without DB exits — check: manual, `docs/evidence/`.
- AC-15 (covers NFR-8): Compose port isn't `5432`; README setup works; CI runs `test:func` on a service container — check: CI run link, manual.

## Out of scope

- Admin CRUD for movies, halls, showtimes: data comes from the seed.
- Real authentication (`X-User-Id` stub).
- Payments, `PAID`, tariffs; expiry of idempotency keys.

## Open questions

- none
