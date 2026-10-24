# Checks

| Check                      | Tool                                                        | pre-commit   | commit-msg | pre-push | CI                    |
| -------------------------- | ----------------------------------------------------------- | ------------ | ---------- | -------- | --------------------- |
| format (code and Markdown) | `prettier --check`                                          | staged files |            |          | ✓                     |
| lint                       | ESLint + typescript-eslint, `--max-warnings 0`              | staged files |            |          | ✓                     |
| commit message             | commitlint, `@commitlint/config-conventional`               |              | ✓          |          |                       |
| types                      | `tsc --noEmit` (strict)                                     |              |            | ✓        | ✓                     |
| module boundaries          | dependency-cruiser, rules from `docs/architecture.md#rules` |              |            | ✓        | ✓                     |
| unit + smoke tests         | Vitest                                                      |              |            | ✓        | ✓                     |
| build                      | `tsc -p tsconfig.build.json`                                |              |            | ✓        | ✓                     |
| functional tests           | Vitest + `fastify.inject` + PostgreSQL                      |              |            |          | from the first DB lab |

Every hook blocks on failure (non-zero exit). Hooks and CI check and fail, they don't auto-fix.

Smoke test: the app starts without `DATABASE_URL`; `GET /health` returns `200 { "status": "ok" }`.

Markdown is formatted by Prettier like code. Docs written before the tooling existed are formatted once with `npm run format` in a separate commit.

## Why this split

- pre-commit: fast checks on staged files only (lint-staged). It should take a few seconds.
- pre-push: everything that doesn't need a database.
- CI: the full `npm run check`. Until the first DB lab it has no database and no functional tests; from then on it adds PostgreSQL as a service container and runs `test:func`.
- CI is the backstop: branch protection on `main` requires it, with no bypass for admins, so skipping hooks with `--no-verify` doesn't let bad code into `main`.

## Commands

- `npm run check` — everything CI runs
- `npm run check:fast` — what pre-push runs
- `npm run format:check` / `lint` / `typecheck` / `deps:check` / `test` / `build` — individual checks
- `npm run format` — writes formatting fixes; for manual use only, never in hooks or CI
- `npm run test:func` — added with the first DB lab

## Tools

- Hooks: husky + lint-staged
- CI: GitHub Actions on every PR, `node-version-file: .nvmrc` (`engines` matches it, e.g. `.nvmrc` = `22`, `engines` = `>=22 <23`)
