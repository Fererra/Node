# Lab 1: hook evidence (AC-3, AC-4, AC-5)

Run by hand in Git Bash on branch `lab1-fixes`, 2026-11-08. Each case uses a temporary `src/shared/tmp.ts`; all temporary files and the temporary commit were removed afterwards (`git status`: clean).

## AC-3a: misformatted file blocks the commit

```text
$ printf 'export const x = {a:1}\n' > src/shared/tmp.ts
$ git add src/shared/tmp.ts
$ git commit -m "test: tmp"
⋯ Backing up original state…
✔ Done backing up original state (e288078)!
⋯ Running tasks for staged files…
    * — 1 file
      ⋯ prettier --check --ignore-unknown
    *.{ts,mts,cts,js,mjs,cjs} — 1 file
      ⋯ eslint --max-warnings 0 --no-warn-ignored

✖ prettier --check --ignore-unknown
✖ eslint --max-warnings 0 --no-warn-ignored

✖ Failed to run tasks for staged files!
↓ Skipped staging changes from tasks…
⋯ Reverting to original state because of errors…
✔ Done reverting to original state!
⋯ Cleaning up temporary files…
✔ Done cleaning up temporary files!

✖ prettier --check --ignore-unknown:
Checking formatting...
[warn] src/shared/tmp.ts
[warn] Code style issues found in the above file. Run Prettier with --write to fix.

✖ Task killed: eslint --max-warnings 0 --no-warn-ignored
husky - pre-commit script failed (code 1)
```

The commit is blocked by Prettier. ESLint was only killed after Prettier failed (`Task killed`); it reported no lint error for this file.

## AC-3b: lint error blocks the commit

```text
$ printf 'const unused = 1;\nexport {};\n' > src/shared/tmp.ts
$ git add src/shared/tmp.ts
$ git commit -m "test: tmp"
⋯ Backing up original state…
✔ Done backing up original state (3f7d42e)!
⋯ Running tasks for staged files…
    * — 1 file
      ⋯ prettier --check --ignore-unknown
    *.{ts,mts,cts,js,mjs,cjs} — 1 file
      ⋯ eslint --max-warnings 0 --no-warn-ignored

✔ prettier --check --ignore-unknown
✖ eslint --max-warnings 0 --no-warn-ignored

✖ Failed to run tasks for staged files!
↓ Skipped staging changes from tasks…
⋯ Reverting to original state because of errors…
✔ Done reverting to original state!
⋯ Cleaning up temporary files…
✔ Done cleaning up temporary files!

✖ eslint --max-warnings 0 --no-warn-ignored:

C:\Users\Lenovo\OneDrive\Desktop\KPI\Study\3-course-1-semester\Node\src\shared\tmp.ts
  1:7  error  'unused' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 1 problem (1 error, 0 warnings)

husky - pre-commit script failed (code 1)
```

Prettier passes, so the commit is blocked by ESLint alone.

## AC-5: bad commit message is rejected

```text
$ git restore --staged src/shared/tmp.ts && rm src/shared/tmp.ts
$ git commit --allow-empty -m "stuff"
→ lint-staged could not find any staged files.
⧗   --- input ---
stuff
✖   subject may not be empty [subject-empty]
✖   type may not be empty [type-empty]

✖   found 2 problems, 0 warnings
ⓘ   Get help: https://github.com/conventional-changelog/commitlint/#what-is-commitlint

husky - commit-msg script failed (code 1)
```

Nothing is staged, so pre-commit has nothing to check; the commit is blocked by commitlint in `commit-msg`.

## AC-4: type error blocks the push

```text
$ printf 'export const n: number = "x";\n' > src/shared/tmp.ts
$ git add src/shared/tmp.ts
$ git commit --no-verify -m "test: tmp type error"
[lab1-fixes ab2fac9] test: tmp type error
 1 file changed, 1 insertion(+)
 create mode 100644 src/shared/tmp.ts

$ git push --set-upstream origin lab1-fixes

> cinema-booking-service@0.1.0 check:fast
> npm run typecheck && npm run deps:check && npm run test && npm run build


> cinema-booking-service@0.1.0 typecheck
> tsc --noEmit

src/shared/tmp.ts:1:14 - error TS2322: Type 'string' is not assignable to type 'number'.

1 export const n: number = "x";
               ~


Found 1 error in src/shared/tmp.ts:1

husky - pre-push script failed (code 2)
error: failed to push some refs to 'https://github.com/Fererra/Node.git'
```

The commit was made with `--no-verify` on purpose, so the bad code reaches the push. The pre-push hook runs `check:fast`, fails on `tsc`, and nothing is pushed (the branch was not created on the remote).

Cleanup (the commit was never pushed, so no shared history was rewritten):

```text
$ git reset --soft HEAD~1
$ git restore --staged src/shared/tmp.ts && rm src/shared/tmp.ts
$ git status
On branch lab1-fixes
nothing to commit, working tree clean
```
