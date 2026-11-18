# 13 — Testing spec review (Lab 3)

## Prompt

> Read specs/03-testing.md, adr/0005-testing-strategy.md, standards/ (especially checks.md), docs/architecture.md, the Makefile if it exists, package.json and the current tests in test/ and src/. This is the spec for Lab 3: unit, integration, E2E and mutation testing. Find contradictions between these files, unclear or unverifiable requirements, thresholds that can't be met or measured as written (check them against the current code and tests), and ACs that don't cover an FR/NFR. Ask me questions. Do not write code or change any files.

## Answer

I read the spec, ADR-0005, all four `standards/` files, `docs/architecture.md`, `package.json`, both vitest configs, `compose.yaml`, CI, the hooks, and every test and file in scope. There is no `Makefile` yet. As a baseline, `npx vitest run` passes: 24 files, 171 tests. I couldn't measure coverage because `@vitest/coverage-v8` isn't installed, and Stryker isn't installed either. So the threshold findings below come from reading the code by hand. I didn't change any files.

### 1. Contradictions

1. **How CI runs.** `standards/definition-of-done.md:7` says CI runs `npm run check` and `npm run test:func`, which is also what `.github/workflows/ci.yml` does. NFR-4 and `checks.md` say CI runs `make test`.
2. **Who starts PostgreSQL.** FR-4 says `make test` _starts_ PostgreSQL in Docker. `checks.md:36` says CI uses a _service container_, and `checks.md:42` says "starts … if needed". The CI service listens on 5432 and creates only `cinema_test`. Compose listens on 55432. Neither has an E2E database.
3. **Which databases get migrated and seeded.** FR-4 says "the test database" (one). `checks.md:42` says "the test and E2E databases". In practice, `test:func` already rebuilds the test database itself (`pg-global-setup.ts` drops the schema and migrates; `pg-setup.ts` reseeds before each test). So a separate migrate-and-seed step in `make test` for that database would do nothing.
4. **What `make test` runs.** FR-4 lists only test levels. `checks.md:42` says it also runs `npm run check` (format, lint, types, deps, build). It's also unclear whether `npm run check` enforces coverage. If it doesn't, a separate `test:coverage` step runs the memory tests a second time.
5. **Mutation scope.** FR-5 fixes the scope. ADR-0005 Consequences says mutants only PostgreSQL can kill are classified as acceptable _"or the scope is narrowed"_. Narrowing the scope would break FR-5.
6. **What "integration" means.** The spec uses it for PostgreSQL tests. But `test/integration/` already exists and holds in-memory tests (`internal-error`, `request-logs`) that use spies. The spec's layout list (Design) doesn't mention that folder.
7. **Where unit tests live.** The ADR and the spec's Design say `test/unit/`. `checks.md:23` also allows `src/**/*.test.ts`, and that's where `retry.test.ts` lives.

### 2. Thresholds that can't be met or measured as written

- **NFR-1, what the 100 % counts.** FR-1 says _unit_ tests cover these files. But the coverage run (`test:coverage`) is unit plus in-memory scenarios, so scenarios can fill gaps the unit tests leave. Should the 100 % come from unit tests only?
- **NFR-1, how it's applied.** Vitest glob thresholds are aggregated across the matched files unless you set `perFile`. "100 % for the FR-1 files" doesn't say which.
- **Current state, by reading the code:**
  - The `return 0` branch in `shared/kernel/compare.ts:8` doesn't look reachable by any current test, since nothing compares equal strings. So kernel is probably below 100 % today.
  - `domain/booking.ts` and `kernel/uuid.ts` have **zero branches**, so they're 100 % automatically. `isUuid` has no unit test at all. "Every case" (FR-1) can't be checked through branch coverage for these two files.
  - `retry.ts`: tests never pass a custom `isRetryable`. If Vitest 5's AST-aware V8 remapping counts default arguments as branches, the file is below 100 %.
  - `bookings/application`: the throw path of `required()` (`bookings.service.ts:52`) is never hit by memory tests. ≥ 90 % still looks reachable.
- **NFR-2, the score isn't defined.** Is it Stryker's _mutation score_ or _score based on covered code_? Do `// Stryker disable` mutants count? Disabled mutants drop out of the score and stop being survivors, so they'd also skip FR-6 classification. That's an easy way to game the threshold.
- **Likely survivors:**
  - log message strings and log field objects in the service and in `retry.ts`;
  - the `ServiceUnavailableError` message (the test checks only `code` and `cause`);
  - the `required()` guard and its message templates;
  - the `listMine` early `return []`, which behaves the same in memory and is caught only by the PostgreSQL query-count tests that Stryker doesn't run;
  - `depth < 5` changed to `<=`, which behaves the same.

  80 % looks possible, but nobody can know until the first run.

- **Tool support is unchecked.** Nobody has confirmed that `@stryker-mutator/vitest-runner` supports Vitest 5.0.5. `@vitest/coverage-v8` must match 5.0.5 exactly.

### 3. Requirements that are unclear or can't be checked

- **AC-3**, "the server log shows real HTTP requests": `fastify.inject` writes the same request log lines, so the log doesn't prove anything.
- **AC-4**, "clean checkout": on a clean checkout there's no `.env`, and `testDatabaseUrl()` throws without one. There's no `npm ci` step mentioned. `docker/postgres/init.sql` runs only when the volume is first created, so an existing `pgdata` volume never gets a new E2E database.
- **Windows:** `make` isn't installed on your machine. If the npm-script fallback (NFR-5) has to start and stop a background server, it must work on Windows.
- **FR-3:**
  - "replay with the same `Idempotency-Key`": only the 201 replay, or also the 422 for a reused key with a different body?
  - Must the path check that seats are free again after the cancel?
  - The E2E database is seeded once and every test changes it, so tests depend on order and reruns can behave differently.
- **FR-4:**
  - Is the server stopped when E2E tests _fail_?
  - Is PostgreSQL stopped afterwards?
  - Does the run stop at the first failing level? If it does, AC-5's "break one unit, one integration and one E2E test" only proves something if you break them one at a time.
- **E2E wiring:** `npm start` imports `dist/` (so it needs a build first) and reads `.env` through `--env-file-if-exists`. The server reads `DATABASE_URL`, not `E2E_DATABASE_URL`. Nothing stops `E2E_DATABASE_URL` from being the same as `TEST_DATABASE_URL`. If they match, `test:func`'s `drop schema public cascade` wipes the E2E database.
- **Committed report vs. format check:** `reports/` isn't in `.prettierignore`, so the committed Stryker HTML and JSON would fail `format:check` inside `make test`. `.stryker-tmp/` would also need to be ignored.
- **AC-8:**
  - "top-3" ranked by what?
  - What if there are fewer than 3 real gaps?
  - The "before" report gets overwritten by the second run.
  - Does "commits in `docs/mutation.md`" mean commit hashes?

### 4. ACs that don't fully cover an FR or NFR

| Requirement | Gap                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| **NFR-5**   | No AC at all.                                                                                                           |
| NFR-1       | AC-1 covers only the 100 % part. Nothing checks the ≥ 90 % for `bookings/application` or that a drop fails `make test`. |
| NFR-2       | AC-6 checks the score but not that `make mutation` fails below 80 %.                                                    |
| NFR-3       | Nothing checks "never the development ones" or "no shared state with integration tests".                                |
| NFR-4       | Nothing checks "its last report is committed".                                                                          |
| FR-1        | Nothing checks "without I/O".                                                                                           |
| FR-5        | Nothing checks the report formats or the `reports/mutation/` path, beyond the folder existing.                          |
| AC-8        | Fixing the gaps isn't an FR: FR-6 only asks to classify them. Only the Goal mentions fixing.                            |

### Questions

1. **CI and PostgreSQL:** should `make test` use the CI service container, or should CI run Docker Compose like your local setup? If the service container, who creates the E2E database there?
2. **What `make test` runs:** does it include format, lint, types, deps and build, as `checks.md` says? Should coverage replace the plain `npm test` run so tests don't run twice?
3. **The 100 % target:** unit tests only, or unit plus in-memory? Per file or aggregated? And for files with zero branches, is 100 % branch coverage enough for "every case", or should FR-1 name the cases?
4. **Mutation score:** total score or score based on covered code? Can equivalent mutants be disabled with `// Stryker disable` comments? If yes, should they still be listed in `docs/mutation.md`?
5. **Mutants only PostgreSQL can kill:** classify them as "acceptable" (keeping the FR-5 scope), or narrow the scope? I'd drop "or the scope is narrowed" from the ADR.
6. **E2E isolation:** reseed before each test file or before each test, or write tests that never collide (fresh seats each time)? And should the setup refuse to start if `E2E_DATABASE_URL` equals `DATABASE_URL` or `TEST_DATABASE_URL`?
7. **Proof that E2E is real (AC-3):** would something like "the test process checks the server's PID differs from its own" or "a request sent from outside, e.g. with `curl`, during the run" work for you, instead of reading the log?
8. **FR-3 replay:** only the 201 replay, or also the 422 for a reused key? Must the path end with "seat free again"?
9. **Failure behaviour:** stop at the first failing level, or run every level and report all of them? Is the server always stopped, and is PostgreSQL stopped too?
10. **Clean checkout:** may `make test` fall back to the `.env.example` values, and should it run `npm ci`? What happens with an existing `pgdata` volume that doesn't have the E2E database?
11. **Windows:** must `make test` work on your machine (no `make` installed), or is `npm run test:all` enough locally? This decides whether starting and stopping the server goes in a Node script.
12. **AC-8:** how are the top 3 picked? What if there are fewer than 3 real gaps? Should the "before" report be kept, e.g. as `reports/mutation/before.json`?
13. **`test/integration/`:** rename it, since those tests run in memory, or add it to the spec's layout list?
14. **Missing ACs:** should I suggest new ACs for NFR-5 and the parts of NFR-1 through NFR-4 that aren't covered, or will you write them?
