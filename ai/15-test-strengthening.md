# 15 — Test strengthening (Lab 3)

## Prompt

> docs/mutation.md lists three real gaps found by mutation testing (R1, R2, R3) and the tests that should catch them, in "Top-3 real gaps and how they are fixed". Add exactly those tests. Change only tests, not the code under test, and don't change test/scenarios/ (add new files instead; scenario-level checks for R1 can go into a new test/app/ file). Put the R2 tests in test/unit/ (they must keep test:unit at 100 %).
>
> For each new test, show that it fails against the mutant: apply the mutant by hand (e.g. remove the .sort, change depth < 5 to depth <= 5, force result === 'key-taken' to false), run the test, see it fail, revert.
>
> Then run npm run mutation and keep the new reports/mutation/mutation.json and mutation.html (don't touch before.json). Report the new score and, for each of the 9 mutants in docs/mutation.md, its status in the new report, matched by file, location and mutator. Also run npm run check and npm run test:all.
>
> Do not change specs/, docs/, adr/, standards/, ai/ or README.md. Commit with Conventional Commits, don't push.

## Answer

I added the tests for R1, R2 and R3, and the mutation score went from **78.45 % to 85.34 %** (99 / 116). 8 of the 9 real-gap mutants are now killed. The ninth, the `'Idempotency key'` message mutant, still survives: the R3 test the doc describes doesn't reach it. `npm run check` and `npm run test:all` both pass, and `test:unit` stays at 100 %. Nothing was pushed.

### What I added

- **R2** (`test/unit/retry.test.ts`): a `40P01` code at depth 4 gives `true`, at depth 5 gives `false`, and a cyclic `cause` chain without a code returns `false`.
- **R1 and R3** (`test/app/bookings-service.test.ts`, new): service tests with fake ports.
  - **R1:** booking seats 2/1, 1/3, 1/1 returns them as 1/1, 1/3, 2/1.
  - **R3:** when `save` returns `'key-taken'`, the response is the winner's booking, not the losing one.

I didn't add the R1 check as an HTTP scenario because it can't catch these mutants. The seed seat ids encode hall/row/number with zero padding, so sorting by id already gives row and number order, and the `.sort` is redundant on seed data. That's also why R1 survived the first run. The R1 test uses fake seat ids that sort in a different order. For the same kind of reason, the in-memory repository never returns `'key-taken'`, so R3 also needs a fake repository.

### Applying each mutant by hand

Each one was reverted with `git checkout`; `src/` is clean.

| Mutant                                                         | New test result                                                                   |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `.sort` removed, `a.row + b.row`, `a.number + b.number`        | R1 test fails; the R3 test also fails, since it checks seat order                 |
| `depth <= 5`                                                   | "ignores the code at depth 5" fails                                               |
| `depth < 5` -> `true`, `depth++` -> `depth--`                  | the cyclic-chain test hangs (killed by a 30 s timeout); "depth 5" run alone fails |
| `result === 'key-taken'` -> `false`, `key-taken` block -> `{}` | R3 test fails (the response is the losing booking)                                |
| `'Idempotency key'` -> `""`                                    | **still passes**                                                                  |

### Second Stryker run

98 killed, 1 timeout, 16 survived, 1 no coverage, 116 compile errors. Status of the 9 mutants, matched by file, location, mutator and replacement:

| #   | Location                     | Mutator                                  | before.json | mutation.json |
| --- | ---------------------------- | ---------------------------------------- | ----------- | ------------- |
| R1  | `bookings.service.ts:66:12`  | MethodExpression (`.sort` removed)       | Survived    | **Killed**    |
| R1  | `bookings.service.ts:68:23`  | ArithmeticOperator `a.row + b.row`       | Survived    | **Killed**    |
| R1  | `bookings.service.ts:68:40`  | ArithmeticOperator `a.number + b.number` | Survived    | **Killed**    |
| R2  | `retry.ts:15:23`             | ConditionalExpression `true`             | Survived    | **Killed**    |
| R2  | `retry.ts:15:23`             | EqualityOperator `depth <= 5`            | Survived    | **Killed**    |
| R2  | `retry.ts:15:65`             | UpdateOperator `depth--`                 | Survived    | **Killed**    |
| R3  | `bookings.service.ts:164:13` | ConditionalExpression `false`            | Survived    | **Killed**    |
| R3  | `bookings.service.ts:164:37` | BlockStatement `{}`                      | NoCoverage  | **Killed**    |
| R3  | `bookings.service.ts:168:13` | StringLiteral `""`                       | NoCoverage  | **Survived**  |

The last one survives because the doc's R3 test covers the case where the second `claimKey` returns the winner. The message only shows if it returns `null`. Killing it would need a test that asserts that message. I didn't add one, since you asked for exactly the doc's tests and the doc counts other `required(...)` messages as acceptable. You may want to reclassify it in the "Second run" section of `docs/mutation.md`, which I left unchanged as you asked.

### Commits

- `b9d078a test: cover the real gaps found by mutation testing`
- `f082757 test(mutation): add the Stryker report after the test fixes` (`mutation.json` and `mutation.html`)
