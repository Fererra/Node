# Checks

| Check                                    | Tool                                                                               | pre-commit   | commit-msg | pre-push | CI (`make test`) | By hand (`make mutation`) |
| ---------------------------------------- | ---------------------------------------------------------------------------------- | ------------ | ---------- | -------- | ---------------- | ------------------------- |
| format (code and Markdown)               | `prettier --check`                                                                 | staged files |            |          | ✓                |                           |
| lint                                     | ESLint + typescript-eslint, `--max-warnings 0`; no `try` in `http`, `application`  | staged files |            |          | ✓                |                           |
| commit message                           | commitlint, `@commitlint/config-conventional`                                      |              | ✓          |          |                  |                           |
| types                                    | `tsc --noEmit` (strict)                                                            |              |            | ✓        | ✓                |                           |
| module boundaries                        | dependency-cruiser, rules from `docs/architecture.md#rules`                        |              |            | ✓        | ✓                |                           |
| unit, smoke and in-memory app tests      | Vitest + `fastify.inject`, `STORAGE=memory`                                        |              |            | ✓        | ✓                |                           |
| branch and function coverage             | Vitest V8 coverage, thresholds from spec 03 NFR-1 (unit-only and in-memory runs)   |              |            |          | ✓                |                           |
| scenario and `*.pg.test.ts` (PostgreSQL) | Vitest + `fastify.inject`, `STORAGE=postgres`, `TEST_DATABASE_URL`, Docker Compose |              |            |          | ✓                |                           |
| E2E                                      | Vitest + `fetch` against a running server, `E2E_DATABASE_URL`, Docker Compose      |              |            |          | ✓                |                           |
| build                                    | `tsc -p tsconfig.build.json`                                                       |              |            | ✓        | ✓                |                           |
| mutation testing                         | Stryker (`@stryker-mutator/vitest-runner`), score threshold from spec 03 NFR-2     |              |            |          |                  | ✓                         |

Every hook and target blocks on failure (non-zero exit). Hooks and CI check and fail, they don't auto-fix.

Smoke test: the app starts with in-memory storage and without `DATABASE_URL`; `GET /health` returns `200 { "status": "ok" }`.

## Test levels

- Unit (`test/unit/` only): pure code without I/O. `bookings/domain`, `shared/retry.ts` and `shared/kernel/` are covered completely: 100 % branches and functions per file in the unit-only run (`npm run test:unit`). The coverage `include` of this run lists only these files, so files they import (e.g. `shared/errors.ts`) don't count.
- In-memory app tests (`src/**/*.test.ts`, `scripts/*.test.mjs`, `test/scenarios/*.test.ts` and `test/app/`, all with `STORAGE=memory`): the HTTP app through `fastify.inject`, each test with a new `buildApp`; unit tests outside the FR-1 scope may stay in `src/` and run here. Coverage of `bookings/application` (≥ 90 % branches in total) comes from this run (`npm run test:coverage`).
- Integration (`test/scenarios/*.test.ts` and `test/pg/*.pg.test.ts` with `STORAGE=postgres`): against a separate test database (`TEST_DATABASE_URL`), never the development one; one file at a time; the database is migrated once per run and reset and reseeded with `buildSeed(now)` before each test.
- E2E (`test/e2e/*.e2e.test.ts`): a real server process (built `dist/`, `STORAGE=postgres`, port 3100) on its own database (`E2E_DATABASE_URL`), reset and reseeded once per run. Tests use only `fetch` and import nothing from `src/` or `test/support/` (ESLint `no-restricted-imports`); user ids come from `test/e2e/seed-ids.ts`, because fixed seed UUIDs are part of the seed contract, and a test in `test/app/` checks that they match `src/app/seed.ts`. Tests use different seats; only the full-path test reads `GET /me/bookings`, with its own user; so their order doesn't matter.
- Test sets per command: `npm test`, `test:coverage` and Stryker exclude `*.pg.test.ts` and `*.e2e.test.ts`; `test:func` runs `test/scenarios/` and `*.pg.test.ts`; `test:e2e` runs only `*.e2e.test.ts`. Stryker uses `vitest.config.ts`, the `npm test` set.
- Environment: `scripts/test-all.mjs` takes only the database URLs, each from `.env` or, when `.env` or that variable is missing, from `.env.example`, and forces `STORAGE=memory` for the `check` step. The code is built once, by `check`; the E2E step runs the built migrate and seed CLIs directly. For E2E, the server and these CLIs get `DATABASE_URL=$E2E_DATABASE_URL`; the server also gets `PORT=3100` and `STORAGE=postgres`. The run refuses to start if any two of `DATABASE_URL`, `TEST_DATABASE_URL`, `E2E_DATABASE_URL` name the same database; missing databases are created by the script. PostgreSQL stays up after the run.
- Extra rows for size tests come from `test/support/fixtures.ts`, outside `src/`, so dependency-cruiser doesn't check it.
- Mutation testing: Stryker mutates `bookings/domain`, `bookings/application`, `shared/retry.ts` and `shared/kernel/` and runs the `npm test` set. Reports: `reports/mutation/mutation.html` and `mutation.json`; the report before test fixes is kept as `before.json`. No `// Stryker disable` comments, no `mutator.excludedMutations` and no ignorers in the Stryker config (`ignorePatterns` for generated folders is allowed). Survivors are classified in `docs/mutation.md`. Mutant ids change between runs, so `before.json` and `mutation.json` are compared by file, location and mutator. `reports/` is in `.prettierignore`; `.stryker-tmp/` is in `.gitignore`; both are ignored by ESLint.

Markdown is formatted by Prettier like code. Docs written before the tooling existed are formatted once with `npm run format` in a separate commit.

## Why this split

- pre-commit: fast checks on staged files only (lint-staged). It should take a few seconds.
- pre-push: everything that doesn't need a database or Docker.
- CI: `make test`, the same command as locally, with PostgreSQL from Docker Compose.
- By hand: `make mutation`, because every mutant reruns the tests and it takes minutes (ADR-0005). The last report is committed.
- CI is the backstop: branch protection on `main` requires it, with no bypass for admins, so skipping hooks with `--no-verify` doesn't let bad code into `main`.

## Commands

- `make test` (= `npm run test:all`, `scripts/test-all.mjs`) — after `npm ci`: ensures PostgreSQL in Docker Compose and the test and E2E databases, runs `npm run check` with `STORAGE=memory` (it also builds), `test:func`, then migrates and seeds the E2E database with the built code, starts the server, runs E2E tests and always stops the server; stops at the first failing step; takes each database URL from `.env` or `.env.example`
- `make mutation` (= `npm run mutation`) — Stryker run with the score threshold
- `npm run check` — format, lint, typecheck, deps, `test:unit`, `test:coverage`, build (everything except `test:func` and E2E)
- `npm run check:fast` — what pre-push runs: typecheck, deps, plain `npm test`, build
- `npm run format:check` / `lint` / `typecheck` / `deps:check` / `test` / `build` — individual checks
- `npm run test:unit` — unit tests (`test/unit/` only) with the per-file 100 % thresholds for the FR-1 files
- `npm run test:coverage` — all other in-memory tests with the `bookings/application` threshold
- `npm run test:func` — tests against the PostgreSQL test database
- `npm run test:e2e` — E2E tests against a running server
- `npm run db:migrate` / `db:seed` — apply migrations, load `buildSeed(now)` into the database in `DATABASE_URL`
- `npm run format` — writes formatting fixes; for manual use only, never in hooks or CI

The `Makefile` only calls npm scripts, so everything also works without `make`.

## Tools

- Hooks: husky + lint-staged
- CI: GitHub Actions on every PR runs `make test` with Docker Compose, `node-version-file: .nvmrc` (`engines` matches it, e.g. `.nvmrc` = `26`, `engines` = `>=26 <27`)
- Coverage: Vitest V8 provider
- Mutation testing: Stryker with the Vitest runner and the TypeScript checker
