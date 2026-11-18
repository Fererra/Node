# 03 — Testing: unit, integration, E2E and mutation testing

## Problem

The app has scenario tests on two storages, but nobody knows how good they are: branch coverage isn't measured, there are no end-to-end tests against a running server, running everything takes several manual steps, and green tests may still miss real bugs.

## Goal

All test levels exist and run with one command; branch coverage of the critical logic is measured; mutation testing shows which tests are weak, and the weakest are strengthened.

## Functional requirements

- FR-1: Unit tests cover every case of `bookings/domain`, `shared/retry.ts` and `shared/kernel/` without I/O.
- FR-2: Integration tests run the HTTP app (`fastify.inject`) with PostgreSQL (existing `test:func`).
- FR-3: E2E tests run against a real server process on a real port, with PostgreSQL in Docker, through `fetch`: the full user path (movies -> showtimes -> seats -> book -> my bookings -> cancel) plus `401`, `409` and replay with the same `Idempotency-Key`.
- FR-4: `make test` starts PostgreSQL in Docker, migrates and seeds the test database, runs unit and in-memory tests, integration tests, starts the server and runs E2E tests, then stops the server. Exit code is non-zero if anything fails.
- FR-5: `make mutation` runs Stryker on `bookings/domain`, `bookings/application`, `shared/retry.ts` and `shared/kernel/` and writes an HTML and JSON report to `reports/mutation/`.
- FR-6: Every surviving mutant is classified in `docs/mutation.md` as a real gap, equivalent or acceptable, with a reason.

## Non-functional requirements

- NFR-1: Branch coverage (V8): 100 % for the FR-1 files; ≥ 90 % for `bookings/application`. A drop below fails `make test`.
- NFR-2: Mutation score ≥ 80 % on the FR-5 files after the fixes; below that `make mutation` fails.
- NFR-3: E2E tests use their own database and port, never the development ones; they don't share state with integration tests.
- NFR-4: CI runs `make test` on every PR. `make mutation` runs by hand (too slow for every PR); its last report is committed.
- NFR-5: The `Makefile` only calls npm scripts, so everything also works without `make` (`npm run test:all`, `npm run mutation`).

## Design

Test levels, tools and the Stryker setup: ADR-0005. Test layout: `test/unit/`, `test/scenarios/`, `test/pg/`, `test/e2e/`; conventions in `standards/checks.md`.

## Acceptance criteria

- AC-1 (covers FR-1, NFR-1): coverage report shows 100 % branches for the FR-1 files — check: `make test` output.
- AC-2 (covers FR-2): `test:func` passes — check: `make test`.
- AC-3 (covers FR-3, NFR-3): E2E tests pass against a server started on its own port and database — check: `make test`; the server log shows real HTTP requests.
- AC-4 (covers FR-4): one command on a clean checkout with Docker running brings everything up and runs all tests — check: `make test` from scratch; CI log.
- AC-5 (covers FR-4): a failing test at any level fails `make test` — check: break one unit, one integration and one E2E test on purpose.
- AC-6 (covers FR-5, NFR-2): Stryker report exists with the score ≥ 80 % — check: `make mutation`, `reports/mutation/`.
- AC-7 (covers FR-6): every survivor is classified with a reason — check: `docs/mutation.md` against the JSON report.
- AC-8 (covers FR-6): the top-3 real gaps are fixed by strengthening tests: each mutant survives before and is killed after — check: two Stryker runs, commits in `docs/mutation.md`.
- AC-9 (covers NFR-4): CI runs `make test` — check: CI run link.

## Out of scope

- Mutation testing of `shared/db/`, `shared/context.ts`, other modules and `http` layers (covered by integration and E2E tests).
- Load and performance testing.
- New features.

## Open questions

- none
