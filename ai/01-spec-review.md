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

---

## Prompt 2

> Q1: Tariffs are out of scope. Removed from README and from the DoD example.
> Q2: Every module may import shared. Added as a rule.
> Q3: Data and scenarios stay in the spec (the lab requires them), labelled "design only, implemented in the bookings lab". spec-format allows design-only sections.
> Q4: No database in Lab 1: no Drizzle config, no Postgres in CI, no functional tests yet. Tests in Lab 1: smoke + unit, no --passWithNoTests.
> Q5: README now says "unit + smoke tests".
> Q6: The standard's AC format is binding. Spec fixed.
> Q7: Two ADRs: 0001 modular monolith + layering, 0002 Drizzle ORM. No AC, DoD covers it.
> Q8: Genre ||--o{ MovieGenre. Fixed in docs/architecture.md.
> Q9: JSON { "sha": "<short sha>" }, taken from GIT_SHA set at build time; "unknown" if not set.
> Q10: Yes: smoke test runs without DATABASE_URL and checks status and body.
> Q11: /health and /version live in src/app/ (composition root + system routes). app may import modules; modules must not import app.
> Q12: infrastructure may import domain. index.ts exports application services and types consumers need. Layer folders appear when code appears; in Lab 1 a module is just index.ts.
> Q13: Active = RESERVED or PAID. Losing seat history on cancel is acceptable for now. Enforcing same showtime and "seat belongs to the showtime's hall" is decided in the bookings lab (out of scope).
> Q14: Check-and-fail: prettier --check, eslint without --fix.
> Q15: Yes, --max-warnings 0.
> Q16: @commitlint/config-conventional as-is.
> Q17: Guidance only, reworded as "should".
> Q18: Yes: .nvmrc + engines; CI uses .nvmrc.
> Q19: Added ACs for formatting, strict mode, forbidden module dependency, layer violation, CI failing on a bad PR, project structure.
> Minor: README link fixed; spec-format example relabelled NFR-1; --no-verify is acceptable because CI is the backstop; roles are noted for the auth lab.
>
> Please confirm these answers don't create new contradictions. Do not change any files.

## Answer 2

Your answers hold together for the most part. Two things need attention before you rely on them.

### 0. Most of the fixes you listed aren't in the files yet

`git status` shows only `README.md` as modified. In the README, Q1, Q5 and the link fix are done. Everything else you described as fixed is unchanged on disk:
- **Spec:** ACs, rules, FR-2, `src/app`.
- **`docs/architecture.md`:** the `Genre ||--o{` change.
- **DoD:** the tariff example.
- **`spec-format.md`:** the example label and the design-only allowance.
- **`checks.md`:** CI, functional tests, the "should" wording.
- **ADRs:** `adr/` doesn't exist.

Maybe you haven't saved or written them yet. Everything below checks your answers as written, not the files.

### 1. New contradictions your answers create

1. **Q4 conflicts with existing standards and with itself.**
   - `checks.md:12,20` say CI runs functional tests with a PostgreSQL service.
   - `definition-of-done.md:7` lists functional tests as part of `npm run check`.
   - `definition-of-done.md:16` requires a functional test with a real DB for every new user flow, and `/health` and `/version` are new flows.
   - "No `--passWithNoTests`" means `npm run check` fails if it still calls `test:func` with zero test files.

   → Does `test:func` leave `npm run check` until the bookings lab? Does the DoD get a Lab 1 exemption, or does `checks.md` mark functional tests "from lab NN"? Also, which unit test exists in Lab 1? The `GIT_SHA` → `"unknown"` fallback is the obvious candidate.

2. **Q13's `PAID` status conflicts with payments being out of scope** (spec, and now the README). No flow can reach `PAID`, and the "Book seats" scenario only creates `RESERVED`. → Should `PAID` be dropped for now, or kept with a note like "set by the payments feature, not in this course"?

3. **Q9 + AC-2: "set at build time" doesn't fit the build.**
   - The build is plain `tsc`, and `tsc` can't inject env vars. So `GIT_SHA` is really read from the environment at startup, unless the build generates a file.
   - Locally and in the pre-push smoke test, `GIT_SHA` is unset, so `/version` returns `"unknown"`. AC-2 (`= git rev-parse --short HEAD`) then only passes if the check sets `GIT_SHA` explicitly.
   - `--short` length isn't fixed. It's 7 by default but grows when abbreviations collide. CI has to produce the SHA the same way the check does.

   → Should I read "build time" as "process env at start, set by CI/start script"? And what exactly does the AC-2 check run?

4. **Q11 (`src/app/`) and Q2 (`shared`) conflict with the "only graph dependencies" rule.** `01-foundation.md:27` still forbids everything not in the graph, and the graph has neither `app` nor `shared`.
   - Both exceptions need to be written into the rule.
   - Does `app` import modules only via `index.ts`, or may the composition root reach `infrastructure` adapters to wire ports? Usually it has to, and the rule should say so.
   - Must `shared` not import `app`?

5. **Q12 + Q19: two of the new ACs have nothing to check in Lab 1.** A Lab 1 module is just `index.ts`, so:
   - The "layer violation" AC only works by adding temporary layer files during the check. That's fine, but the check text should say so.
   - The "project structure" AC should check exactly `src/app`, `src/shared`, and 6 × `src/modules/*/index.ts`, not layer folders.

   The rule text on line 28 also needs updating for "infrastructure may import domain". You didn't say whether `http` may import `domain`.

6. **Q3 needs a change to `spec-format.md`.** Right now it says Design is for when "the lab changes structure or data" and a spec "describes only what changes in this lab". Nothing allows design-only sections, so that has to be added before the spec can rely on it.

   The Q13 deferrals (how same-showtime and seat-in-hall are enforced) should go under *Out of scope*, not *Open questions*, because Open questions must be empty at submission.

7. **Q7 records a decision Lab 1 doesn't implement.** An ADR for Drizzle in a lab with no Drizzle is fine as long as its status and wording make clear it's a forward decision. Also, Fastify is a stack choice with no ADR. Is that deliberate?

8. **Your `--no-verify` answer assumes CI blocks merges.** "CI is the backstop" holds only if branch protection requires the CI check on `main`. Otherwise a red PR can still be merged. Should the new AC for "CI fails on a bad PR" also cover "merge is blocked"?

### 2. Answers with no conflicts

Q1, Q5, Q6, Q8, Q10, Q14, Q15, Q16, Q17, Q18, the rest of the minor fixes, and the README changes.

- **Q16:** `"stuff"` is rejected by `config-conventional`, so AC-5 still works.
- **Q18:** keep the `engines` range consistent with the `.nvmrc` version, e.g. `.nvmrc` = `22`, engines `>=22 <23`.

I didn't change any files.

---

## Prompt 3

> Changes are not applied to file yet, I want to resolve everything first and only then apply fixes. About new contradictions:
>
> 1: test:func is not part of npm run check until the first DB lab (checks.md marks it). DoD: /health and /version are covered by smoke + unit tests. Lab 1 unit test: GIT_SHA fallback.
> 2: PAID comes with payments (out of scope). Active booking = RESERVED for now.
> 3: GIT_SHA is read from the environment at startup, set by CI / start script as `git rev-parse --short=7 HEAD`. AC-2: unit test (set → value, unset → "unknown") + manual run with GIT_SHA set.
> 4: Exceptions written into the rule: any module may import shared; shared imports no module and not app. app may import modules' index.ts and their infrastructure adapters to wire ports; modules must not import app.
> 5: Layer-violation check uses temporary files. Structure AC checks exactly src/app, src/shared, 6 × index.ts. http may not import domain.
> 6: spec-format now allows "design only" sections. Q13 deferrals are in Out of scope.
> 7: Three ADRs: 0001 modular monolith, 0002 Fastify, 0003 Drizzle (accepted, applied from the first DB lab).
> 8: Branch protection on main requires CI. AC-8 now also checks that a red PR can't be merged.
>
> Does this resolve all contradictions and doesn't create a new one?

## Answer 3

Almost. Six of your eight answers resolve their contradiction cleanly, but answers 3, 4 and 8 leave gaps or create new conflicts. Below, by point:

### Gaps to close

**1. Functional tests: three more places need updating.** You've decided `checks.md` marks `test:func` as "from the first DB lab". These lines also need the same change:
- `checks.md:20`: "CI: full `npm run check`, with PostgreSQL as a service container".
- `definition-of-done.md:7`: lists "functional tests" in `npm run check`.
- `definition-of-done.md:16`: says every new user flow needs a functional test with a real DB. It needs the exception you described: flows that don't touch the DB can be covered by smoke and unit tests.
- `checks.md:11`: the smoke test row says `GET /health → 200`. Per Q10, it should also check the body.

**3. `GIT_SHA`: two small fixes.**
- FR-2 still says "SHA of the running build". Reword it, e.g. "the commit SHA from `GIT_SHA`, or `"unknown"` if unset".
- `--short=7` means *at least* 7 characters. Git still lengthens it if the prefix is ambiguous. It works in practice, and the CI script and the AC-2 manual check both use the same command, so they stay consistent. Just don't describe it as "exactly 7".

**4. `app` → modules: one new conflict.**
- Spec line 26 says "a module is used by others only through its `index.ts`", but `app` now imports `infrastructure` directly. Reword it to "used by **other modules** only through its `index.ts`". The DoD already says "modules import each other", so it's fine.
- **New gap:** how does `app` register a module's HTTP routes? Under Q12, `index.ts` exports "application services and types". So either `index.ts` also exports a Fastify plugin from `http`, or `app` may import `http` too. Pick one; the dependency-cruiser rule depends on it.
- Say explicitly that `app` may import `shared`.
- **Consequence of "http may not import domain":** domain errors (e.g. seat taken → `409`) and DTOs have to reach `http` through `application`. That's fine, but ADR 0001 should mention it.

**5. "Exactly" in the structure AC is too strict.** Make it "at least, and no other modules". Otherwise:
- the server entry point (`main.ts` / `server.ts`) must live inside `src/app/`, or the AC fails;
- does `src/shared/` need an `index.ts`?
- the temporary layer-violation files must be deleted before the structure check runs, or they break "exactly".

**6. Watch the 1-page limit** (`spec-format.md:7`). There will be about 6 new ACs (≈14 total) plus the design-only Data and Scenarios sections, so the spec may no longer fit on one page.

**7. Make sure an ADR covers the layering decisions.** You first said 0001 would be "modular monolith + layering"; now it's just "modular monolith". ADR 0001 should still cover the layering rules and the `src/app` composition root, or they need an ADR of their own. Also: does 0003 Drizzle cover PostgreSQL, or is that a separate decision?

**8. Branch protection: two practical problems.**
- **On GitHub Free, branch protection and rulesets aren't enforced for private repos.** If the repo is private on a free plan, AC-8 can't pass. Is the repo public, or on Pro/Education?
- **As the repo owner, you're an admin and can bypass protection by default.** "A red PR can't be merged" only holds if you turn on "Do not allow bypassing the above settings".
- NFR-5 only says "CI runs on every PR". Add "and is required to merge", so AC-8's new check covers a stated requirement.

### Resolved cleanly

- **2:** "Active = RESERVED" fits the spec's rule that an active booking has at least one seat and a cancelled one has none.
- **The remaining items:** the design-only allowance, moving the deferrals to Out of scope, and the Fastify ADR.

Once you settle the open choices here (route registration in 4, "exactly" in 5, repo visibility/plan in 8), I don't see anything else conflicting. I didn't change any files.
