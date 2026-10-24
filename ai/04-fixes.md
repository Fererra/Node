# 04 — Fixes

## Prompt

> Hi! Read specs/01-foundation.md, docs/architecture.md, standards/ and the code on this branch. The spec was updated in the last commits (see git log). Align the code and tests with the current spec. Do not change specs/, standards/, docs/, adr/ or README.md; if something is wrong or impossible, stop and tell me. Commit in small steps with Conventional Commits. At the end, report which ACs were affected and how you verified them.

## Answer

The code already matched almost all of the updated spec. The only gap was a test for an empty `GIT_SHA`, so I made one commit. I didn't change anything in `specs/`, `standards/`, `docs/`, `adr/` or `README.md`, and I found nothing wrong or impossible in the spec.

### Commits

1. `test(app): cover empty GIT_SHA in /version`: adds the empty case to `src/app/version.test.ts`.

### What changed in the spec and what it meant for the code

| Spec change                                            | Code / tests                                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| FR-2: `"unknown"` if `GIT_SHA` is unset **or empty**   | `config.ts` already handles this (`env.GIT_SHA \|\| 'unknown'`), so only the test was missing |
| FR-2: "set by CI" removed                              | Nothing to change: the CI workflow never set `GIT_SHA`                                        |
| AC-2: unit test for set, unset **and empty**           | The empty-case test is the new commit                                                         |
| Design: `create<Name>Module()` takes no arguments      | All 6 factories already take none                                                             |
| `checks.md`: Node example changed to `26` / `>=26 <27` | `.nvmrc` is `26` and `engines` is `>=26 <27`, which already match                             |

### Acceptance criteria

| AC              | How I checked it                                                                               | Result                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| AC-2            | `npx vitest run src/app/version.test.ts` (set, unset, empty)                                   | ✓ 3 tests pass                                                                                                           |
|                 | **Broke it:** temporarily changed `\|\|` to `??` in `config.ts`, then restored it              | `× returns "unknown" when GIT_SHA is empty`, 1 failed, so the test really checks the empty case                          |
|                 | By hand: `npm run build`, then `npm start`, then `curl /version`                               | `{"sha":"06f9dcc"}`, the same as `git rev-parse --short=7 HEAD`. With `GIT_SHA=preset1` already set it returns `preset1` |
| AC-9            | Not changed: the factories already matched the clarified signature                             | ✓ The smoke test still starts the app                                                                                    |
| AC-1, AC-3–AC-8 | Not affected. `npm run check`, and the commit went through the pre-commit and commit-msg hooks | ✓ format, lint, typecheck, `deps:check`, 4/4 tests and build pass, exit 0                                                |

### Not verified locally

- **Pre-push hook and CI on the new commit:** I didn't push, so neither has run on it.

### Open ambiguity

- **Empty `GIT_SHA` in the launcher.** FR-2 says the launcher "keeps an existing `GIT_SHA`". `scripts/start.mjs` treats an empty `GIT_SHA=` as existing and keeps it, so `/version` returns `"unknown"` instead of the real SHA. That fits a literal reading of the spec, so I left it as is. If the launcher should treat empty as unset, the spec needs a change first, and then a one-line code fix.
