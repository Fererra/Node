# 10 — DB stage (Lab 2)

## Prompt

> Implement stage 2 of specs/02-working-app.md: replace in-memory storage with PostgreSQL behind the same ports. Stage 1 is tagged lab2-in-memory. Read the spec, docs/api.md, docs/architecture.md, adr/ (especially 0003 and 0004), standards/ and ai/09-in-memory-review.md first.
>
> Scope:
>
> - Docker Compose with PostgreSQL on a non-default port; DATABASE_URL for development, TEST_DATABASE_URL for tests (a separate database).
> - Drizzle schema in src/shared/db/schema/, one file per owning module, as in docs/architecture.md#data; migrations in drizzle/. The FK idempotency_key.booking_id must be DEFERRABLE INITIALLY DEFERRED; if Drizzle can't express it, add a hand-written SQL migration and tell me.
> - Pool created once in src/app/; with STORAGE=postgres the app runs SELECT now() on start and exits if the database is unavailable (buildApp may become async, or use onReady).
> - UnitOfWork in src/shared/db/: transaction at READ COMMITTED stored in the request context; repositories use "transaction or pool"; withRetry with up to 3 attempts on 40001 / 40P01, then 503. Database unavailable during a request -> 503 SERVICE_UNAVAILABLE.
> - Drizzle repositories for every module, each querying only its own tables; cross-module data only through the existing ports (batch methods).
> - Booking as in docs/api.md#idempotency: claim the key with INSERT … ON CONFLICT DO NOTHING RETURNING -> checks -> booking -> booking_seat sorted by seat_id with ON CONFLICT DO NOTHING; detect conflicts by row counts, no try in application.
> - buildSeed(now) loaded into PostgreSQL by db:seed (CLI in src/app/cli/); db:migrate.
> - test:func: runs test/scenarios/ and \*.pg.test.ts with STORAGE=postgres on TEST_DATABASE_URL, one file at a time, reset and reseed before each test. test/support/fixtures.ts for size tests.
> - \*.pg.test.ts for AC-4 (parallel same seat; [a,b] vs [b,a] with no retry, seen through the attempt log), AC-5 parallel same key (both 201, same body), AC-9 (failure after the seats insert leaves nothing), AC-12 (query counts: FR-1, FR-3, FR-6 with 1 vs 20 items, FR-4 with 1 vs 10 seats).
> - dependency-cruiser rules for shared/db and for "a module's infrastructure imports only its own schema file".
> - CI: run test:func with a PostgreSQL service container after npm run check.
>
> Constraints:
>
> - Do not change the files in test/scenarios/: AC-1 requires them to pass unchanged on both storages. If one can't pass on PostgreSQL as written, stop and tell me.
> - Do not change specs/, docs/, adr/, standards/, ai/ or README.md. If something in them is wrong or impossible, stop and tell me.
> - Commit in small steps with Conventional Commits. Run npm run check before each commit, and npm run test:func once it exists.
> - Do not push and do not create tags.
>
> At the end, report for each AC how you verified it (AC-1 both storages, AC-4, AC-5 parallel, AC-9, AC-10, AC-12, AC-14, AC-15 and any AC whose behaviour changed). For AC-14, stop the database container and show the 503 and the failed start. Break things where an AC allows it (a temporary forbidden import, unsorted seat inserts, a non-deferred FK) and revert them. List decisions you made that the docs don't cover.

## Answer

Stage 2 is done: 11 commits on `lab2-working-app` (`b940de0`…`4c758a9`), nothing pushed, no tags created. `npm run check` passed before every commit (171 tests), and `npm run test:func` passes 78/78 on PostgreSQL. No file in `test/scenarios/`, `specs/`, `docs/`, `adr/`, `standards/`, `ai/` or `README.md` was changed.

### Three things you need to know

1. **The README setup no longer works as written (AC-15).** `STORAGE` now defaults to `postgres`, so the README's `npm run build && npm start` needs a database it never mentions. I didn't edit the README; here is the section it needs:
   ```bash
   cp .env.example .env
   docker compose up -d --wait
   npm run db:migrate && npm run db:seed
   npm run build && npm start
   ```
   I ran these steps and they work: `npm start` reads `.env`, and `/version` and `/movies` returned 200.
2. **Drizzle can't declare a deferrable foreign key.** Its `deferrable` option only exists for transactions. So `drizzle/0001_idempotency_key_fk_deferrable.sql` is hand-written: `ALTER CONSTRAINT … DEFERRABLE INITIALLY DEFERRED`. I checked in `pg_constraint` that it is the only deferred FK.
3. **The AC-14 evidence is not in `docs/evidence/`** because `docs/` was off-limits. The raw logs were saved in the session's scratchpad (`ac14-running.log`, `ac14-start.log`).

### How each AC was verified

| AC              | How                                                                                                                                                                                                                                                                                                                                                                            | Broken on purpose                                                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC-1**        | `npm test` on a checkout of `lab2-in-memory`: 155 passed. On HEAD, `npm test` passes and `test:func` runs `test/scenarios/` on PostgreSQL: 70/70. `git diff lab2-in-memory -- test/scenarios` is empty.                                                                                                                                                                        | —                                                                                                                                                                                                                                   |
| **AC-4**        | `test/pg/concurrency.pg.test.ts`: 5 parallel bookings of one seat give one 201 and four 409, with one row each. `[a,b]` vs `[b,a]` gives 201 + 409, and the `withRetry` log shows `attempt` `[1]` for each request. A test-only trigger (`pg_sleep(0.3)` per `booking_seat` row) makes the two seat inserts overlap; without it a wrong lock order would rarely show.          | I inserted seats in request order. The requests deadlocked, one was retried, and the test failed with `expected [1, 2] to deeply equal [1]`. Reverted. 5 repeat runs of the correct version all passed.                             |
| **AC-5**        | Scenario test plus a pg test: two parallel requests with one key both get 201 with the same body. The logs show one `booking created` and one `booking replayed`, and there is 1 booking, 1 key, 2 seats.                                                                                                                                                                      | —                                                                                                                                                                                                                                   |
| **AC-9**        | `rollback.pg.test.ts`: the log stream throws on `booking created`, which happens right after the seats insert, still inside `uow.run`. Result: 500, zero rows in `booking`, `booking_seat` and `idempotency_key`, and the same key then books with 201.                                                                                                                        | I made `save()` write through the pool instead of the transaction. Booking and seat rows survived and the test failed. Reverted.                                                                                                    |
| **Deferred FK** | —                                                                                                                                                                                                                                                                                                                                                                              | I changed the migration to `NOT DEFERRABLE`. 31 tests failed: every booking returned 500 because the key claim violated the FK. Reverted, back to 78/78.                                                                            |
| **AC-10**       | `deps:check` with 4 new rules: `drizzle-orm`/`pg` only in infrastructure and `shared/db/`; `pg` only in `shared/db/`; `shared/db/` imported only from infrastructure and `src/app/`; infrastructure imports only its own schema file.                                                                                                                                          | I added temporary files importing another module's schema, `schema/index.ts`, `drizzle-orm` in `application` and in `app`, `pg` in infrastructure, and `shared/db` in `application`. `deps:check` reported 9 errors. Files deleted. |
| **AC-12**       | `query-counts.pg.test.ts` with rows from `test/support/fixtures.ts`. Each endpoint runs the same number of queries for both sizes, and the tests also pin the numbers: FR-1 = 1, FR-3 = 5, FR-6 = 6, FR-4 = 10 (BEGIN and COMMIT included).                                                                                                                                    | —                                                                                                                                                                                                                                   |
| **AC-14**       | With the app running, I stopped the container: `GET /movies` and `POST /bookings` returned 503 `SERVICE_UNAVAILABLE` with the request id. Starting with the DB down: fatal log line `the app failed to start` (`ECONNREFUSED`), exit code 1. The running app recovered (200) once the DB was back. Also covered by unit tests (startup failure, 503 mapping, error detection). | —                                                                                                                                                                                                                                   |
| **AC-15**       | Compose uses host port **55432**. CI runs `npm run test:func` after `npm run check`, with a `postgres:18.1-alpine` service container.                                                                                                                                                                                                                                          | The CI run link has to come from you after you push. The README gap is above.                                                                                                                                                       |
| **AC-11**       | Unchanged; the existing `withRetry` unit tests still pass.                                                                                                                                                                                                                                                                                                                     | —                                                                                                                                                                                                                                   |

Changed behaviour: the old test "buildApp refuses postgres" now checks that `postgres` without a database URL is refused and that startup fails when the database is unreachable.

### Decisions the docs don't cover

- **`buildApp` stays synchronous.** It takes a new `databaseUrl` option. The `SELECT now()` check runs in an `onReady` hook and the pool closes in `onClose`. `main.ts` exits with code 1 if `listen` fails.
- **The transaction is a new context.** `uow.run` runs `work` in a copy of the request context with `transaction` added, rather than mutating the request's context. The field is typed `unknown` in `shared/context.ts` so that file stays free of the ORM.
- **503 mapping lives in the global error handler.** It uses `isDatabaseUnavailableError` from `shared/db/errors.ts`, which checks socket error codes, SQLSTATE class `08`, `57P0x`, `53300` and pg's own messages, following `cause` chains.
- **Query counting uses the logs.** Every query is logged at `debug` as `db query` with the request id, and the AC-12 tests count those lines.
- **`PostgresStorage` type.** It is defined in `shared/db/database.ts` and re-exported through each module's infrastructure, because `index.ts` may not import `shared/db/`.
- **Seed code is split.** `src/shared/db/seed.ts` does the truncate and insert; `src/app/db-seed.ts` maps the `buildSeed` rows onto it. `db:seed` replaces all data in the dev DB, bookings included.
- **Text order matches memory.** The database collation is `en_US.utf8`, so movie titles and genre names are ordered with `COLLATE "C"` to match `compareText`.
- **Tests and CLIs.**
  - `db:migrate` and `db:seed` run `npm run build` first and execute from `dist/`; I didn't add `tsx`.
  - `test:func` rebuilds the test DB once per run (drop schemas, then migrate). It refuses to run if `TEST_DATABASE_URL` equals `DATABASE_URL`.
  - `drizzle/meta/` is added to `.prettierignore`.
- **Packages** are pinned exactly: `drizzle-orm` 0.45.4, `pg` 8.23.1, `drizzle-kit` 0.31.11, `@types/pg` 8.23.1. `npm audit` lists 14 moderate advisories, all in dev tooling (typescript-eslint and drizzle-kit's esbuild).

Your local `.env` (gitignored, copied from `.env.example`) and the Postgres container are still in place and running.
