# Review of the implementation (round 1)

I reviewed the agent's 8 commits and its AC report against specs/01-foundation.md. Analysis done together with Claude (chat); decisions are mine.

## 1. GIT_SHA is not set in CI

- What: FR-2 says GIT_SHA is set by CI and by `npm start`. The CI workflow doesn't set it.
- Why: no AC checked the CI part of FR-2 (AC-2 checks only the unit test and a manual run).
- Fix (spec): remove "set by CI" from FR-2; deployment is out of scope, and CI never starts the server.

## 2. Factories take no deps

- What: docs/architecture.md#rules describes `create<Name>Module(deps)`; the code has factories without parameters.
- Why: the spec said only "empty factory" and didn't define the Lab 1 signature.
- Fix (spec): "In Lab 1 factories take no arguments; `deps` appear with the first port."

## 3. Empty GIT_SHA behaviour was decided by the agent

- What: an empty GIT_SHA is treated as unset; the spec didn't say so.
- Why: FR-2 didn't define the empty case.
- Fix (spec): FR-2 "…or `"unknown"` if unset or empty".

## Other notes

- checks.md example uses Node 22; the project uses Node 26 → update the example.
- TypeScript pinned to 6.0.3 because typescript-eslint doesn't support 7 yet → accepted.
- ADR-0003 was formatted but not committed → committed.

## Next

Spec and checks.md updated in separate commits; the agent then aligns the code and tests with the updated spec.
