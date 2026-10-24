# 01 — Foundation and application structure

## Problem

There is no project, no quality pipeline, no enforced module boundaries and no agreed structure.

## Goal

A TypeScript + Fastify project with a working quality pipeline and a module structure derived from this spec. No database and no domain logic yet.

## Functional requirements

- FR-1: `GET /health` returns `200 { "status": "ok" }` without a database.
- FR-2: `GET /version` returns `{ "sha": "<sha>" }` from the `GIT_SHA` env variable read at startup, or `"unknown"` if unset. `GIT_SHA` is set by CI and by `npm start` (a Node launcher, `scripts/start.mjs`, that runs `git rev-parse --short=7 HEAD`). The launcher keeps an existing `GIT_SHA` and, if `git rev-parse` fails, leaves it unset and still starts the server.

## Non-functional requirements

- NFR-1: Code and Markdown are formatted (Prettier); code is linted (ESLint + typescript-eslint, warnings fail).
- NFR-2: Code type-checks with `tsc --noEmit` in strict mode.
- NFR-3: Git hooks block bad commits and pushes (see `standards/checks.md`).
- NFR-4: Module and layer rules from `docs/architecture.md#rules` are enforced by dependency-cruiser.
- NFR-5: CI runs `npm run check` on every PR with Node from `.nvmrc`; passing CI is required to merge into `main`.
- NFR-6: The project structure follows Design → Modules.

## Design

### Modules

`auth`, `users`, `movies`, `seats`, `showtimes`, `bookings` in `src/modules/`, plus `src/shared/` and `src/app/` (composition root, `/health`, `/version`).
Graph and rules: [`docs/architecture.md`](../docs/architecture.md). In Lab 1 a module is just `index.ts` with an empty `create<Name>Module` factory.

### Data (design only — bookings lab)

ER: [`docs/architecture.md#data`](../docs/architecture.md#data). All ids are UUID.

- `BookingSeat` PK is `(showtime_id, seat_id)`: a seat can't be booked twice for one showtime.
- All `BookingSeat` rows of a booking have the booking's showtime.
- An active booking (`RESERVED`) has at least one seat; a cancelled one has none. `PAID` comes with payments.

### Key update scenarios (design only — bookings lab)

1. **Book seats:** in one transaction, insert `Booking` (`RESERVED`), then a `BookingSeat` per seat. A second request for the same seat fails on the PK → `409`.
2. **Cancel booking:** in one transaction, set `Booking.status = CANCELLED` and delete its `BookingSeat` rows, freeing the seats.

## Acceptance criteria

- AC-1 (covers FR-1): `/health` returns `200 { "status": "ok" }` without `DATABASE_URL` — check: smoke test.
- AC-2 (covers FR-2): `/version` returns `GIT_SHA` or `"unknown"` — check: unit test for both cases; manually `npm run build && npm start`, then `curl /version` equals `git rev-parse --short=7 HEAD`.
- AC-3 (covers NFR-1, NFR-3): bad formatting or a lint warning blocks the commit — check: commit a misformatted file, then a file with an unused variable; the hook exits non-zero.
- AC-4 (covers NFR-2, NFR-3): a type error or implicit `any` blocks the push — check: push such a file.
- AC-5 (covers NFR-3): a bad commit message is rejected — check: `git commit -m "stuff"`.
- AC-6 (covers NFR-4): no violations, no cycles — check: `npm run deps:check`.
- AC-7 (covers NFR-4): forbidden imports fail — check: add each temporary import, (a) an `import type` from `showtimes/application/…` (not `index.ts`) in `bookings/application`, (b) an `import type` from `bookings/index.ts` in `movies/application`, (c) `domain → infrastructure`, (d) `shared → movies`, (e) `movies → app`, (f) `bookings/http → showtimes`, (g) a value (non-type) import of `showtimes` in `bookings/application`; `npm run deps:check` exits non-zero for each.
- AC-8 (covers NFR-5): CI blocks bad code — check: a PR with a lint error is red and can't be merged; the lab PR is green; the workflow uses `node-version-file: .nvmrc`.
- AC-9 (covers NFR-6): structure matches — check: `src/` has only `app/`, `shared/`, `modules/`; `modules/` has exactly the 6 modules, each with `index.ts` exporting `create<Name>Module`; `app` creates all 6 and the smoke test starts the app.

## Out of scope

- Database connection, Drizzle schema, functional tests (first DB lab).
- Domain logic; enforcing same showtime and "seat belongs to the showtime's hall" (bookings lab).
- Auth and roles (auth lab).
- Tariffs, payments, notifications, deployment.

## Open questions

- none
