# 03 — Testing: unit, integration, E2E and mutation testing

## Problem

The app has scenario tests on two storages, but nobody knows how good they are: branch coverage isn't measured, there are no end-to-end tests against a running server, running everything takes several manual steps, and green tests may still miss real bugs.

## Goal

All test levels exist and run with one command; branch coverage of the critical logic is measured; mutation testing shows which tests are weak, and the weakest are strengthened.

## Functional requirements

- FR-1: Unit tests (`test/unit/`, no I/O) cover `bookings/domain`, `shared/retry.ts` and `shared/kernel/`: every exported function has a test, and every branch is covered by unit tests alone.
- FR-2: Integration tests run the HTTP app through `fastify.inject` on PostgreSQL (`test:func`: `test/scenarios/`, `test/pg/`).
- FR-3: E2E tests (`test/e2e/`) call a real server process (built `dist/`, `STORAGE=postgres`, port 3100, E2E database) only through `fetch`: movies -> showtimes -> seats -> book -> seat `taken` -> my bookings -> cancel -> seat free; plus `401`, `409`, replay `201` and reused key `422`.
- FR-4: After `npm ci`, `make test` (= `npm run test:all`, `scripts/test-all.mjs`) ensures PostgreSQL in Docker Compose is up and the test and E2E databases exist, runs `check` with `STORAGE=memory`, `test:func`, then migrates and seeds the E2E database with the code built by `check`, starts the server, waits for `/health`, runs E2E tests and always stops the server. It stops at the first failing step with a non-zero exit code. It takes each database URL from `.env`, or from `.env.example` when `.env` or that variable is missing.
- FR-5: `make mutation` (= `npm run mutation`) runs Stryker on `bookings/domain`, `bookings/application`, `shared/retry.ts` and `shared/kernel/` with the unit and in-memory tests, and writes `reports/mutation/mutation.html` and `mutation.json`.
- FR-6: Every surviving mutant is classified in `docs/mutation.md` as a real gap, equivalent or acceptable, with a reason.
- FR-7: Tests are strengthened for the top-3 real gaps (by risk to booking correctness; all of them if there are fewer than 3). The report before the fixes is kept as `reports/mutation/before.json`.

## Non-functional requirements

- NFR-1: Branch and function coverage (V8): 100 % per file for the FR-1 files only, from a unit-only run (`test:unit`, only `test/unit/`); ≥ 90 % branches in total for `bookings/application` from the in-memory run (`test:coverage`). Below a threshold, the run fails.
- NFR-2: Stryker's total mutation score ≥ 80 % on the FR-5 files after FR-7; below it `make mutation` fails. No `// Stryker disable` comments, no `mutator.excludedMutations` and no ignorers in the Stryker config.
- NFR-3: E2E uses its own database (`E2E_DATABASE_URL`) and port, reset and reseeded once per run; tests use different seats, and only one test reads `GET /me/bookings`, with its own user, so their order doesn't matter. The run refuses to start if any two of `DATABASE_URL`, `TEST_DATABASE_URL`, `E2E_DATABASE_URL` name the same database.
- NFR-4: CI runs `make test` with Docker Compose, like local runs. `make mutation` runs by hand; its last report is committed.
- NFR-5: The `Makefile` only calls npm scripts; `npm run test:all` and `npm run mutation` work on Windows without `make`.

## Design

Test levels, tools and the Stryker setup: ADR-0005. Test layout, test sets per command and environment variables: `standards/checks.md`.

## Acceptance criteria

- AC-1 (covers FR-1, NFR-1): 100 % branches and functions per FR-1 file in the unit-only run; unit tests import nothing that does I/O (`shared/db/`, `node:fs`, `node:net`) — check: `npm run test:unit` coverage, skipping one test fails the threshold; review of `test/unit/` imports.
- AC-2 (covers NFR-1): `bookings/application` ≥ 90 % branches in total in the in-memory run — check: coverage output; skipping a test below the threshold fails it.
- AC-3 (covers FR-2): `test:func` passes — check: `make test`.
- AC-4 (covers FR-3): E2E passes; `test/e2e/` imports nothing from `src/` or `test/support/` — check: `make test`; a temporary import fails ESLint.
- AC-5 (covers NFR-3): URLs naming the same database stop the run; two runs in a row both pass — check: by hand, `docs/evidence/`.
- AC-6 (covers FR-4, NFR-4): after `npm ci`, `make test` passes with Docker running, locally and in CI, also without `.env`, with an old `.env` without `E2E_DATABASE_URL`, and with an existing volume that lacks the test and E2E databases — check: CI run link, by hand.
- AC-7 (covers FR-4): breaking one unit, one integration and one E2E test, one at a time, fails `make test` each time; afterwards port 3100 is free and PostgreSQL is still up — check: `docs/evidence/`.
- AC-8 (covers FR-5, NFR-2, NFR-4): `make mutation` writes both reports with a score ≥ 80 %; a higher break threshold fails it; the committed `mutation.json` is from the last run — check: by hand, `reports/mutation/`.
- AC-9 (covers FR-6, NFR-2): every survivor in `mutation.json` is classified in `docs/mutation.md`; no `Stryker disable` in `src/`, no `excludedMutations` or ignorers in the Stryker config — check: compare the report; search; review of the config.
- AC-10 (covers FR-7): each top-3 mutant survives in `before.json` and is killed in `mutation.json`, matched by file, location and mutator — check: `docs/mutation.md` with commit hashes.
- AC-11 (covers NFR-5): `npm run test:all` passes on Windows without `make`; the `Makefile` only calls npm scripts — check: by hand; review of the `Makefile`.

## Out of scope

- Mutation testing of `shared/db/`, `shared/context.ts`, other modules and `http` layers (covered by integration and E2E tests).
- Load and performance testing.
- New features.

## Open questions

- none
