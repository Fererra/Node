# 02 — Implementation

## Prompt

> Hi! Implement specs/01-foundation.md. Follow standards/ (checks.md, definition-of-done.md), docs/architecture.md#rules and adr/.
>
> Constraints:
>
> - Do not change any md file. If something in them is wrong or impossible, stop and tell me instead of working around it.
> - Commit in small steps with Conventional Commits, for example: project setup (TypeScript, .nvmrc, engines) → Prettier + ESLint → etc.
> - After each step run npm run check (once it exists) and fix failures before committing.
> - Include scripts/start.mjs in the ESLint and Prettier scope.
> - Once Prettier is set up, format the existing Markdown docs in a separate commit.
>
> At the end:
>
> - Go through AC-1…AC-9 one by one and report how each was verified (command and result). For AC-3, AC-4, AC-5 and AC-7 actually try to break them, show that it fails, then revert it.
> - List anything you could not verify locally.

## Answer

I've implemented `specs/01-foundation.md` in 8 commits on `lab1-foundation`, and `npm run check` passes. I didn't push anything. None of the md files turned out wrong or impossible, so there was nothing to stop and flag.

### Commits

1. `chore: set up TypeScript project with Node 26`: `.nvmrc` = `26`, `engines` = `>=26 <27`, a strict `tsconfig.json` and `tsconfig.build.json`, and `.gitattributes` to keep line endings LF.
2. `build: add Prettier and ESLint with typescript-eslint`: uses the strict type-checked preset with `--max-warnings 0`. `scripts/start.mjs` and the config files are covered by both tools.
3. `style(docs): format Markdown with Prettier`: whitespace-only changes.
4. `feat(app): add Fastify app with /health and /version`: adds Vitest and `scripts/start.mjs`.
5. `feat(modules): add six empty modules and wire them in app`
6. `build: enforce module and layer rules with dependency-cruiser`
7. `build: add git hooks with husky, lint-staged and commitlint`: this commit already went through its own hooks.
8. `ci: run npm run check on every pull request`

You committed ADR-0002 while I was working; that didn't interfere with anything.

### Acceptance criteria

| AC   | How I checked it                                                                                                                                                                         | Result                                                                                                                                                                                                                                                                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-1 | `npx vitest run --reporter=verbose` (smoke test with `DATABASE_URL` removed, using `inject`)                                                                                             | ✓ `/health` returns 200 `{"status":"ok"}`                                                                                                                                                                                                                                                                                                                                            |
| AC-2 | The same run covers both unit tests (`GIT_SHA` set → `abc1234`, unset → `unknown`). By hand: `npm run build`, then `npm start`, then `curl /version`                                     | `{"sha":"c7dffe9"}`, the same as `git rev-parse --short=7 HEAD`. With `GIT_SHA=preset1` already set it returns `preset1`. Run outside a git repo it returns `unknown` and the server still starts                                                                                                                                                                                    |
| AC-3 | **Broke it:** tried to commit a misformatted `.ts` file                                                                                                                                  | Prettier `[warn] … Code style issues`, commit exit 1 (ESLint also failed on it)                                                                                                                                                                                                                                                                                                      |
|      | **Broke it:** tried to commit a file with an unused variable                                                                                                                             | `error 'unused' is assigned a value but never used`, commit exit 1                                                                                                                                                                                                                                                                                                                   |
|      | **Broke it (extra):** the same rule downgraded to a warning                                                                                                                              | `ESLint found too many warnings (maximum: 0)`, commit exit 1                                                                                                                                                                                                                                                                                                                         |
| AC-4 | **Broke it:** committed with `--no-verify` and pushed to a throwaway local bare remote: a `string` assigned to `number`, then a parameter without a type                                 | `error TS2322` / `error TS7006`, `husky - pre-push script failed`, push exit 1, remote stayed empty. Check: a clean push went through (exit 0)                                                                                                                                                                                                                                       |
| AC-5 | **Broke it:** `git commit -m "stuff"`                                                                                                                                                    | `type may not be empty`, `subject may not be empty`, commit exit 1                                                                                                                                                                                                                                                                                                                   |
| AC-6 | `npm run deps:check`                                                                                                                                                                     | `✔ no dependency violations found`, exit 0                                                                                                                                                                                                                                                                                                                                           |
| AC-7 | **Broke it:** added temporary files for each case (a)–(g), ran `deps:check`, then removed them                                                                                           | Every case exits 1, each on its own rule: (a) `cross-module-only-via-index`, (b) `module-graph-movies`, (c) `layer-domain`, (d) `shared-not-to-modules-or-app`, (e) `modules-not-to-app`, (f) `cross-module-only-from-application`, (g) `cross-module-only-type-imports`. Check: the allowed `import type` from `showtimes/index.ts` in `bookings/application/ports` passes (exit 0) |
| AC-8 | Only partly checked: the workflow runs on `pull_request`, uses `node-version-file: .nvmrc` and runs `npm run check`. The lockfile includes the Linux native packages that `npm ci` needs | See below                                                                                                                                                                                                                                                                                                                                                                            |
| AC-9 | Listed the folders and grepped the code                                                                                                                                                  | `src/` contains only `app`, `modules`, `shared`. There are exactly 6 modules, each with only an `index.ts` that exports `create<Name>Module`. `app.ts` creates all 6, and the smoke test starts the app                                                                                                                                                                              |

All test files were removed afterwards; `git status` is clean apart from `adr/0003`.

### Not verified locally

- **AC-8 in full:** I haven't seen a CI run, a red PR, or a green lab PR, because that needs a push. Branch protection is also still to do: on `main`, require the `check` status and turn on "Do not allow bypassing" for admins. That's a GitHub setting I didn't change.
- **CI on Linux:** `npm ci` and `npm run check` were only run on Windows.
- **Hooks on other systems:** checked only through Git Bash on Windows.
- **`GIT_SHA` "set by CI":** the workflow doesn't set it, because CI never starts the server. That part matters once there's a deployment, which is out of scope.

### Decisions you may want to know about

- **TypeScript is pinned to 6.0.3.** The latest version is 7.0.2, but typescript-eslint 8.72 only supports `<6.1.0`.
- **Factories take no `deps` yet.** The architecture says `create<Name>Module(deps)` typed by the module's own ports, but there are no ports in Lab 1. The order in `app.ts` is already the dependency order, so adding `deps` later won't need reordering.
- **An empty `GIT_SHA` is treated as unset.** `/version` returns `unknown`, while the launcher still keeps an existing value as the spec says.
- **The README still says "Getting started: TODO".** I couldn't edit md files; it could now list `npm ci`, `npm run check` and `npm start`.
