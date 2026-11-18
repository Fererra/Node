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

---

## Prompt 2

> My answers:
>
> 1: CI runs Docker Compose like local runs; the service container goes away.
> 2: make test = check (format, lint, types, deps, build) with coverage instead of plain npm test (no double run) + test:func + E2E.
> 3: 100 % per file (perFile) for the FR-1 files, from a unit-only run (test:unit). For files without branches, every exported function has a test. ≥ 90 % for bookings/application comes from the in-memory run.
> 4: Stryker's total mutation score. No // Stryker disable comments: equivalent mutants stay in the report and are classified.
> 5: Scope stays; PostgreSQL-only mutants are "acceptable". "or the scope is narrowed" is removed from the ADR.
> 6: E2E database reset and reseeded once per run; tests use different seats. The run refuses to start if E2E_DATABASE_URL equals DATABASE_URL or TEST_DATABASE_URL (checks.md: any two of the three).
> 7: test/e2e/ imports nothing from src/ (ESLint no-restricted-imports), only fetch to localhost:3100.
> 8: Both 201 replay and 422 reused key; the path ends with the seat free again.
> 9: Stop at the first failing step; the server is always stopped; PostgreSQL stays up.
> 10: npm ci is a prerequisite (separate CI step). The script reads .env or .env.example; it creates missing cinema_test / cinema_e2e databases itself, so an old volume is fine.
> 11: npm run test:all must work on Windows without make: orchestration in scripts/test-all.mjs, the Makefile only calls it.
> 12: Top-3 = real gaps by risk to booking correctness; all of them if fewer than 3. Before report kept as reports/mutation/before.json. reports/ in .prettierignore, .stryker-tmp/ in .gitignore.
> 13: test/integration/ will be renamed to test/app/.
> 14: I wrote the ACs myself; fixing gaps is now FR-7.
>
> Files updated locally, not committed: specs/03-testing.md, adr/0005-testing-strategy.md, standards/checks.md, standards/definition-of-done.md. Re-read the diff and check it against my answers. Anything unresolved or contradictory? Is every FR/NFR covered by an AC? Do not change any files.

## Answer 2

Your four files match almost all of your answers. Answers 1, 5, 8, 11, 12, 13 and 14 are fully reflected, and the spec stays within one page (55 lines, shorter than spec 02). A few places are still open, and two are real problems. I didn't change any files.

### Real problems

**1. The unit-only run doesn't say which tests it runs, so "unit tests alone" can still leak (FR-1, NFR-1, answer 3).** `checks.md:23` still defines unit tests as `test/unit/` plus `src/**/*.test.ts`. That glob also matches:

- `src/app/smoke.test.ts` and the other `src/app/*.test.ts`, which build the app with `buildApp`;
- the in-memory repository tests in `src/modules/*/infrastructure/*.test.ts`. `in-memory-bookings.repository.test.ts` calls `listByUser`, which runs `compareText`.

So `test:unit` would count those tests toward the FR-1 files' 100 %, which is exactly what answer 3 rules out. You need to decide:

- which files `test:unit` includes;
- where the leftover `src/**` tests and `scripts/*.test.mjs` run (in `test:coverage`?), so that `check` without plain `npm test` still runs all of them;
- whether `check` stops reusing `check:fast`. Pre-push should keep plain `npm test`, but `check` now needs the two coverage runs. The docs don't say this anywhere.

**2. E2E can't get a user ID without importing from `src/` (answer 7).** Seed IDs live in `src/app/seed.ts`, and `test/support/client.ts:2` imports them from there. Movie, showtime and seat IDs can be found through the API. A user ID for `X-User-Id` can't, because there's no users endpoint. Also, ESLint `no-restricted-imports` only checks direct imports, so `test/e2e/ → test/support/client.ts → src/` would get past it. How should E2E get user IDs: hard-coded UUIDs in `test/e2e/`, or environment variables? And should the rule also ban `test/support/`?

**3. `STORAGE=postgres` from `.env` will reach the in-memory runs (answer 10).** Both `.env` and `.env.example` set `STORAGE=postgres`, and `test/support/app.ts:29` reads `process.env.STORAGE ?? 'memory'`. If `test-all.mjs` loads either file into the environment and then runs `check`, the "in-memory" tests run on PostgreSQL in parallel against `cinema_test`. That's flaky at best, and the `bookings/application` coverage would no longer come from memory. The script should load only the URLs, or force `STORAGE=memory` for the `check` step. Worth one line in `checks.md`.

### Gaps and loose wording

- **AC-1's check doesn't cover "every exported function has a test".** For files with zero branches (`domain/booking.ts`, `kernel/uuid.ts`), skipping a test can't lower branch coverage. A `functions: 100` per-file threshold in `test:unit` would make AC-1 checkable. "Skipping one test fails the threshold" also only holds for a test that is the _only_ one covering some branch, so name that test.
- **AC-2:** "skipping a test below the threshold fails it" is hard to follow. Something like "lowering coverage below 90 % (e.g. skipping `<file>`) fails the run" would be clearer.
- **NFR-2 (answer 4):** it says "Stryker mutation score" but not _total_. Stryker's default is the total score, but writing "total (not based on covered code)" settles it. AC-9 searches only for `Stryker disable` comments. Mutants can also be excluded in `stryker.config` (`mutator.excludedMutations`, `ignorers`, `ignoreStatic`), so the rule should forbid those too.
- **NFR-3 vs `checks.md`:** the spec compares `E2E_DATABASE_URL` with the other two URLs, while `checks.md` says "any two of the three". There's no conflict (`testDatabaseUrl()` already checks test against dev), but the spec is the weaker of the two. Also, comparing strings misses `localhost` vs `127.0.0.1`. Comparing host, port and database name would catch that.
- **NFR-3 "order doesn't matter":** different seats aren't enough if two E2E tests use the same user, because `GET /me/bookings` returns every booking of that user. Either assert only on your own booking IDs, or give each test its own user.
- **Answer 9 isn't written down:** nothing says "PostgreSQL stays up". AC-7's "the server is stopped" needs a check, e.g. port 3100 is free afterwards.
- **Answer 10:**
  - `.env.example` has no `E2E_DATABASE_URL` yet. That's an implementation step, but FR-4 depends on it.
  - "creates missing databases, so an old volume is fine" has no AC. You could add it to AC-6, e.g. "with a volume that has no `cinema_e2e`".
  - `npm ci` as a prerequisite appears only in AC-6, not in FR-4.
- **`.stryker-tmp/` (answer 12):** Prettier respects `.gitignore`, but ESLint's flat config doesn't. `eslint.config.mjs:6` ignores only `dist/` and `coverage/`, so a leftover sandbox would get linted.
- **AC-10:** mutant IDs in the Stryker JSON are renumbered on every run, so `before.json` and `mutation.json` have to be matched by file, location and mutator. That works here because FR-7 changes only tests, but say so in `docs/mutation.md`.

### Coverage of FR/NFR by ACs

Every FR and NFR now has an AC. Four parts are still unchecked:

| Requirement | Unchecked part                                                                           |
| ----------- | ---------------------------------------------------------------------------------------- |
| FR-1        | "no I/O"                                                                                 |
| FR-4        | the `.env.example` fallback (CI only tests it implicitly) and creating missing databases |
| NFR-4       | "its last report is committed" (AC-8 only looks at the local `reports/mutation/`)        |
| NFR-5       | "the `Makefile` only calls npm scripts" (a one-line review check would do)               |

### Questions

1. Which files exactly go into `test:unit` and which into `test:coverage`, and what replaces `check:fast` inside `check`?
2. How does E2E get user IDs without `src/`, and does the import ban also cover `test/support/`?
3. Should `test-all.mjs` force `STORAGE=memory` for `check`, or load only the URLs from `.env`?
4. Should I add `functions: 100` to the FR-1 per-file threshold, and write "total score, no exclusions in Stryker config" in NFR-2?
5. Should the four unchecked parts in the table get AC wording, or is that enough for you?

---

## Prompt 3

> Round 2 answers:
>
> 1: test:unit runs only test/unit/\*\*; src/shared/retry.test.ts moves to test/unit/. All other tests (src/\*\*/\*.test.ts, scripts/\*.test.mjs, test/scenarios/, test/app/) run in test:coverage. check no longer reuses check:fast: format, lint, typecheck, deps, test:unit, test:coverage, build. Pre-push (check:fast) keeps plain npm test.
> 2: E2E user ids are hard-coded in test/e2e/seed-ids.ts: fixed seed UUIDs are part of the seed contract. ESLint bans test/e2e/ from importing both src/ and test/support/.
> 3: test-all.mjs takes only database URLs from .env and forces STORAGE=memory for the check step.
> 4: Yes: functions 100 per file for FR-1; NFR-2 is the total score with no exclusions in the Stryker config.
> 5: Added to existing ACs: AC-1 (functions, no I/O imports), AC-6 (no .env, existing volume), AC-8 (committed report), AC-11 (Makefile review). Also: .stryker-tmp/ and reports/ in the ESLint ignores; before.json and mutation.json are compared by file, location and mutator.
>
> Files updated locally, not committed. Re-read the diff and check it against my answers from both rounds. Anything unresolved or contradictory? Do not change any files.

## Answer 3

All of your round-2 answers made it into the spec and `checks.md`, and the four files pass Prettier. I found three new problems that the new wording creates, plus a few small points from round 2 that are still open. I didn't change any files.

### New problems

**1. Nothing keeps E2E tests out of the in-memory runs.** E2E files are named `test/e2e/*.e2e.test.ts`. The `vitest.config.ts` include list is `test/**/*.test.ts`, which matches them. So:

- plain `npm test` (pre-push) would run them with no server and fail;
- `test:coverage` would do the same;
- Stryker, which runs these tests against every mutant, would too.

Round 1 also removed the line from `checks.md` that said "`npm test` excludes `*.pg.test.ts`". The docs no longer say what `npm test` leaves out. One line would cover both: "`npm test`, `test:coverage` and Stryker exclude `*.pg.test.ts` and `*.e2e.test.ts`".

**2. The 100 % per-file thresholds must apply only to the FR-1 files.** `retry.ts` imports `src/shared/errors.ts`. That file has 4 `AppError` subclasses, and unit tests only ever create `ServiceUnavailableError`. If the per-file thresholds apply to every file the unit run loads, `errors.ts` fails the functions threshold. NFR-1 says "for the FR-1 files", so the requirement is right; the risk is in how it gets implemented. Limit the coverage `include` to the FR-1 files in `test:unit`, or attach the thresholds to those globs only. Also, NFR-1 doesn't say whether the ≥ 90 % for `bookings/application` is per file or a total over the folder. I assume a total.

**3. Nothing says how the E2E server gets its database and port.** The server reads `DATABASE_URL` and `PORT`, not `E2E_DATABASE_URL`. `db:migrate` and `db:seed` also read `DATABASE_URL`, and they load `.env` through `--env-file-if-exists`. Values already in the environment take precedence over `.env`, so this works if the script sets them. Neither FR-4 nor `checks.md` says it does. One line would close it: "the server, `db:migrate` and `db:seed` get `DATABASE_URL=$E2E_DATABASE_URL`, and the server gets `PORT=3100` and `STORAGE=postgres`."

### Smaller points

- **Stryker's test set:** `test:unit` and `test:coverage` are two separate runs, but the vitest runner takes one config. Name the config Stryker uses. Presumably it's `vitest.config.ts`, the plain `npm test` set, once E2E files are excluded (problem 1).
- **`checks.md:24`** describes `src/**/*.test.ts` as "everything that isn't a pure unit test". But `src/shared/clock.test.ts` and `src/shared/db/errors.test.ts` _are_ pure. More accurate: "unit tests outside the FR-1 scope may stay in `src/` and run here."
- **The ADR is behind the spec:**
  - `adr/0005-testing-strategy.md:58` still says only "branch thresholds"; NFR-1 now has branch and function thresholds.
  - Line 61 forbids `// Stryker disable` comments but not exclusions in the Stryker config.
- **AC-9** searches only for `Stryker disable` comments in `src/`. NFR-2 now also forbids exclusions in the config, so the check should look at the Stryker config too. "Exclusions" should also be made specific, e.g. "no `mutator.excludedMutations` or `ignorers`". Otherwise it could be read as banning `ignorePatterns`, which Stryker needs for `reports/`.
- **`test/e2e/seed-ids.ts`** copies UUIDs from `src/app/seed.ts`. If the two drift apart, E2E fails with a clear 401, which is acceptable. An in-memory test comparing the two files would catch the drift earlier. That test can import both files because it doesn't live in `test/e2e/`.

### Still open from round 2

All small; you may decide they're fine as they are.

- AC-1 says "skipping one test fails the threshold", and AC-2's wording is unchanged. Neither names the test to skip.
- Nothing checks AC-7's "the server is stopped" (e.g. port 3100 is free afterwards). "PostgreSQL stays up" isn't written anywhere.
- NFR-3 compares the database URLs as strings, so `localhost` vs `127.0.0.1` would get through.
- Different seats don't make E2E tests independent if they share a user, because `GET /me/bookings` returns every booking of that user.
- `npm ci` as a prerequisite is in AC-6 but not in FR-4.

### Coverage of FR/NFR by ACs

Every FR and NFR is covered by at least one AC. The one part still unchecked is NFR-2's "no exclusions in the Stryker config" (see AC-9 above).

### Questions

1. Should `checks.md` list which runs exclude `*.e2e.test.ts` and `*.pg.test.ts`, and name the config Stryker uses?
2. Should the env mapping for the E2E server (`DATABASE_URL`, `PORT`, `STORAGE`) go in FR-4 or only in `checks.md`?
3. Is the ≥ 90 % for `bookings/application` a total over the folder?
4. Do you want to update the ADR for function thresholds and Stryker config exclusions, or leave it to the spec?
