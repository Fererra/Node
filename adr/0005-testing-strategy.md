# ADR-0005: Testing strategy: test levels, coverage and mutation testing with Stryker

- Status: accepted
- Date: 2026-11-18

## Context

After Lab 2 the app has unit tests, in-memory scenario tests and integration tests on PostgreSQL (`test:func`, `fastify.inject`). Lab 3 (spec `specs/03-testing.md`) asks for all test levels including E2E, one command that runs everything, and a way to show how good the tests are: green tests may still miss real bugs.

During Lab 2 I already checked a few tests by breaking the code by hand (N+1, sorted inserts, deferred FK). That worked, but it covered only the cases I thought of.

## Decision Drivers

- Show test effectiveness with something measurable, not only "tests are green".
- Find weak tests I didn't think of, not only confirm the ones I did.
- Reproducible with one command, locally and in CI.
- Works with the existing stack: TypeScript, Vitest, Fastify, PostgreSQL in Docker.
- Fits the time budget: CI on every PR must stay fast.

## Considered Options

### Option A: Coverage only

Measure line and branch coverage with V8 and set thresholds.

- Pros: built into Vitest; fast; easy to run in CI.
- Cons: coverage shows that code ran, not that a test would fail if it were wrong; a test without assertions still gives 100 %.

### Option B: Coverage + hand-made faults

Coverage thresholds, plus faults I introduce by hand and record (as in Lab 2).

- Pros: no new tool; each fault is meaningful.
- Cons: covers only the faults I think of, so it confirms what I already expect; doesn't scale; nothing to rerun.

### Option C: Coverage + mutation testing with Stryker, run by hand, report committed

Branch coverage thresholds in `make test`; Stryker (`@stryker-mutator/vitest-runner`, TypeScript checker) mutates the critical logic and runs the unit and in-memory tests against each mutant; surviving mutants are classified and the real gaps fixed.

- Pros: finds weak tests automatically, including cases I didn't think of; gives a mutation score as a number; reruns with one command; Stryker supports TypeScript and Vitest directly.
- Cons: slow (every mutant reruns the tests), so it can't run on every PR; equivalent mutants must be classified by hand; one more dev dependency.

### Option D: Mutation testing on every PR in CI

Same as Option C, but `make mutation` is a required CI step.

- Pros: a score drop blocks the merge.
- Cons: minutes per PR even with a narrow scope; flaky when tests touch the database; for a one-person project the gain doesn't pay for the wait.

## Decision

Option C.

- Test levels:
  - unit: pure code without I/O (`test/unit/`); `bookings/domain`, `shared/retry.ts` and `shared/kernel/` are covered completely;
  - integration: the HTTP app through `fastify.inject` with PostgreSQL (`test/scenarios/`, `test/pg/`, `npm run test:func`);
  - E2E: a real server process on its own port and database, called through `fetch` (`test/e2e/`).
- Coverage: V8 through Vitest, branch and function thresholds as in the spec (NFR-1); a drop fails `make test`.
- Mutation testing: Stryker on `bookings/domain`, `bookings/application`, `shared/retry.ts` and `shared/kernel/`, running the unit and in-memory tests (no database), so a run stays within minutes. The score threshold (NFR-2) fails `make mutation`. Run by hand; the last report is committed and classified in `docs/mutation.md`.
- Mutants are never hidden: no `// Stryker disable` comments, no `mutator.excludedMutations` and no ignorers in the Stryker config. Equivalent mutants stay in the report and are classified.
- One command: `scripts/test-all.mjs` runs every level and always stops the server; it works on Windows. The `Makefile` with `test` and `mutation` targets only calls npm scripts (`test:all`, `mutation`); CI runs `make test` with Docker Compose, like local runs.

## Consequences

- Good: test quality is shown by a number (mutation score) and by concrete survivors, not by coverage alone.
- Good: the weakest tests are found by a tool, then strengthened and checked again with a second run.
- Good: `make test` reproduces the whole run locally and in CI; without `make`, the same npm scripts work.
- Bad: mutation testing runs only by hand, so a later change can lower the score unnoticed until the next run.
- Bad: mutants in `bookings/application` that only the PostgreSQL tests could kill (transactions, row counts) survive the in-memory run; they are classified as "acceptable, covered by integration tests".
- Bad: equivalent mutants take manual work to recognise and explain.
- Follow-up: E2E needs its own database and port, separate from development and from `test:func` (spec NFR-3).
