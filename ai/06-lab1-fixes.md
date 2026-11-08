# 06 — Lab 1 fixes

New chat on branch `lab1-fixes`. Run after `56edc98` and `ec3c5a1`, which split out `shared/kernel` in the architecture doc and added AC-7 (i) to the spec.

## Prompt

> Hi! Read docs/architecture.md#rules and specs/01-foundation.md; they were updated in the last commits. Align .dependency-cruiser.mjs with them (domain may import only src/shared/kernel/). Do not change specs/, standards/, docs/, adr/, ai/ or README.md; if something is wrong, stop and tell me. Verify AC-7 (h) and (i) by adding temporary imports, then remove them. Commit with Conventional Commits and report how you verified it.

## Answer

I updated `.dependency-cruiser.mjs` to match the new rules and committed it as `32f3bea build(deps): restrict domain to shared/kernel and isolate the kernel`. The pre-commit and commit-msg hooks passed.

### What changed

- **`layer-domain`:** `domain` can now import only `src/shared/kernel/` and its own `domain/`. Before, it could import anything in `src/shared/`.
- **`shared-kernel-only-kernel` (new):** `shared/kernel` can't import anything else in `src/`, including the rest of `shared`.
- **`shared-kernel-no-npm` (new):** `shared/kernel` can't use npm packages. Node built-ins are still allowed, as `docs/architecture.md#rules` says.

I added the two kernel rules because the architecture doc now defines the kernel this way. Without them, the kernel could pull in `fastify` and bring back the same indirect route to a package.

### How I verified it

For each case I added one temporary file, ran `depcruise src --config .dependency-cruiser.mjs`, then deleted the file.

| Case                                                               | Exit | Rule that fired             |
| ------------------------------------------------------------------ | ---- | --------------------------- |
| AC-7 (h): `import 'fastify'` in `movies/domain`                    | 1    | `layer-domain-no-npm`       |
| AC-7 (i): `import type` from `shared/module.ts` in `movies/domain` | 1    | `layer-domain`              |
| Control: `movies/domain` imports `shared/kernel/k.ts`              | 0    | allowed, as intended        |
| `shared/kernel` imports `shared/module.ts`                         | 1    | `shared-kernel-only-kernel` |
| `shared/kernel` imports `fastify`                                  | 1    | `shared-kernel-no-npm`      |

On my first try the control case failed with `not-to-unresolvable`, because my script hadn't created `src/shared/kernel/` and the import had nothing to resolve to. I reran it with the directory in place and it passed. That failure was a fault in my script, not in the rule.

On the clean tree, `deps:check` finds no violations and the full `npm run check` passes (8/8 tests). After cleanup, `git status` showed only the config change. All temporary files are gone, and there's no `kernel/` folder, since the doc says folders appear only when code does.

### One issue in the spec (I didn't edit it)

In `specs/01-foundation.md`, AC-7 now reads "…(h) …; `npm run deps:check` exits non-zero for each, (i) an import of `shared/module.ts` in `movies/domain`." So (i) comes after the "exits non-zero for each" clause, which makes it read as outside the check. I took it to mean that (i) must also fail, which is what I tested. You may want to move (i) before the semicolon.

## My notes

The agent added two kernel rules (no npm, no imports from the rest of shared) on its own; they follow from the updated architecture rules, so I accepted them. It also found that AC-7 (i) was placed outside the check; fixed in the spec.

My own check of AC-7 (i): a temporary `import type` of `shared/module.ts` in `movies/domain`:

```text
error layer-domain: src/modules/movies/domain/x.ts → src/shared/module.ts
x 1 dependency violations (1 errors, 0 warnings).
```
