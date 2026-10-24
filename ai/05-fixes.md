# 05 — Fixes (round 2)

New chat. Run after `ai/03-review-fixes.md` §4–5.

## Prompt

> Hi! Read specs/01-foundation.md, docs/architecture.md, standards/ and the code on this branch. The spec was updated in the last commits (see git log). Align the code and tests with the current spec. Do not change specs/, standards/, docs/, adr/ or README.md; if something is wrong or impossible, stop and tell me. Commit in small steps with Conventional Commits. At the end, report which ACs were affected and how you verified them.

## Answer

The code now matches the updated spec. I made three commits on `lab1-foundation` and changed nothing in `specs/`, `standards/`, `docs/`, `adr/` or `README.md`. I found nothing wrong or impossible in the spec. `npm run check` passes and the working tree is clean.

### Commits

1. `13f8cc5 build(deps): forbid npm packages in domain and framework/ORM in application`: two new rules in `.dependency-cruiser.mjs`. `layer-domain-no-npm` blocks any npm package in `domain`. `layer-application-no-framework` blocks `fastify`, `@fastify/*` and `drizzle-orm` in `application`.
2. `0623ec1 refactor(scripts): extract GIT_SHA logic from launcher and test it`: moves the `git rev-parse` logic into `scripts/git-sha.mjs` so it can be tested without starting the server. No behaviour change. I added `scripts/**/*.test.mjs` to the Vitest `include`.
3. `0839392 fix(scripts): set GIT_SHA from git when it is empty`: the launcher used to keep an empty `GIT_SHA`, so `/version` returned `"unknown"`. It now keeps only a non-empty value. The empty-case test is in this commit.

### What changed in the spec and what it meant for the code

| Spec / architecture change                                                            | Code / tests                                                                    |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| FR-2: the launcher keeps an existing **non-empty** `GIT_SHA`                          | `scripts/git-sha.mjs` checks `!env.GIT_SHA` instead of `=== undefined`; 4 tests |
| Architecture: `domain` → no npm packages                                              | New dependency-cruiser rule `layer-domain-no-npm`                               |
| Architecture: `application` → no framework or ORM packages (`fastify`, `drizzle-orm`) | New dependency-cruiser rule `layer-application-no-framework`                    |
| AC-7 (h): `import 'fastify'` in `movies/domain` fails `deps:check`                    | Covered by `layer-domain-no-npm`                                                |

### Acceptance criteria

| AC                          | How I checked it                                                                                  | Result                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-2                        | New launcher tests: `GIT_SHA` unset, empty, preset, and git failing                               | ✓ 4 pass                                                                                                                                                             |
|                             | **Broke it:** ran the empty-case test against the old `=== undefined` check                       | It failed, so the test catches the bug                                                                                                                               |
|                             | By hand: `npm run build`, then `npm start` and `curl /version`                                    | Unset → `0839392`, empty → `0839392`, both the same as `git rev-parse --short=7 HEAD`. `GIT_SHA=preset1` → `preset1`                                                 |
|                             | Started the launcher outside a git checkout                                                       | Server started, `/version` → `"unknown"`                                                                                                                             |
| AC-7                        | Script that adds each temporary import, runs `deps:check`, then deletes it                        | (a)–(g) still fail. (h) `import 'fastify'` in `movies/domain` now fails with `layer-domain-no-npm`; the earlier review showed it passing                             |
|                             | Extra imports that must fail                                                                      | All fail: a type-only `fastify` import in `domain`, `fastify` or `drizzle-orm` in `application`, and `vitest` in `domain`                                            |
|                             | Imports that must still pass                                                                      | All pass: `node:crypto` and `shared` in `domain`, `fastify` in `http` and `infrastructure`, and a type-only import of another module's `index.ts` from `application` |
|                             | Leftovers                                                                                         | `git status src` empty afterwards                                                                                                                                    |
| AC-6                        | `npm run deps:check`                                                                              | ✓ No violations                                                                                                                                                      |
| AC-1, AC-3–AC-5, AC-8, AC-9 | Not affected. `npm run check` exits 0, and each commit passed the pre-commit and commit-msg hooks | ✓                                                                                                                                                                    |

### Decisions I made where the spec isn't explicit

- **Node built-ins:** `node:` modules count as allowed in `domain`, since they aren't npm packages.
- **Type-only imports:** a type-only npm import also counts as "an npm package" in `domain`, and the same goes for `fastify` in `application`.
- **`@fastify/*`:** I treated these as framework packages, alongside the two the architecture doc names.
- **Empty `GIT_SHA` when git fails:** the launcher leaves the value as it was. The app already reports `"unknown"` for empty, so the result is the same as unset.

### Not verified locally

- **Pre-push hook and CI on the new commits:** I didn't push, so neither has run on them.

## My notes

The agent decided three things the docs didn't say: Node built-ins are allowed in `domain`, type-only npm imports count as packages, and `@fastify/*` counts as a framework package. I accepted them and added them to `docs/architecture.md`.
