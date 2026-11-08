# Review of the in-memory stage

Reviewed the agent's 10 commits (`8f7598b`…`a4d9fdf`) and its report in `ai/08-in-memory.md` against the spec and docs. Analysis done together with Claude (chat); decisions are mine.

## Discrepancies with the docs

### 1. Error mapping lives in `src/app/`, not in `http`

- What: `docs/architecture.md` said "`http` maps application errors to HTTP codes". The agent put one code -> status table in the global error handler in `src/app/`.
- Why: two rules pulled in different directions: "`http` maps errors" and "one global error handler" (NFR-4). The agent picked one and only mentioned it at the end of the report.
- Decision: keep the agent's version, it is the one that satisfies NFR-4. Fix (architecture): application errors carry a code from `shared/errors.ts`; the global handler in `src/app/` maps codes to statuses in one table.

### 2. New shared files not in the docs

- What: `src/shared/errors.ts` and `src/shared/logger.ts` were added; the architecture lists shared files explicitly and didn't have them.
- Why: the architecture didn't say where the error type and the logger interface live.
- Fix (architecture): both files added to "App and shared".

### 3. Fastify's own 4xx errors

- What: bad JSON, `413` and `415` become `400 VALIDATION_ERROR`; `docs/api.md` didn't list `413` / `415`.
- Fix (api): added to the `400` row.

## My own checks

- Broke "started" (`<=` -> `<` in `shared/kernel/time.ts`): `npm test` failed on AC-13; reverted.
- `application` doesn't import Fastify: no matches in `src/modules/*/application`.
- All 10 agent commits have the `Co-Authored-By` trailer.
- Seed ids are valid UUIDs (hex prefix, version `4`, variant `8`); they pass the UUID validation of the API in the scenario tests.

## Agent decisions I accept as they are

UUIDs lowercased in `http`; Ajv coercion off; "started" as one kernel function; module factories take `storage`; repository port with `claimKey` + `save` returning `'created' | 'seat-taken' | 'key-taken'`; seed shape; `.catch()` also banned in `http` / `application`; unit tests in `test/unit/`, AC-7 / AC-8 tests in `test/integration/`; no transaction in the context until the DB stage.

## For the DB stage

`buildApp` is synchronous; NFR-5 (`SELECT now()` on start) needs an async `buildApp` or an `onReady` check that makes the app exit.
