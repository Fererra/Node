# Lab 3: test run evidence (AC-5, AC-6, AC-7, AC-8)

Run by hand in PowerShell on branch `lab3-testing`, 2026-11-20, with Docker Desktop running. Long outputs are shortened (`…`); kept lines are verbatim.

## AC-5a: two URLs naming the same database stop the run

Temporary `.env` (restored afterwards): `E2E_DATABASE_URL` points to the test database, with the host written as `127.0.0.1` instead of `localhost`.

```dotenv
TEST_DATABASE_URL=postgres://cinema:cinema@localhost:55432/cinema_test
E2E_DATABASE_URL=postgres://cinema:cinema@127.0.0.1:55432/cinema_test
```

```text
PS> npm run test:all; echo "exit: $LASTEXITCODE"

> cinema-booking-service@0.1.0 test:all
> node scripts/test-all.mjs

=== test:all: database URLs

=== test:all: failed: TEST_DATABASE_URL and E2E_DATABASE_URL name the same database: tests empty it, so every URL needs its own database
exit: 1
```

The run stops before Docker and before any test, so nothing can empty the wrong database. `localhost` and `127.0.0.1` are treated as the same host.

## AC-5b and AC-6: two runs in a row, with an old `.env`

My `.env` is from Lab 2: it has `DATABASE_URL` and `TEST_DATABASE_URL`, but no `E2E_DATABASE_URL`. The script takes the missing variable from `.env.example`.

```text
PS> npm run test:all; echo "exit: $LASTEXITCODE"
PS> npm run test:all; echo "exit: $LASTEXITCODE"

=== test:all: database URLs
DATABASE_URL: localhost:55432/cinema
TEST_DATABASE_URL: localhost:55432/cinema_test
E2E_DATABASE_URL: localhost:55432/cinema_e2e

=== test:all: PostgreSQL (Docker Compose)
 ✔ Container node-postgres-1 Healthy                             0.6s
database cinema_test exists
database cinema_e2e exists

=== test:all: npm run check (STORAGE=memory)
…
> test:unit
 Test Files  5 passed (5)
      Tests  37 passed (37)
 All files |     100 |      100 |     100 |     100 |
…
> test:coverage
 Test Files  24 passed (24)
      Tests  165 passed (165)
 All files |   97.77 |    95.23 |     100 |   98.71 |
…
=== test:all: npm run test:func (PostgreSQL)
 Test Files  8 passed (8)
      Tests  78 passed (78)

=== test:all: E2E: migrate and seed the E2E database with the built code
db:migrate: done
db:seed: done

=== test:all: E2E: start the server on port 3100
http://localhost:3100/health is up

=== test:all: npm run test:e2e
 ✓ test/e2e/booking.e2e.test.ts (5 tests)
     ✓ movies -> showtimes -> seats -> book -> taken -> my bookings -> cancel -> free
     ✓ 401 without X-User-Id, nothing booked
     ✓ 401 with an unknown user, nothing booked
     ✓ 409 when the seat is already taken
     ✓ a replay with the same key is 201 with the same booking; the key with another request is 422

E2E server stopped

=== test:all: passed
exit: 0
```

The second run gives the same result (`=== test:all: passed`, `exit: 0`): the E2E database is reset and reseeded on every run, so the first run's bookings don't affect the second.

Per run: 37 unit tests (100 % branches and functions for the FR-1 files), 165 in-memory tests (`bookings/application` 95.23 % branches), 78 integration tests on PostgreSQL, 5 E2E tests.

## AC-7: a failing test at each level fails the run

One test was broken at a time, `npm run test:all` was run, then port 3100 and PostgreSQL were checked and the test was restored with `git restore test/`. After each run `Get-NetTCPConnection -LocalPort 3100` printed nothing (the port is free).

### Unit (`test/unit/retry.test.ts`): wrong number of calls expected

```typescript
expect(operation).toHaveBeenCalledTimes(2); // was 1
```

```text
 FAIL  test/unit/retry.test.ts > withRetry > does not retry 23505 (unique violation) and rethrows it unchanged
AssertionError: expected "vi.fn()" to be called 2 times, but got 1 times
 ❯ test/unit/retry.test.ts:70:23

 Test Files  1 failed | 4 passed (5)
      Tests  1 failed | 36 passed (37)

=== test:all: failed: … npm-cli.js run check failed (exit code 1)
exit: 1

NAME              …   SERVICE    STATUS
node-postgres-1   …   postgres   Up 41 minutes (healthy)
```

The run stops at `check`: `test:func` and E2E don't start.

### Integration (`test/pg/query-counts.pg.test.ts`): wrong test data

```typescript
await moviesWithGenres(210); // was 20
```

```text
 FAIL  test/pg/query-counts.pg.test.ts > AC-12: the same query count for 1 and for many items > FR-1 GET /movies: 1 vs 20 movies
AssertionError: expected [ Array(210) ] to have a length of 20 but got 210
 ❯ test/pg/query-counts.pg.test.ts:58:35

 Test Files  1 failed | 7 passed (8)
      Tests  1 failed | 77 passed (78)

=== test:all: failed: … npm-cli.js run test:func failed (exit code 1)
exit: 1

NAME              …   SERVICE    STATUS
node-postgres-1   …   postgres   Up 43 minutes (healthy)
```

`check` passed; the run stops at `test:func`, before the E2E server is started.

### E2E (`test/e2e/booking.e2e.test.ts`): wrong status expected

```typescript
expect(created.status).toBe(200); // was 201
```

```text
 FAIL  test/e2e/booking.e2e.test.ts > E2E: booking through a running server > movies -> showtimes -> seats -> book -> taken -> my bookings -> cancel -> free
AssertionError: expected 201 to be 200 // Object.is equality
 ❯ test/e2e/booking.e2e.test.ts:32:28

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)

E2E server stopped

=== test:all: failed: … npm-cli.js run test:e2e failed (exit code 1)
exit: 1

NAME              …   SERVICE    STATUS
node-postgres-1   …   postgres   Up 47 minutes (healthy)
```

The E2E server was running when the test failed; it is stopped anyway (`E2E server stopped`), so port 3100 is free and the next run can start it again.

## AC-8: a higher break threshold fails the mutation run

Temporary change in `stryker.config.mjs` (reverted with `git restore`, which also restored the committed reports): `thresholds.break` from `80` to `90`.

```text
PS> npm run mutation
…
------------------------|--------|---------|----------|-----------|------------|----------|----------|
File                    |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
------------------------|--------|---------|----------|-----------|------------|----------|----------|
All files               |  85.34 |   86.09 |       95 |         4 |         16 |        1 |      116 |
…
20:32:59 (8040) ERROR MutationTestReportHelper Final mutation score 85.34 under breaking threshold 90, setting exit code to 1 (failure).
…
20:32:59 (8040) INFO MutationTestExecutor Done in 3 minutes and 31 seconds.
```

With the real threshold (`80`), the same score passes. The killed / timeout split (95 / 4 here, 98 / 1 in the committed report) varies between runs; the score and the survivors are the same.
