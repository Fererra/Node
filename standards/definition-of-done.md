# Definition of Done

A task / PR is done when all items below are true.

## Checks

- [ ] CI passes on the PR (runs `npm run check`, see `standards/checks.md`).
- [ ] `npm run check` passes locally.

## Module boundaries

- [ ] Modules import each other only through their public `index.ts`.
- [ ] No dependency cycles between modules.
- [ ] Both are enforced by `npm run deps:check`, not by review.

## Tests

- [ ] Every new business rule or invariant has a unit test (e.g. "can't book a showtime in the past", "a cancelled booking has no seats").
- [ ] Every new or changed user flow that touches the database has a functional test through HTTP with a real test database (e.g. "a seat can't be booked twice, even by parallel requests").
- [ ] Flows that don't touch the database (e.g. `/health`, `/version`) are covered by smoke and unit tests.
- [ ] A bug fix comes with a test that fails without the fix.

## Spec and decisions

- [ ] Every acceptance criterion of the spec is checked, and the check is described in the spec next to the AC.
- [ ] If implementation differs from the spec, the spec was updated first (separate commit, before the code change).
- [ ] Decisions that change structure, stack or module boundaries have an ADR.

## Repository

- [ ] Commit messages follow Conventional Commits (enforced by `commitlint` in the `commit-msg` hook).
- [ ] No build output, `node_modules`, `.env` or PDF exports in the repo.
