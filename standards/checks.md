# Checks

| Check                                    | Tool                                                                              | pre-commit   | commit-msg | pre-push | CI  |
| ---------------------------------------- | --------------------------------------------------------------------------------- | ------------ | ---------- | -------- | --- |
| format (code and Markdown)               | `prettier --check`                                                                | staged files |            |          | ✓   |
| lint                                     | ESLint + typescript-eslint, `--max-warnings 0`; no `try` in `http`, `application` | staged files |            |          | ✓   |
| commit message                           | commitlint, `@commitlint/config-conventional`                                     |              | ✓          |          |     |
| types                                    | `tsc --noEmit` (strict)                                                           |              |            | ✓        | ✓   |
| module boundaries                        | dependency-cruiser, rules from `docs/architecture.md#rules`                       |              |            | ✓        | ✓   |
| unit, smoke and scenario tests (memory)  | Vitest + `fastify.inject`, `STORAGE=memory`                                       |              |            | ✓        | ✓   |
| scenario and `*.pg.test.ts` (PostgreSQL) | Vitest + `fastify.inject`, `STORAGE=postgres`, `TEST_DATABASE_URL`                |              |            |          | ✓   |
| build                                    | `tsc -p tsconfig.build.json`                                                      |              |            | ✓        | ✓   |

Every hook blocks on failure (non-zero exit). Hooks and CI check and fail, they don't auto-fix.

Smoke test: the app starts with in-memory storage and without `DATABASE_URL`; `GET /health` returns `200 { "status": "ok" }`.

Tests:

- `test/scenarios/*.test.ts`: one set of scenario tests, run on both storages.
- `*.pg.test.ts`: tests that need PostgreSQL (parallel requests, rollback, query counts). `npm test` excludes them.
- `npm test` runs unit, smoke and scenario tests with `STORAGE=memory`; each test creates a new `buildApp`.
- `npm run test:func` runs scenario tests and `*.pg.test.ts` with `STORAGE=postgres` against a separate test database (`TEST_DATABASE_URL`), never the development one; one file at a time; the database is migrated once per run and reset and reseeded with `buildSeed(now)` before each test.
- Extra rows for size tests come from `test/support/fixtures.ts`. It lives in `test/`, outside `src/`, so dependency-cruiser doesn't check it (see `docs/architecture.md#rules`).

Markdown is formatted by Prettier like code. Docs written before the tooling existed are formatted once with `npm run format` in a separate commit.

## Why this split

- pre-commit: fast checks on staged files only (lint-staged). It should take a few seconds.
- pre-push: everything that doesn't need a database.
- CI: `npm run check`, then `npm run test:func` with PostgreSQL as a service container.
- CI is the backstop: branch protection on `main` requires it, with no bypass for admins, so skipping hooks with `--no-verify` doesn't let bad code into `main`.

## Commands

- `npm run check` — everything except `test:func`
- `npm run check:fast` — what pre-push runs
- `npm run format:check` / `lint` / `typecheck` / `deps:check` / `test` / `build` — individual checks
- `npm run test:func` — tests against the PostgreSQL test database
- `npm run db:migrate` / `db:seed` — apply migrations, load `buildSeed(now)` into the development database
- `npm run format` — writes formatting fixes; for manual use only, never in hooks or CI

## Tools

- Hooks: husky + lint-staged
- CI: GitHub Actions on every PR, `node-version-file: .nvmrc` (`engines` matches it, e.g. `.nvmrc` = `26`, `engines` = `>=26 <27`)
