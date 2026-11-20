# 14 — Testing implementation (Lab 3)

## Prompt

> Implement specs/03-testing.md, except FR-6 and FR-7 (classifying survivors and strengthening tests are my part). Read the spec, adr/0005-testing-strategy.md, standards/checks.md, docs/architecture.md and the current tests first.
>
> Scope:
>
> - Coverage with @vitest/coverage-v8 matching the installed Vitest version: test:unit (test/unit/ only, coverage include = the FR-1 files only, 100 % branches and functions per file) and test:coverage (all other in-memory tests, ≥ 90 % branches in total for bookings/application). Add the unit tests needed to reach 100 % for bookings/domain, shared/retry.ts and shared/kernel/; move src/shared/retry.test.ts to test/unit/.
> - Rename test/integration/ to test/app/.
> - Test sets per command as in standards/checks.md: npm test, test:coverage and Stryker exclude \*.pg.test.ts and \*.e2e.test.ts.
> - E2E in test/e2e/ (FR-3, NFR-3): only fetch to localhost:3100, user ids from test/e2e/seed-ids.ts, ESLint no-restricted-imports for src/ and test/support/, a test in test/app/ that seed-ids.ts matches src/app/seed.ts.
> - scripts/test-all.mjs (FR-4, NFR-3, NFR-5) and a Makefile with test and mutation targets that only call npm scripts. Environment handling exactly as in standards/checks.md#test-levels (per-variable fallback to .env.example, STORAGE=memory for check, one build, E2E env mapping, refuse equal database names, create missing databases, always stop the server). Must work on Windows without make.
> - Stryker (@stryker-mutator/core, vitest-runner, typescript-checker) per NFR-2 and checks.md: scope bookings/domain, bookings/application, shared/retry.ts, shared/kernel/; vitest.config.ts; reports to reports/mutation/ (HTML and JSON); break threshold 80; no disable comments, no excludedMutations, no ignorers. Ignores for reports/ and .stryker-tmp/ in Prettier, git and ESLint.
> - CI: replace the service container with Docker Compose and run make test.
>
> Then run make mutation once and keep the report: copy reports/mutation/mutation.json to reports/mutation/before.json and commit both reports. Don't strengthen tests to kill survivors beyond what FR-1 coverage needs, and don't write docs/mutation.md. If the score is below 80 %, that's expected at this point: keep the report and tell me.
>
> Constraints:
>
> - Do not change specs/, docs/, adr/, standards/, ai/ or README.md. Do not change test/scenarios/ (they must still pass on both storages). If something in the docs is wrong or impossible, stop and tell me.
> - Commit in small steps with Conventional Commits; run npm run check before each commit and make test (or npm run test:all) once it exists.
> - Do not push and do not create tags.
>
> At the end, report for each AC how you verified it (AC-1…AC-9, AC-11; AC-10 is after my fixes), the mutation score and the number of survivors per file, and decisions the docs don't cover. Break things where an AC allows it (skip a test under a threshold, a temporary forbidden import in test/e2e/, equal database URLs) and revert them.

## Answer

Everything in scope is done except FR-6 and FR-7, which are yours. There are 8 commits on `lab3-testing` (`918d11e`…`69945f5`), nothing pushed and no tags. The kept mutation score is **78.45 %**, below the 80 break threshold, so `npm run mutation` currently exits 1, as you expected. I didn't change `specs/`, `docs/`, `adr/`, `standards/`, `ai/`, `README.md` or `test/scenarios/`, and nothing in the docs turned out to be wrong or impossible.

### Mutation report (`reports/mutation/mutation.json` = `before.json`)

77 killed, 14 timeout, 22 survived, 3 no coverage, 116 compile errors. The TypeScript checker rejects compile-error mutants, so they don't count toward the score.

| File                                                                              | Survived | No coverage |
| --------------------------------------------------------------------------------- | -------- | ----------- |
| `bookings/application/bookings.service.ts`                                        | 16       | 3           |
| `shared/retry.ts`                                                                 | 6        | 0           |
| `bookings/application/errors.ts`, `bookings/domain/booking.ts`, `shared/kernel/*` | 0        | 0           |

Some survivors that look relevant to booking correctness:

- **Seat sort in `toDto`** (`bookings.service.ts:66–68`): the `.sort` is removed, and `-` becomes `+` in the comparator. Nothing fails, so no test checks the seat order of a multi-row booking.
- **Two conditions forced to `false`** (`bookings.service.ts:164` and `:219`). `164` also has no-coverage mutants, so those lines never run in memory.
- **Cause-chain depth limit** in `isRetryableError` (`retry.ts:15`): `<`/`<=`, the loop condition set to `true`, and `depth--`. V8 still reports 100 % branches for that file, because it doesn't count the `&&` there as a branch.
- **Probably equivalent**: string literals in log messages and errors (about 12 mutants).

Of the 14 timeouts, 7 are in `compare.ts`. The trial run on the same code gave 88 killed and 3 timeout, with the same 22 survivors and the same score. So Killed vs Timeout can vary between runs; keep that in mind when you match `before.json` to `mutation.json` for AC-10.

### How I verified each AC

There's no `make` on this machine, so I used the npm scripts (`test:all`, `mutation`) that the Makefile targets call.

- **AC-1**: `test:unit` shows 100 % branches and functions for all 5 FR-1 files. I skipped the `isRetryableError` false-cases test: `retry.ts` dropped to 91.66 % and the run exited 1. Reverted. A new ESLint rule blocks I/O imports in `test/unit/`; I checked it with a temporary `node:fs` and `../support/db.js` import, then removed it.
- **AC-2**: `bookings/application` has 92.85 % branches. With `--exclude test/scenarios/bookings.test.ts` it drops to 85.71 % and exits 1. I skipped tests by excluding a file from the command line so I didn't have to edit `test/scenarios/`.
- **AC-3 / AC-4**: `test:all` passes (78 `test:func` tests, 5 E2E). A temporary import of `src/app/seed.js` and `test/support/client.js` in an E2E test failed ESLint; reverted.
- **AC-5**: two `test:all` runs in a row both pass. Setting `E2E_DATABASE_URL` to the test database (spelled `127.0.0.1` instead of `localhost`) made the run refuse to start with exit 1; `.env` restored. Not yet written to `docs/evidence/`, since that folder was off limits.
- **AC-6**: passes locally in three cases:
  - Your current `.env`, which has no `E2E_DATABASE_URL`.
  - No `.env`, after I dropped `cinema_test` and `cinema_e2e`. The script recreated both; I never touched the dev `cinema` database.
  - PostgreSQL stopped beforehand; the script started it.

  **CI is not verified**: that needs a push and a PR run.

- **AC-7**: I broke one unit test, one integration test and one E2E test, one at a time. Each run failed at the right step with exit 1. Afterwards port 3100 was free and PostgreSQL was healthy, and each break was reverted. The integration break is in `test/pg/`, because `test/scenarios/` was off limits. Not yet written to `docs/evidence/`.
- **AC-8**: partly verified. Both reports are written, and the committed `mutation.json` is from the last run. A score ≥ 80 and "a higher break threshold fails it" can only be shown after your fixes; right now even 80 fails.
- **AC-9**: the config and search part is done: no `Stryker disable` in `src/`, `test/` or `scripts/`, and no `excludedMutations` or ignorers in `stryker.config.mjs`. The classification is FR-6, yours.
- **AC-11**: `test:all` and `mutation` work on Windows without `make`. The Makefile only calls `npm run test:all` and `npm run mutation`.

One process slip: I committed the CI change after only a `prettier --check`, not a full `npm run check`. That commit only touched YAML, and the full check plus `test:all` passed on later commits.

### Decisions the docs don't cover

- **Same database**: two URLs count as one database when host, port and name match. `localhost`, `127.0.0.1` and `[::1]` count as the same host, the port defaults to 5432, and a missing database name defaults to the user name. An empty variable in `.env` counts as missing and falls back to `.env.example`.
- **Where the URLs come from**: only `.env` and `.env.example`, never the shell environment. The script passes them to each step explicitly. This works because `vitest.func.config.ts`'s `loadEnvFile` doesn't overwrite variables that are already set; I checked that.
- **Creating missing databases**: done with `pg` through the server's `postgres` maintenance database. It retries the connection for up to 30 s while PostgreSQL starts. I also added `cinema_e2e` to `init.sql` and `E2E_DATABASE_URL` to `.env.example`.
- **The E2E server**:
  - It starts with `node scripts/start.mjs`, so `GIT_SHA` is set, with no `--env-file`.
  - The script refuses to start if port 3100 is already taken, so the health check can't pass against some other process.
  - The server's log is printed only if it fails to start.
  - It's stopped with SIGTERM, then SIGKILL after 10 s, and also on Ctrl+C.
- **E2E reset**: the database is migrated, then `db:seed` truncates and reseeds it. Alice is used only by the full-path test, Bob by the others. Each test uses its own seats on the first future Orbit Nine showtime.
- **Extra ESLint rules**: E2E tests also can't import `pg`, `drizzle-orm` or `fastify`. Unit tests can't import `shared/db`, `src/app`, `test/support`, `fs`, `net`, `child_process`, `http`, `pg`, `drizzle-orm` or `fastify`.
- **Script tests**: the environment helpers are in `scripts/test-env.mjs`, tested in `scripts/test-env.test.mjs`, so they run in the in-memory set.
- **Config details**: each test set has its own Vitest config, and coverage output goes to `coverage/unit` and `coverage/app`. The Stryker thresholds are high 90, low 80, break 80. Its `ignorePatterns` are `dist`, `coverage` and `reports`. I committed `mutation.html` along with the two JSON files.
- **New unit tests**: only `compare.test.ts` and `uuid.test.ts`, because those were the only files under 100 %.
