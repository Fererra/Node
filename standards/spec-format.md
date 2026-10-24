# Spec format

## Rules

- One spec per lab: `specs/NN-<short-name>.md` (e.g. `specs/01-foundation.md`).
- Written by hand, before any code for this lab. Committed as a separate commit.
- Max 1 page. If it doesn't fit, the scope is too big — split it.
- A spec is changed only by commits. If implementation shows the spec was wrong or incomplete, the spec is fixed first, then the code.
- Shared architecture (modules, ER) lives in `docs/architecture.md`. A spec links to it and describes only what changes in this lab.

## Sections

| Section | Required | What goes there |
|---|---|---|
| Problem | yes | What is wrong or missing now, 1–3 sentences |
| Goal | yes | What will be true after this lab, 1–2 sentences |
| Functional requirements | yes | `FR-1`, `FR-2`, ... — what the system does |
| Non-functional requirements | if any | `NFR-1`, ... — quality: performance, security, tooling, structure |
| Design | if the lab changes structure or data | Modules and how they interact, data changes, key update scenarios. Link or diff to `docs/architecture.md` |
| Acceptance criteria | yes | `AC-1`, ... — each one covers at least one FR/NFR |
| Out of scope | yes | What is deliberately not done, and why if not obvious |
| Open questions | optional | Things not decided yet. Must be empty before the lab is submitted |

## Acceptance criteria rules

- Every FR/NFR is covered by at least one AC.
- Every AC says how it is checked: a command, a test, or a manual step.
- Format: `AC-N (covers FR-X): <what> — check: <how>`.

Good:
`AC-3 (covers NFR-2): a commit with a lint error is rejected — check: commit a file with an unused variable, hook exits non-zero`

Bad:
`AC-3: code quality is good` — not checkable.