# Mutation testing report (Lab 3)

Tool: Stryker with the Vitest runner and the TypeScript checker (ADR-0005). Scope: `bookings/domain`, `bookings/application`, `shared/retry.ts`, `shared/kernel/`. Tests: the `npm test` set (unit and in-memory, no PostgreSQL). Classification and choices are mine; the analysis was done together with Claude (chat).

## First run (`reports/mutation/before.json`)

77 killed, 14 timeout, 22 survived, 3 no coverage, 116 compile errors (rejected by the TypeScript checker, not counted). Score: 91 / 116 = **78.45 %**, below the 80 % threshold.

`bookings/domain`, `bookings/application/errors.ts` and `shared/kernel/` have no survivors. All 25 survivors are in `bookings/application/bookings.service.ts` and `shared/retry.ts`.

## Classification of survivors

Categories: **real gap** (a real bug would pass the tests), **equivalent** (the program behaves the same), **acceptable** (the behaviour changes, but not in a way the contract or the tests should pin).

### Real gaps (9 mutants, 3 problems)

| #   | File:line                 | Mutant                                      | Why it survived                                                                                                                                      |
| --- | ------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `bookings.service.ts:66`  | `.sort(...)` removed                        | No test books seats on several rows in a non-sorted order, so the seat order in a booking (`docs/api.md`: "by row and number") is never checked.     |
| R1  | `bookings.service.ts:68`  | `a.row - b.row` -> `a.row + b.row`          | Same as above.                                                                                                                                       |
| R1  | `bookings.service.ts:68`  | `a.number - b.number` -> `+`                | Same as above.                                                                                                                                       |
| R2  | `retry.ts:15`             | `depth < 5` -> `true`                       | All tests use short `cause` chains that end in `undefined`, so the loop stops on `typeof current === 'object'` and never reaches the depth limit.    |
| R2  | `retry.ts:15`             | `depth < 5` -> `depth <= 5`                 | Same: no test puts the code at depth 5, the first level that must be ignored.                                                                        |
| R2  | `retry.ts:15`             | `depth++` -> `depth--`                      | Same: the limit is never reached, so it doesn't matter which way `depth` moves.                                                                      |
| R3  | `bookings.service.ts:164` | `result === 'key-taken'` -> `false`         | No test makes `save` report that a parallel request took the key. With the mutant, the losing request would answer as if it had created the booking. |
| R3  | `bookings.service.ts:164` | the `key-taken` block -> `{}` (no coverage) | Same branch: never executed in the `npm test` set.                                                                                                   |
| R3  | `bookings.service.ts:168` | `'Idempotency key'` -> `""` (no coverage)   | Same branch.                                                                                                                                         |

Coverage was 100 % branches for `retry.ts` (AC-1) while R2 survived: V8 doesn't count `depth < 5 && …` as a separate branch, and no test reaches the limit. Green coverage did not mean the limit was tested.

### Equivalent (1 mutant)

| File:line                 | Mutant                                  | Reason                                                                                                                                                                 |
| ------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bookings.service.ts:219` | `if (bookings.length === 0)` -> `false` | Without the early return the code calls the ports with empty lists and maps an empty array: the result is `[]` either way. Only the work done differs, not the output. |

### Acceptable (15 mutants)

| File:line                                                             | Mutant                                               | Reason                                                                                                                                                        |
| --------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bookings.service.ts:53` (no coverage), `:67`, `:103`, `:203`, `:230` | messages of `required(...)` -> `""`                  | `required` guards data invariants (a booking's seat or showtime always exists). It can't fail through the API; when it does, the client sees a generic `500`. |
| `bookings.service.ts:121`, `:149`, `:195`                             | `NotFoundError('Showtime' / 'Booking')` -> `""`      | The contract (`docs/api.md`) fixes the code `NOT_FOUND`; the message text is not part of it. The status and code are tested.                                  |
| `bookings.service.ts:105` (fields, message), `:208` (fields, message) | log fields `{ bookingId }` -> `{}`, messages -> `""` | Log text and fields are not part of the API. The PostgreSQL tests (not in the Stryker run) read `booking created` / `booking replayed`, not these fields.     |
| `retry.ts:47`, `:53`                                                  | log messages -> `""`                                 | The Lab 2 tests read the `attempt` field, not the message text.                                                                                               |
| `retry.ts:56`                                                         | `ServiceUnavailableError` message -> `""`            | The global error handler answers `503` with its own message (see `docs/evidence/lab2-db-failure.md`), so this text never reaches the client.                  |

## Top-3 real gaps and how they are fixed (FR-7)

Ranked by risk to booking correctness:

1. **R3: losing the race for an idempotency key.** With the mutant, a request that lost the key to a parallel one would return a booking it didn't create. Test: a service test with a fake repository where `save` returns `'key-taken'` and `claimKey` then returns the winner -> the response is the winner's booking (a replay), and the losing booking isn't returned.
2. **R1: seat order in a booking.** A client would get seats in any order. Test: book seats `row 2 / seat 1`, `row 1 / seat 3`, `row 1 / seat 1` -> the response lists `1/1`, `1/3`, `2/1`.
3. **R2: depth limit of the `cause` chain.** Without the limit, a cyclic `cause` (`a.cause = a`) would make `isRetryableError` loop forever and hang the request. Tests: code `40P01` at depth 4 -> `true`; at depth 5 -> `false`; a cyclic chain without a code -> `false` and the call returns.

Only tests change; the code under test stays the same.

## Second run (`reports/mutation/mutation.json`)

After the test fixes in `b9d078a` (report in `f082757`): 98 killed, 1 timeout, 16 survived, 1 no coverage, 116 compile errors. Score: 99 / 116 = **85.34 %**, above the 80 % threshold.

Status of the 9 mutants from "Real gaps", matched by file, location, mutator and replacement:

| #   | File:line:column             | Mutant                              | `before.json` | `mutation.json` |
| --- | ---------------------------- | ----------------------------------- | ------------- | --------------- |
| R1  | `bookings.service.ts:66:12`  | `.sort(...)` removed                | Survived      | Killed          |
| R1  | `bookings.service.ts:68:23`  | `a.row - b.row` -> `+`              | Survived      | Killed          |
| R1  | `bookings.service.ts:68:40`  | `a.number - b.number` -> `+`        | Survived      | Killed          |
| R2  | `retry.ts:15:23`             | `depth < 5` -> `true`               | Survived      | Killed          |
| R2  | `retry.ts:15:23`             | `depth < 5` -> `depth <= 5`         | Survived      | Killed          |
| R2  | `retry.ts:15:65`             | `depth++` -> `depth--`              | Survived      | Killed          |
| R3  | `bookings.service.ts:164:13` | `result === 'key-taken'` -> `false` | Survived      | Killed          |
| R3  | `bookings.service.ts:164:37` | `key-taken` block -> `{}`           | NoCoverage    | Killed          |
| R3  | `bookings.service.ts:168:13` | `'Idempotency key'` -> `""`         | NoCoverage    | Survived        |

Tests added (`b9d078a`):

- R2 in `test/unit/retry.test.ts`: code `40P01` at depth 4 -> `true`, at depth 5 -> `false`, a cyclic `cause` chain without a code -> `false` and the call returns.
- R1 and R3 in `test/app/bookings-service.test.ts`: service tests with fake ports. R1 books seats `2/1`, `1/3`, `1/1` and expects `1/1`, `1/3`, `2/1`; R3 makes `save` return `'key-taken'` and expects the winner's booking.

Each new test was checked against its mutant by hand: the mutant was applied, the test failed, the change was reverted (`ai/15-test-strengthening.md`).

### Corrections to the first classification

- `bookings.service.ts:168` (`'Idempotency key'` -> `""`) was wrongly put under R3. It is the message of a `required(...)` guard, like the other `required` messages: it only shows if the second `claimKey` returns nothing, which means broken data and a generic `500`. Reclassified as **acceptable**. R3 itself is fixed: the `key-taken` branch is now executed and its condition is killed.

### Why R1 survived: test data hid the bug

The seed seat ids encode hall, row and number with zero padding, so sorting seats by id already gives row-and-number order. On seed data the `.sort` in `toDto` does nothing, and no HTTP scenario on seed data could catch its removal. The new test uses a service with fake ports and arbitrary ids, so the order comes only from the sort.

### Remaining survivors

16 survivors and 1 no-coverage mutant, all classified above: 15 acceptable (including `:168`), 1 equivalent (`:219`), and none real. Killed vs timeout counts vary between runs (14 timeouts in the first run, 1 in the second), so mutants are matched by location, not by status alone.
