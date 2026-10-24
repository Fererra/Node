# Checks

| Check | Tool | pre-commit | commit-msg | pre-push | CI |
|---|---|---|---|---|---|
| format | Prettier | staged files | | | ✓ |
| lint | ESLint + typescript-eslint | staged files | | | ✓ |
| commit message | commitlint (Conventional Commits) | | ✓ | | |
| types | `tsc --noEmit` | | | ✓ | ✓ |
| module boundaries | dependency-cruiser | | | ✓ | ✓ |
| unit tests | Vitest | | | ✓ | ✓ |
| smoke test | Vitest: app starts, `GET /health` → 200 | | | ✓ | ✓ |
| functional tests | Vitest + `fastify.inject` + PostgreSQL | | | | ✓ |
| build | `tsc -p tsconfig.build.json` | | | ✓ | ✓ |

Every hook blocks on failure (non-zero exit).

## Why this split
- pre-commit: only fast checks on staged files (lint-staged), must take a few seconds.
- pre-push: everything that doesn't need a database.
- CI: full `npm run check`, with PostgreSQL as a service container. Functional tests need a database, so they are not in hooks.

## Commands
- `npm run check` — everything, same as CI
- `npm run check:fast` — what pre-push runs
- `npm run lint` / `format` / `typecheck` / `deps:check` / `test:unit` / `test:func` / `build`

## Tools
- Hooks: husky + lint-staged
- CI: GitHub Actions, runs on every PR