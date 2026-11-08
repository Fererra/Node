# Review of the DB stage

Reviewed the agent's 11 commits (`b940de0`…`4c758a9`) and its report in `ai/10-db-stage.md`. Analysis done together with Claude (chat); decisions and checks are mine.

## Discrepancies

### 1. `PostgresStorage` reaches `index.ts` through a re-export

- What: the type lives in `shared/db/database.ts`. Every module's `infrastructure` re-exports it, and `index.ts` imports it from there, because `index.ts` may not import `shared/db/`. The rule holds on paper, but `index.ts` depends on `shared/db` through a detour; `deps:check` can't see it.
- Evidence: `Select-String "PostgresStorage"` finds `export type { PostgresStorage } from '../../../shared/db/database.js'` in all five `infrastructure/drizzle-*.repository.ts` files and the import in all five `index.ts`.
- Why: the architecture didn't say how a module factory types its `storage` option.
- Fix (architecture): `index.ts` may `import type` from `shared/db/` to type the `storage` option; value imports stay forbidden. Then the re-exports are removed and dependency-cruiser allows only the type-only import.

### 2. README setup doesn't work with the new default storage

- What: `STORAGE` defaults to `postgres`, and the README's Getting started doesn't mention Docker, `.env`, migrations or the seed (AC-15).
- Why: my prompt forbade the agent to edit README.md, so it only proposed the text.
- Fix: I updated the README myself.

### 3. No N+1 to show in the audit

- What: the agent used batch ports from the start, so the history has no N+1 that "appeared and was fixed".
- Fix: I broke it on purpose and recorded it: `docs/evidence/lab2-n-plus-one.md` (6 -> 63 queries for 20 bookings, caught by AC-12).

## My own checks

- AC-14 by hand: DB stopped -> `503 SERVICE_UNAVAILABLE` with the FR-9 body; start without DB -> exit code 1: `docs/evidence/lab2-db-failure.md`.
- N+1 by hand: `docs/evidence/lab2-n-plus-one.md`.
- The `pg_sleep` trigger for AC-4 lives only in `test/support/fixtures.ts`, not in `drizzle/` migrations.
- All 11 agent commits have the `Co-Authored-By` trailer.
- `npm run check` and `npm run test:func` pass locally.

## Agent decisions I accept as they are

`buildApp` stays synchronous with the `SELECT now()` check in `onReady`; the transaction is a copy of the request context, typed `unknown` in `shared/context.ts`; 503 detection in `shared/db/errors.ts`, mapped by the global handler; query counting through `debug` logs; `COLLATE "C"` to match in-memory ordering; the deferrable FK as a hand-written migration (`drizzle/0001_…`); `db:migrate` / `db:seed` run from `dist/`; `test:func` refuses to run when `TEST_DATABASE_URL` equals `DATABASE_URL`; exact package versions.

## Notes

- AC-9 throws on the log line `booking created`; renaming that message would silently weaken the test.
- `npm audit`: 14 moderate advisories, all in dev tooling.
