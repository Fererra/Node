# Review of the implementation

Reviewed the agent's commits and its AC report against specs/01-foundation.md, then checked the dependency-cruiser config by hand.
Analysis done together with Claude (chat); decisions are mine.

## 1. GIT_SHA is not set in CI

- What: FR-2 said GIT_SHA is set by CI and by `npm start`. The CI workflow doesn't set it.
- Why: no AC checked the CI part of FR-2 (AC-2 checked only the unit test and a manual run).
- Fix (spec): removed "set by CI" from FR-2; deployment is out of scope, and CI never starts the server.

## 2. Factories take no deps

- What: docs/architecture.md#rules describes `create<Name>Module(deps)`; the code has factories without parameters.
- Why: the spec said only "empty factory" and didn't define the Lab 1 signature.
- Fix (spec): "In Lab 1 factories take no arguments; `deps` appear with the first port."

## 3. Empty GIT_SHA behaviour was decided by the agent

- What: an empty GIT_SHA is treated as unset; the spec didn't say so.
- Why: FR-2 didn't define the empty case.
- Fix (spec): FR-2 "…or `"unknown"` if unset or empty"; AC-2 tests set, unset and empty.

## 4. External packages are not restricted by layer rules

- What: "`domain` → only `shared`" and ADR-0003 ("ORM only in `infrastructure`") are not enforced for npm packages.
- Evidence: added `import 'fastify'` to `src/modules/movies/domain/index.ts`, then:

  ```text
  npm run deps:check
  ✔ no dependency violations found (16 modules, 25 dependencies cruised)
  ```

  The temporary file was removed.

- Why: the rules in docs/architecture.md only talked about project paths, and no AC tested an npm import in a layer.
- Fix (architecture + spec): forbid npm packages in `domain` and framework/ORM packages in `application`; add AC-7 (h).

## 5. Empty GIT_SHA: app and launcher disagree

- What: raised by the agent in `ai/04-fixes.md`. The app treats an empty GIT_SHA as unset, the launcher treats it as set, so `GIT_SHA= npm start` returns "unknown".
- Why: FR-2 said the launcher "keeps an existing GIT_SHA" without saying whether empty counts.
- Fix (spec): the launcher keeps only a non-empty GIT_SHA.

## Other notes

- checks.md example used Node 22; the project uses Node 26 → example updated.
- TypeScript pinned to 6.0.3 because typescript-eslint doesn't support 7 yet → accepted.
- ADR-0003 was formatted but not committed → committed.

## Status

- §1–3: spec fixed, code aligned in `ai/04-fixes.md` (`06f9dcc`).
- §4–5: spec and architecture fixed, code alignment in `ai/05-fixes.md`.
