# 01 — Spec review

## Prompt

> Hi! Please, read specs/01-foundation.md, docs/architecture.md, standards/ and README.md. Find contradictions between these files, unclear or unverifiable requirements, and missing acceptance criteria (every FR/NFR must be covered). Ask me questions. Do not write or change any code or files.

## Answer

I read all 7 files: the spec, `docs/architecture.md`, `README.md`, and the 4 files in `standards/`. I didn't change anything. Findings are grouped below, most important first, and each ends with a question for you.

### A. Contradictions

**A1. Tariffs exist in some docs but not in the design.** `README.md:15` lists "Tariffs: ticket prices per showtime or seat type", and `definition-of-done.md:15` gives "total price = sum of seat tariffs" as an example. But the architecture has no `tariffs` module, no `Tariff` entity and no "seat type", and the spec's module list (`01-foundation.md:23`) leaves it out too.
→ **Q1:** Are tariffs in scope for the course? If yes, which module owns them (`showtimes`? `seats`? a new `tariffs` module?), and should Lab 1's module list include them now?

**A2. The rules forbid every import from `shared`.** The spec says "Only the dependencies shown in the graph are allowed; everything else is forbidden" (`01-foundation.md:27`). The graph doesn't include `shared`, so read literally, no module may import from it.
→ **Q2:** Can every module import `shared`? Should that be stated, or drawn in the graph?

**A3. The data design describes work the spec puts out of scope.** The Data section and the update scenarios (`01-foundation.md:31-40`) describe PK constraints, transactions and a `409` response. "Out of scope" (`:53`) excludes "Domain logic and DB schema implementation". `spec-format.md:9` also says a spec "describes only what changes in this lab". So these rules are neither done nor verified in Lab 1.
→ **Q3:** Should these data invariants move to `docs/architecture.md` (or to the bookings lab spec)? Or are they a deliberate design preview, labelled as "not implemented in this lab"?

**A4. Is there a database in Lab 1?** FR-1 says `/health` works "without touching the database", which suggests the app connects to a DB in Lab 1. The schema is out of scope, though, and Drizzle/PostgreSQL aren't mentioned anywhere in the spec. Meanwhile `checks.md:20` says CI runs `npm run check`, including `test:func` against a PostgreSQL service container.
→ **Q4:** Does Lab 1 add a DB connection, a Drizzle config and a Postgres service in CI? Or does `test:func` run against nothing yet? Also, with zero test files Vitest exits non-zero by default. Is `--passWithNoTests` acceptable, or must there be at least one real unit and one functional test?

**A5. "Tests" in hooks is ambiguous.** `README.md:22` says hooks run "tests". `checks.md` runs functional tests in CI only.
→ **Q5:** Should the README say "unit + smoke tests"?

**A6. The AC format doesn't match the standard.** The standard is `AC-N (covers FR-X): … — check: …` (`spec-format.md:28`). The spec writes `AC-1 (FR-1)` without "covers". AC-6 and AC-8 have no `— check:` part at all.
→ **Q6:** Should I treat the standard's format as binding, so the spec needs fixing?

**A7. Lab 1 makes stack and structure decisions but has no ADRs.** `definition-of-done.md:22` requires an ADR for decisions that change structure, stack or module boundaries. Lab 1 makes exactly those decisions: Fastify, Drizzle, a modular monolith, the layering. The `adr/` directory linked from `README.md:42` doesn't exist, and the spec has no AC for ADRs.
→ **Q7:** Which ADRs are expected for Lab 1, if any? Should an AC cover them?

**A8. The ER diagram may be wrong about genres.** `Genre ||--|{ MovieGenre` means every genre must have at least one movie, so you couldn't create an empty genre.
→ **Q8:** Is that intended, or should it be `||--o{`?

### B. Unclear or unverifiable requirements

**B1. FR-2 (`/version`) leaves the details open:**
- **Response format:** plain text or JSON, and if JSON, what key (e.g. `{ "sha": "…" }`)?
- **SHA length:** short or full? AC-2 uses `--short`, FR-2 doesn't say.
- **Source:** "SHA of the running build" could mean baked in at build time (env var or generated file) or read at runtime via `git`. What happens outside a git repo, or with a dirty tree? Is there a fallback such as `"unknown"`, or should startup fail?

→ **Q9:** Which of these do you want?

**B2. FR-1's "without touching the database" can't be checked as written.** AC-1 checks only the status 200, not the body `{ "status": "ok" }`, and not DB independence.
→ **Q10:** Should the check be "smoke test passes with no `DATABASE_URL` / DB unreachable, and the body equals `{status:"ok"}`"?

**B3. Where do `/health` and `/version` live?** None of the 6 modules fits. Is it an app-level route, `shared`, or a new `system` module? Related: where is the composition root that wires infrastructure adapters to `application/ports`, and is it exempt from the boundary rules?
→ **Q11:** Where do these live?

**B4. The layer rules are ambiguous** (`01-foundation.md:28`):
- May `http` or `infrastructure` import `domain` directly (e.g. entity types in repositories)? Or only through `application`?
- What may a module's `index.ts` export: application services only, or domain types too?
- Must every module have all four layers in Lab 1, even when empty?

→ **Q12:** How should these be read?

**B5. "Booking seats" rules leave gaps.** These are relevant if A3 keeps them in the spec:
- What counts as an "active" booking? Is `RESERVED` the only non-cancelled status, or are there others (e.g. `CONFIRMED`)?
- Deleting `BookingSeat` rows on cancel loses the record of which seats a cancelled booking held. Is that acceptable?
- How is "all `BookingSeat` rows have the booking's showtime" enforced: a composite FK `(booking_id, showtime_id)`, or application code?
- Missing invariant: a seat must belong to the showtime's hall.

→ **Q13:** How do you want these settled?

**B6. Formatting may never block a commit.** If lint-staged runs `prettier --write`, a formatting error gets auto-fixed instead of rejected.
→ **Q14:** Should pre-commit auto-fix or check-and-fail? The same question applies to `eslint --fix`.

**B7. AC-3 may not fail with default ESLint settings.** An unused variable only rejects the commit if `no-unused-vars` is an *error* or ESLint runs with `--max-warnings 0`.
→ **Q15:** Should the spec say "warnings fail"?

**B8. Commitlint's config isn't specified.**
→ **Q16:** Is it `@commitlint/config-conventional` as-is, or are scopes restricted (your history uses `docs(spec)`, `docs(standards)`)?

**B9. "pre-commit must take a few seconds"** (`checks.md:18`) can't be verified.
→ **Q17:** Should it be a number (e.g. < 10 s), or just guidance?

**B10. Nothing pins the Node version.**
→ **Q18:** Should Lab 1 pin it via `engines` / `.nvmrc`, and should CI use the same version?

### C. Missing acceptance criteria (FR/NFR coverage)

| Req | Current AC | Gap |
|---|---|---|
| FR-1 | AC-1 | Body and DB independence not checked (B2) |
| FR-2 | AC-2 | Manual `curl` only, not automated in CI. Format undefined (B1) |
| **NFR-1 (Prettier)** | AC-3 covers lint only | **Nothing checks formatting.** E.g. "`npm run format` (check mode) fails on a misformatted file" |
| **NFR-2 (strict)** | AC-4 | Any type error passes AC-4, so **nothing checks strict mode.** E.g. push code with an implicit `any`, or check `strict: true` |
| NFR-3 | AC-3/4/5 | Pre-push also runs deps:check, unit tests, smoke and build, and none of these is shown to block a push. Is one example enough? |
| NFR-4 | AC-6, AC-7 | No AC for: (a) a **forbidden module-to-module dependency via `index.ts`** (e.g. `movies` → `bookings`); (b) **intra-module layer rules** (e.g. `domain` → `infrastructure`); (c) **`shared` → module**; (d) a **deliberately introduced cycle** being caught (AC-6 only checks the current state) |
| **NFR-5** | AC-8 | "Green on the lab PR" doesn't prove CI runs **on every PR**, runs **`npm run check`**, or **fails** when it should. E.g. a PR with a lint error shows a red check. Is branch protection required? |
| Goal: "module structure" | none | No AC checks that the 6 modules + `shared` with their layer folders exist |

Also: DoD says "every new user flow has a functional test with a real DB". Do `/health` and `/version` count as user flows needing `test:func` tests, or are smoke/unit tests enough?
→ **Q19:** Which of these ACs do you want added?

### D. Minor

- `README.md:40`: the link `./specs/NN-<short-name>.md` is a placeholder and doesn't resolve.
- The "Good" AC example in `spec-format.md:31` labels a lint check as NFR-2, but in your spec NFR-2 is type checking. It's only an example, but confusing.
- Auth: the README mentions admins vs users, but no role concept appears in the ER or modules. That's fine for Lab 1, but I'm noting it for later.
- Is `git commit --no-verify` considered acceptable bypass, given CI is the backstop?

The most important questions are **Q3/Q4** (what Lab 1 actually includes regarding the DB), **Q9** (`/version` contract), **Q11** (where health/version live) and **Q19** (which missing ACs to add). Answering those unblocks most of the rest.
