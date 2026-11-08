# 12 — Storage type fix (Lab 2)

## Prompt

> docs/architecture.md now allows index.ts to `import type` from shared/db/ (see "Module entry point"); value imports stay forbidden. Remove the `export type { PostgresStorage }` re-exports from every module's infrastructure and import the type in index.ts directly from shared/db/. Add a dependency-cruiser rule that allows only type-only imports from index.ts to shared/db/, and check it with a temporary value import that must fail. Do not change specs/, docs/, adr/, standards/, ai/, README.md or test/scenarios/. Run npm run check and npm run test:func, commit with Conventional Commits, don't push, and report how you verified it.

## Answer

I committed the change as `5cc9223 refactor(modules): import PostgresStorage type in index.ts from shared/db` and didn't push. `npm run check` and `npm run test:func` both pass.

### What changed

- I removed the `export type { PostgresStorage } from '../../../shared/db/database.js'` line from the drizzle repository in all five modules (bookings, movies, seats, showtimes, users).
- Each module's `index.ts` now uses `import type { PostgresStorage } from '../../shared/db/database.js'`. The Drizzle repository import went back to a plain value import.
- In `.dependency-cruiser.mjs`:
  - I added `const moduleIndex = '^src/modules/[^/]+/index\\.ts$'`.
  - The rule `shared-db-only-from-infrastructure-and-app` is renamed to `shared-db-only-from-infrastructure-app-and-index`, and its exceptions now include `moduleIndex`.
  - The new rule `index-only-type-imports-from-shared-db` blocks any import from a module's `index.ts` into `src/shared/db/` that isn't type-only.
- Nothing in specs/, docs/, adr/, standards/, ai/, README.md or test/scenarios/ changed.

### How I verified it

1. **Temporary violations.** I added each of these, ran `npm run deps:check`, and reverted it:
   - A value import `import { createDatabase } from '../../shared/db/database.js'` in `movies/index.ts` failed with `error index-only-type-imports-from-shared-db: src/modules/movies/index.ts → src/shared/db/database.ts`.
   - A mixed import `import { type DatabaseHandle, createDatabase }` in the same file failed with the same rule.
   - `import type` from `shared/db` in `movies/application/movies.service.ts` still failed with `shared-db-only-from-infrastructure-app-and-index`. So the new exception covers only `index.ts`, not other layers.
2. **Clean tree.** With no temporary imports, `deps:check` reports no violations (104 modules, 266 dependencies). A search confirmed `PostgresStorage` appears in `src/modules` only in the `index.ts` files.
3. **`npm run check`** exited 0: format, lint, typecheck, depcruise, 171/171 unit tests and build.
4. **`npm run test:func`** exited 0 with 78/78 tests across 8 files.
5. The commit hook (prettier and eslint on staged files) passed.

During step 1, reverting the first temporary import with `git checkout` also wiped my real edit to `movies/index.ts`. I noticed, re-applied it before steps 2–5, and the committed diff for that file is correct.
