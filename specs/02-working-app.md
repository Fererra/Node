# 02 — Working application: prototype, then database

## Problem

The app has module skeletons but no behaviour: no scenario can be run through the API, and there is no database.

## Goal

The main user path (browse -> choose seats -> book -> view / cancel) works through the HTTP API: first on in-memory data, then on PostgreSQL, with the same API and tests.

## Functional requirements

| ID   | Endpoint                    | Behaviour                                                                                              | Errors                                                                                                                                                                                               |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-1 | `GET /movies`               | Movies with genre names.                                                                               | —                                                                                                                                                                                                    |
| FR-2 | `GET /movies/:id/showtimes` | Future showtimes of the movie, with hall number.                                                       | `400` bad id, `404` no movie                                                                                                                                                                         |
| FR-3 | `GET /showtimes/:id/seats`  | All seats of the showtime's hall with type and `taken`.                                                | `400`, `404`                                                                                                                                                                                         |
| FR-4 | `POST /bookings`            | `{ showtimeId, seatIds }` + `Idempotency-Key`; one transaction: `Booking` (`RESERVED`) + seats. `201`. | `400` missing `Idempotency-Key`, empty / duplicate / >10 seats, `404` showtime, `422` seat not in hall or showtime started, `409` a seat is taken (nothing booked), `422` same key with another body |
| FR-5 | `POST /bookings/:id/cancel` | One transaction: `CANCELLED` + delete its `BookingSeat` rows. Repeated cancel -> `200`, same state.    | `404` missing or not mine, `422` showtime started                                                                                                                                                    |
| FR-6 | `GET /me/bookings`          | My bookings with showtime, movie and seats.                                                            | —                                                                                                                                                                                                    |

- FR-7: FR-4…FR-6 need `X-User-Id` of a seeded user, else `401`. FR-1…FR-3 need no user.
- FR-8: Every request has a business-process ID (`X-Request-Id` or generated), returned in the response and present in every log line.
- FR-9: All errors have one body: `{ "error": { "code", "message", "requestId" } }`. Database unavailable -> `503`.

## Non-functional requirements

- NFR-1: Two stages in history: in-memory repositories first, then Drizzle repositories behind the same ports.
- NFR-2: Routes know only HTTP; services hold business rules and access checks and mark atomic steps with a `UnitOfWork` port; SQL and the transaction implementation live only in `infrastructure` and `src/shared/db/`.
- NFR-3: Current user, request ID and the current transaction reach any layer without being passed as parameters (request context, ADR-0004); the DB pool is passed once to module factories at startup (ADR-0001).
- NFR-4: One global error handler; no try/catch wrapping whole functions.
- NFR-5: On start, the app runs `SELECT now()` and exits if the database is unavailable.
- NFR-6: Booking and cancel transactions are retried up to 3 times on `40001` / `40P01`; never on `409`.
- NFR-7: No N+1: each endpoint runs a fixed number of queries, independent of result size.
- NFR-8: Local DB runs in Docker on a non-default port; tests use a separate database per run; CI runs functional tests with PostgreSQL.

## Design

Physical schema and the new `IdempotencyKey` table: [`docs/architecture.md#data`](../docs/architecture.md#data). Request context and `shared/db` rules: [`docs/architecture.md#rules`](../docs/architecture.md#rules), ADR-0004. Seed: halls, seats, movies, genres, showtimes, 2 users.

## Acceptance criteria

- AC-1 (covers FR-1…FR-6, NFR-1): every scenario has a functional test via `fastify.inject` — check: the scenario tests (AC-2, AC-4, AC-5) pass unchanged on the in-memory commit and on the DB commit; AC-3, AC-7 and AC-10 apply from the DB stage.
- AC-2 (covers FR-4, FR-5): book -> seat `taken`; cancel -> seat free — check: functional test.
- AC-3 (covers FR-4): two parallel bookings of one seat -> one `201`, one `409`, one `BookingSeat` row — check: functional test with `Promise.all`.
- AC-4 (covers FR-4): same `Idempotency-Key` twice -> same booking, one row; other body -> `422` — check: functional test.
- AC-5 (covers FR-4…FR-7): every error row of the table returns its status and the FR-9 body — check: functional tests.
- AC-6 (covers FR-8, NFR-3): a booking request writes log lines from http, application and infrastructure with the same `requestId` and `userId` — check: test captures logs.
- AC-7 (covers FR-9, NFR-5): DB stopped -> requests return `503`; app does not start without DB — check: manual, log in `docs/evidence/`.
- AC-8 (covers NFR-2): `drizzle-orm` is imported only in module `infrastructure` and `src/shared/db/`; `shared/db/` is imported only by `infrastructure` and `src/app/` — check: `deps:check`, plus temporary imports of `drizzle-orm` in `application` and of `shared/db/` in `application` both fail.
- AC-9 (covers NFR-6): a forced `40001` on the first attempt -> booking succeeds — check: unit test with a fake repository.
- AC-10 (covers NFR-7): FR-1, FR-3, FR-6 run a constant number of queries for 1 and 20 items — check: test counts queries.

## Out of scope

- Admin CRUD for movies, halls, showtimes: data comes from the seed.
- Real authentication (users identified by `X-User-Id`, stub).
- Payments, `PAID` status, tariffs.

## Open questions

- none
