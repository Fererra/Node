# 01 — Foundation and application structure

## Problem
There is no project, no quality pipeline, no enforced module boundaries and no agreed structure.

## Goal
A TypeScript + Fastify project with a working quality pipeline and a module structure derived from this spec. No domain logic yet.

## Functional requirements
- FR-1: `GET /health` returns `200 { "status": "ok" }` without touching the database.
- FR-2: `GET /version` returns the git SHA of the running build.

## Non-functional requirements
- NFR-1: Code is formatted (Prettier) and linted (ESLint + typescript-eslint).
- NFR-2: Code type-checks with `tsc --noEmit` in strict mode.
- NFR-3: Git hooks block bad commits and pushes (see `standards/checks.md`).
- NFR-4: Module boundaries are enforced by dependency-cruiser.
- NFR-5: CI runs `npm run check` on every PR.

## Design

### Modules
`auth`, `users`, `movies`, `seats`, `showtimes`, `bookings` in `src/modules/`, plus `src/shared/`.
Dependency graph: [`docs/architecture.md#modules`](../docs/architecture.md#modules).

- A module is used by others only through its `index.ts`.
- Only the dependencies shown in the graph are allowed; everything else is forbidden.
- Inside a module: `http` and `infrastructure` depend on `application`; `application` depends on `domain`; `domain` depends on nothing. `application` defines ports in `application/ports/`.
- `shared` depends on no module.

### Data
ER diagram: [`docs/architecture.md#data`](../docs/architecture.md#data). All ids are UUID.

- `BookingSeat` primary key is `(showtime_id, seat_id)`, so one seat can't be booked twice for one showtime.
- All `BookingSeat` rows of a booking have the same showtime as the booking.
- An active booking has at least one seat; a cancelled booking has none.

### Key update scenarios
1. **Book seats:** in one transaction, insert `Booking` (`status = RESERVED`), then one `BookingSeat` per seat. If two requests book the same seat, the primary key makes the second one fail → `409`.
2. **Cancel booking:** in one transaction, set `Booking.status = CANCELLED` and delete its `BookingSeat` rows, so the seats are free again.

## Acceptance criteria
- AC-1 (FR-1): `/health` returns 200 — check: smoke test.
- AC-2 (FR-2): `/version` returns current SHA — check: `curl /version` = `git rev-parse --short HEAD`.
- AC-3 (NFR-1, NFR-3): commit with a lint error is rejected — check: commit a file with an unused variable.
- AC-4 (NFR-2, NFR-3): push with a type error is rejected — check: push a type error.
- AC-5 (NFR-3): bad commit message is rejected — check: `git commit -m "stuff"`.
- AC-6 (NFR-4): `npm run deps:check` reports 0 violations and 0 cycles.
- AC-7 (NFR-4): importing another module's internal file fails `deps:check` — check: add such an import.
- AC-8 (NFR-5): CI is green on the lab PR.

## Out of scope
- Domain logic and DB schema implementation (next labs).
- Auth (next labs).
- Payments, notifications, deployment.

## Open questions
- none