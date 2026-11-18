# Checks

| Check                                    | Tool                                                                              | pre-commit   | commit-msg | pre-push | CI (`make test`) | By hand (`make mutation`) |
| ---------------------------------------- | --------------------------------------------------------------------------------- | ------------ | ---------- | -------- | ---------------- | ------------------------- |
| format (code and Markdown)               | `prettier --check`                                                                | staged files |            |          | ✓                |                           |
| lint                                     | ESLint + typescript-eslint, `--max-warnings 0`; no `try` in `http`, `application` | staged files |            |          | ✓                |                           |
| commit message                           | commitlint, `@commitlint/config-conventional`                                     |              | ✓          |          |                  |                           |
| types                                    | `tsc --noEmit` (strict)                                                           |              |            | ✓        | ✓                |                           |
| module boundaries                        | dependency-cruiser, rules from `docs/architecture.md#rules`                       |              |            | ✓        | ✓                |                           |
| unit, smoke and scenario tests (memory)  | Vitest + `fastify.inject`, `STORAGE=memory`                                       |              |            | ✓        | ✓                |                           |
| branch coverage                          | Vitest V8 coverage, thresholds from spec 03 NFR-1                                 |              |            |          | ✓                |                           |
| scenario and `*.pg.test.ts` (PostgreSQL) | Vitest + `fastify.inject`, `STORAGE=postgres`, `TEST_DATABASE_URL`                |              |            |          | ✓                |                           |
| E2E                                      | Vitest + `fetch` against a running server, `E2E_DATABASE_URL`                     |              |            |          | ✓                |                           |
| build                                    | `tsc -p tsconfig.build.json`                                                      |              |            | ✓        | ✓                |                           |
| mutation testing                         | Stryker (`@stryker-mutator/vitest-runner`), score threshold from spec 03 NFR-2    |              |            |          |                  | ✓                         |

Every hook and target blocks on failure (non-zero exit). Hooks and CI check and fail, they don't auto-fix.

Smoke test: the app starts with in-memory storage and without `DATABASE_URL`; `GET /health` returns `200 { "status": "ok" }`.

## Test levels

- Unit (`test/unit/`, `src/**/*.test.ts` without I/O): pure code. `bookings/domain`, `shared/retry.ts` and `shared/kernel/` are covered completely (100 % branches).
- In-memory scenarios (`test/scenarios/*.test.ts` with `STORAGE=memory`): the HTTP app through `fastify.inject`; each test creates a new `buildApp`.
- Integration (`test/scenarios/*.test.ts` and `*.pg.test.ts` with `STORAGE=postgres`): the same scenarios plus PostgreSQL-only tests (parallel requests, rollback, query counts). They run against a separate test database (`TEST_DATABASE_URL`), never the development one; one file at a time; the database is migrated once per run and reset and reseeded with `buildSeed(now)` before each test. `npm test` excludes `*.pg.test.ts`.
- E2E (`test/e2e/*.e2e.test.ts`): a real server process started with `STORAGE=postgres` on its own port and database (`E2E_DATABASE_URL`), called through `fetch`. The database is migrated and seeded before the run; tests don't share state with integration tests.
- Extra rows for size tests come from `test/support/fixtures.ts`. It lives in `test/`, outside `src/`, so dependency-cruiser doesn't check it (see `docs/architecture.md#rules`).
- Mutation testing: Stryker mutates `bookings/domain`, `bookings/application`, `shared/retry.ts` and `shared/kernel/` and runs the unit and in-memory tests against each mutant (no database). Reports go to `reports/mutation/` (HTML and JSON); survivors are classified in `docs/mutation.md`.

Markdown is formatted by Prettier like code. Docs written before the tooling existed are formatted once with `npm run format` in a separate commit.

## Why this split

- pre-commit: fast checks on staged files only (lint-staged). It should take a few seconds.
- pre-push: everything that doesn't need a database or Docker.
- CI: `make test`, the same command as locally, with PostgreSQL as a service container.
- By hand: `make mutation`, because every mutant reruns the tests and it takes minutes (ADR-0005). The last report is committed.
- CI is the backstop: branch protection on `main` requires it, with no bypass for admins, so skipping hooks with `--no-verify` doesn't let bad code into `main`.

## Commands

- `make test` (= `npm run test:all`) — starts PostgreSQL in Docker if needed, migrates and seeds the test and E2E databases, runs `npm run check` with coverage, `test:func`, starts the server and runs E2E tests, then stops the server
- `make mutation` (= `npm run mutation`) — Stryker run with the score threshold
- `npm run check` — everything except `test:func` and E2E
- `npm run check:fast` — what pre-push runs
- `npm run format:check` / `lint` / `typecheck` / `deps:check` / `test` / `build` — individual checks
- `npm run test:coverage` — unit and in-memory tests with coverage thresholds
- `npm run test:func` — tests against the PostgreSQL test database
- `npm run test:e2e` — E2E tests against a running server
- `npm run db:migrate` / `db:seed` — apply migrations, load `buildSeed(now)` into the development database
- `npm run format` — writes formatting fixes; for manual use only, never in hooks or CI

The `Makefile` only calls npm scripts, so everything also works without `make`.

## Tools

- Hooks: husky + lint-staged
- CI: GitHub Actions on every PR runs `make test`, `node-version-file: .nvmrc` (`engines` matches it, e.g. `.nvmrc` = `26`, `engines` = `>=26 <27`)
- Coverage: Vitest V8 provider
- Mutation testing: Stryker with the Vitest runner and the TypeScript checker
