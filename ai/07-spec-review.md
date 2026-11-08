# 07 — Spec review (Lab 2)

## Prompt

> Read specs/02-working-app.md, docs/architecture.md, adr/ (especially 0004), standards/ and README.md. This is the spec for Lab 2: the main scenarios first on in-memory data, then on PostgreSQL. Find contradictions between these files, unclear or unverifiable requirements, edge cases the spec misses, and acceptance criteria that don't cover an FR/NFR. Ask me questions. Do not write code or change any files.

## Answer

I read all the files and the current `src/` skeleton. I didn't change anything. Findings are below, most important first. Each one ends with a question for you.

### A. Contradictions

**A1. "Nothing booked" on a 409 can't hold in the in-memory stage.** ADR-0004:92 says the in-memory `UnitOfWork` runs `work` with no transaction. If seat 3 of 3 is taken after seats 1 and 2 were already written, they stay written. But AC-5 requires FR-4 "`409` … (nothing booked)" and must pass on the in-memory commit (AC-1).
→ Should the in-memory repository check every seat before writing any, or should the in-memory UoW do a simple snapshot/rollback?

**A2. FR-3 can't live in `showtimes`.** `taken` comes from `booking_seat`, which `bookings` owns. `showtimes` can't depend on `bookings`, because `bookings → showtimes` already exists and that would be a cycle (architecture.md:16). `seats` can't depend on it either. So `GET /showtimes/:id/seats` has to be served by the `bookings` module, or the graph has to change.
→ Which module owns this route? The spec should say.

**A3. FR-6 needs movie data, but `bookings` doesn't depend on `movies`.** The graph only has `bookings → showtimes → movies`. The movie title has to come through the showtimes port. With NFR-7 that port also needs a batch method (`getByIds`), or AC-10 for FR-6 fails.
→ Is going through `showtimes` the intended path?

**A4. The smoke test vs NFR-5.** checks.md:16 and spec-01 AC-1 say the app starts without `DATABASE_URL` and `/health` returns 200, and pre-push "needs no database". NFR-5 says the app exits if the DB is unavailable.
→ After the DB commit, does the smoke test start the app in in-memory mode (via a config switch), or does it change? If it changes, checks.md has to be updated first, per DoD.

**A5. Where do the in-memory scenario tests run?** checks.md:12 defines functional tests as "Vitest + inject + PostgreSQL, CI only". AC-1 wants the same tests to pass on the in-memory commit, where there's no PostgreSQL. ADR-0003:45 and checks.md:33 also expect a `test:func` script and migrations, which spec-02 never mentions.
→ On the in-memory commit, are these tests part of `npm test` (pre-push)? On the DB commit, do they move to `test:func`?

**A6. "Pass unchanged" vs a different setup.** In the DB stage the tests need a fresh database, migrations and a seed (NFR-8). In memory they need none of that.
→ Does "unchanged" mean the test files themselves are unchanged and only a shared setup/helper changes?

**A7. AC-9 tests retries where they don't exist.** ADR-0004:89 puts retries inside the DB `uow.run` in `shared/db`. The in-memory UoW doesn't retry. A "unit test with a fake repository" therefore tests either nothing or a real Drizzle UoW.
→ Is the retry loop meant to be a separate pure function (`withRetry`) that can be unit-tested, or is AC-9 really an integration test against PostgreSQL?

**A8. 40001 can't happen at the default isolation level.** Under READ COMMITTED, the parallel booking in AC-3 fails with `23505` (unique/PK violation, so 409) and never produces `40001`. Deadlocks (`40P01`) are possible if two bookings insert overlapping seats in a different order.
→ Which isolation level do you use? Do you sort `seatIds` before inserting? What happens after 3 failed retries: `503`, `500`, `409`? And does "up to 3 times" mean 3 attempts in total, or 1 plus 3 retries?

**A9. Small wording mismatches.**

- ADR-0004:81 says `shared/db` is "used only by module `infrastructure` layers", but architecture.md:42 and AC-8 also allow `src/app/`.
- The `UnitOfWork` port is in `src/shared/`, while architecture.md:50 says "Ports live in `application/ports/`". An exception needs to be written down.
- README:3 and :11 (admins manage movies, sign up/log in) conflict with spec-02 out of scope. README Getting started has no Docker/DB steps, and its `npm start` will now exit without a DB.

### B. Unclear or unverifiable requirements

**B1. The meaning of "showtime started".** Is it `starts_at <= now`? Is the clock the app's `Date.now()` or the database's `now()` inside the transaction? To test the `422 showtime started` case (AC-5), and FR-2 "future" deterministically, you need either an injectable clock port or a seed showtime in the past/near future.
→ Which one?

**B2. Error `code` values aren't listed.** FR-9 fixes the shape of the error body, but AC-5 can only check status and shape, not that the right code came back. Several requests also aren't covered by the error column:

- Fastify schema-validation errors and 404 for an unknown route also need the FR-9 body ("All errors").
- `500`: is the message generic?

→ Should there be a code table (`SEAT_TAKEN`, `IDEMPOTENCY_KEY_REUSED`, …)?

**B3. Response bodies aren't specified.**

- FR-4 `201`: what body?
- FR-5: what does the `200` body contain?
- Idempotent replay: `201` again or `200`?
- FR-1, FR-2 and FR-6: what ordering? FR-6: are cancelled bookings included?

**B4. The order of checks in FR-4 isn't defined.** For example, a missing key plus empty `seatIds`, an unknown showtime plus a bad seat, or a taken seat plus a seat outside the hall. Also unclear:

- Is the idempotency check done before or after validation?
- Is the 401 always first?
- Is a nonexistent `seatId` a `422` "not in hall" or a `404`?
- Is a non-UUID `showtimeId`/`seatIds` a `400` (it isn't listed)?
- FR-5 has no `400 bad id`, unlike FR-2 and FR-3.

**B5. FR-5 edge cases.**

- Cancelling an already-cancelled booking after its showtime started: `200` or `422`?
- Another user cancelling an already-cancelled booking: should be `404`; please confirm.

**B6. FR-7 details.**

- Is a malformed (non-UUID) `X-User-Id` a `401` or a `400`?
- Is a header sent on FR-1…FR-3 ignored, or validated?
- Who loads the user? ADR-0004 puts the `user` in the context in `onRequest`, which means a DB query on every request. Does that query count toward NFR-7?

**B7. FR-8 details.**

- Response header name?
- Any length or charset limits on a client-supplied `X-Request-Id` (log injection)?
- Format of a generated ID?
- "Every log line" can't hold for startup logs. Does it mean "every log line inside a request"?

### C. Idempotency edge cases

**C1.** Two requests with the same key **in parallel**: the second waits, gets `409`, or gets the replayed result?

**C2.** The first request with a key failed (`409`, `422`): is the error stored and replayed, or can the key be reused? The ER line `Booking |o--o{ IdempotencyKey` implies `booking_id` can be NULL, but nothing says when.

**C3.** How is `request_hash` computed? Is `seatIds: [a,b]` the same request as `[b,a]`?

**C4.** Replaying a key after the booking was cancelled: return the cancelled booking?

**C5.** Is there a maximum key length, and do keys expire?

**C6.** Is the key row written in the same transaction as the booking and replayed safely on retry? I assume yes, but the spec doesn't say.

### D. FR/NFR coverage gaps in the ACs

| Requirement                                                       | Gap                                                                                                                          |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| NFR-4 (one handler, no whole-function try/catch)                  | No AC. Lint rule? Review?                                                                                                    |
| NFR-8 (Docker, non-default port, separate DB per run, CI with PG) | No AC                                                                                                                        |
| NFR-6 "never on 409"                                              | Not tested (AC-9 only tests 40001 success)                                                                                   |
| NFR-7 "each endpoint"                                             | AC-10 covers only FR-1, FR-3, FR-6. FR-2, FR-4 (10 seats: one multi-row insert?) and FR-5 are missing                        |
| NFR-3 transaction propagation, pool passed once                   | AC-6 checks logs only. Nothing checks that a cross-module repository joins the transaction                                   |
| NFR-2 "routes know only HTTP; access checks in services"          | AC-8 checks imports only                                                                                                     |
| FR-1, FR-2, FR-3, FR-6 happy-path contents                        | AC-1 says it covers them but only points to AC-2/4/5. Nothing checks genre names, "future only", hall number, or FR-6 fields |
| FR-8 "returned in response", "generated if absent"                | AC-6 doesn't check either                                                                                                    |
| FR-9 `503` body                                                   | AC-7 is manual and checks only the status                                                                                    |
| DoD: unit test per business rule                                  | Max 10 seats, no duplicates, "started" and the spec-01 invariant (RESERVED ≥ 1 seat, CANCELLED 0 seats) have no unit-test AC |
| AC-1 "on both commits"                                            | How is it verified? Which commits (tag or hash in evidence)?                                                                 |

### E. Smaller gaps

- **Seed:** are the IDs fixed, so tests can send `X-User-Id`? Is the same seed source used in memory and in the DB? Does it include a past showtime? Where does the seed script live? If it's outside `src/`, AC-8's "drizzle only in infrastructure" isn't checked there, because depcruise only scans `src`.
- **Drizzle code location:** where do the schema and migrations live, `shared/db` or each module's `infrastructure`? With per-module schemas, the composite FK `booking_seat → booking` and FKs to `seat`/`showtime` cross module boundaries.
- **FR-3 for a past showtime:** allowed or `404`?
- **AC-3 at scale:** two parallel requests only. Should it also test N > 2, or overlapping multi-seat sets (the deadlock path from A8)?

### Questions in priority order

1. A1: how does the in-memory stage guarantee "nothing booked" on a 409?
2. A2/A3: which module serves FR-3, and does FR-6 get movie data through `showtimes`?
3. A4/A5/A6: smoke test after the DB commit, where scenario tests run per stage, and what "unchanged" means.
4. A7/A8: isolation level, what AC-9 actually tests, and the status after retries run out.
5. B1: clock source and the exact definition of "started".
6. C1–C3: idempotency for parallel requests, failed first requests, and hashing.
7. B2/B3: do you want an error-code table and response-body shapes in the spec?
8. D: should I propose the missing ACs (NFR-4, NFR-8, NFR-6 "never on 409", NFR-7 for the other endpoints, FR-8 header)?

---

## Prompt 2

> General: API contract details (error codes, response bodies, check order, idempotency rules) go to a new docs/api.md; the spec links to it to stay within one page. spec-format.md will say "shared architecture and API contract live in docs/".
> A1: The in-memory repository checks all seats first and writes only if all are free, synchronously, with no await between check and write.
> A2: FR-3 is served by bookings: hall via the showtimes port, seats via the seats port, taken from its own booking_seat. The graph doesn't change.
> A3: Yes, through the showtimes port with a batch method getByIds returning showtime + movie title. Rule: cross-module ports offer batch methods (NFR-7).
> A4/A5/A6: buildApp({ storage: 'memory' | 'postgres' }). Smoke test and npm test (pre-push) use memory; test:func (CI) runs the same scenario test files with postgres. "Unchanged" = test files unchanged, only setup differs. NFR-5 applies to postgres only. checks.md will be updated. Scripts: db:migrate, db:seed.
> A7: Retries are a pure withRetry function in shared (no npm), unit-tested; the DB uow.run uses it.
> A8: READ COMMITTED; seatIds sorted before insert; 23505 on the booking_seat PK -> 409; "3" = 3 attempts in total; exhausted -> 503. 40001 is rare at READ COMMITTED; retries mainly cover 40P01.
> A9: ADR-0004 will say "infrastructure and src/app/". Architecture: shared ports (UnitOfWork, Clock) live in src/shared/ as an exception. README is updated at the end of the lab.
> B1: started = starts_at <= now, now from a Clock port (app clock). Tests use a fixed clock; the seed builds times relative to now.
> B2: Yes, an error-code table in docs/api.md. Validation errors and unknown routes also use the FR-9 body; 500 -> INTERNAL_ERROR with a generic message.
> B3: 201 and cancel 200 return the same booking body { id, showtimeId, status, seats, createdAt }; replay -> 201 with the same body. Ordering: movies by title, showtimes by startsAt, my bookings by createdAt desc, including cancelled ones.
> B4: Order: 401 -> 400 (headers, body schema, UUIDs) -> idempotency (replay or 422) -> 404 showtime -> 422 started -> 422 seat not in hall (a nonexistent seat too) -> 409. FR-5 gets 400 bad id.
> B5: An already cancelled booking -> 200 always, even after start (status is checked first). Someone else's -> 404.
> B6: Malformed X-User-Id -> 401. The header is ignored on FR-1..FR-3. The user is loaded in a preHandler only on FR-4..FR-6 (one query, constant for NFR-7).
> B7: Response header X-Request-Id. A client ID is accepted if it matches [A-Za-z0-9_-]{1,64}, otherwise a UUID is generated. "Every log line" = every line within a request.
> C1: The key row is written in the same transaction as the booking; a parallel second request waits on the PK lock and, after the first commits, replays its result.
> C2: Failed requests are not stored; the key can be reused. booking_id is NOT NULL; ER becomes Booking ||--o{ IdempotencyKey.
> C3: Hash of { showtimeId, sorted seatIds }; [a,b] equals [b,a].
> C4: Replay returns the booking's current state (may be CANCELLED).
> C5: Key up to 255 chars; expiry is out of scope.
> C6: Same transaction; a retry rewrites both rows.
> D: One Drizzle schema in src/shared/db/schema/, migrations in drizzle/; cross-module FKs exist only at DB level. FR-3 for a past showtime is allowed. AC-3 gets an overlapping multi-seat case. Yes, please propose the missing ACs; I'll choose.
>
> I applied my answers to the files locally, not committed: specs/02-working-app.md, new docs/api.md, docs/architecture.md, adr/0004-request-context-and-transactions.md, standards/checks.md, standards/spec-format.md. I added the missing ACs myself (AC-1 changed, AC-9…AC-12). Re-read the diff (git diff and docs/api.md) and check it against my answers. Is anything unresolved, or are there new contradictions? Is every FR/NFR covered by an AC? Do not change any files.

## Answer 2

Most of your answers made it into the files correctly. I found two real contradictions, one mechanism that doesn't work as written, a few answers that didn't land, and NFR-8, which still has no AC. I didn't change any files.

### 1. Answers that didn't land, or landed differently

| Answer                                                    | Status                                                                                                                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A2: hall via the showtimes port, seats via the seats port | Only "served by `bookings`" is written down (architecture.md, spec FR-3). Which port provides what isn't stated anywhere. That's minor.                                                |
| A3: `getByIds` returns showtime + movie title             | The general batch rule is there. The fact that the showtimes port returns the movie title is not, and `showtimes` then needs its own batch call to `movies` for FR-6 to stay constant. |
| B6: the user is loaded in a `preHandler`                  | That's written in `docs/api.md:7`, but it conflicts with the order of checks (see 2.1). ADR-0004:57 still says `onRequest` starts the context with `{ requestId, user }`.              |
| A9 / ADR-0004 Decision                                    | It lists `context.ts`, `unit-of-work.ts` and `retry.ts`, but not `clock.ts`, which architecture.md does list.                                                                          |
| C6: a retry rewrites both rows                            | Implied by the rollback but not written. Fine as it is.                                                                                                                                |
| E (my first review): seed                                 | Still open: fixed IDs, one seed source for memory and postgres, and where the seed script lives. See 3.1.                                                                              |
| `npm start`                                               | Which storage it uses, and how it's chosen (env var? default?), isn't specified.                                                                                                       |
| A9: "README at the end of the lab"                        | Nothing records this (no AC, no DoD item), so it can get lost.                                                                                                                         |

### 2. New contradictions and problems

**2.1. The 401-before-400 order can't work with a `preHandler`** (`docs/api.md:7` vs `:43`). In Fastify, `preHandler` runs after body parsing and schema validation. A request with no `X-User-Id` and a bad body therefore gets `400`, not `401`. Malformed JSON also fails in the parsing step, which comes before `preValidation`. Only a route-level `onRequest` hook runs before every possible 400. That also matches ADR-0004:57.
→ Should the user be loaded in a route-level `onRequest` hook, with api.md and ADR-0004 saying so?

**2.2. "A parallel request with the same key waits and then replays" (`api.md:53`) doesn't happen with a plain implementation.** The second request's `SELECT` on the key doesn't see the first request's uncommitted row, so it continues. What happens next depends on insert order:

- If seats go in before the key, the second request blocks on the `booking_seat` PK and then gets `409 SEAT_TAKEN`. That's not a replay, and AC-4's parallel case still passes, because there is "one booking".
- If the key goes in before the seats (booking → key → seats, since `booking_id` is NOT NULL), it blocks on the key PK and gets `23505`. But the transaction is aborted by then, and `withRetry` only retries `40001`/`40P01`.

Replay needs an explicit step: on `23505` on the `idempotency_key` PK, roll back, then read the key in a new transaction and replay it (or return `422` if the hash differs).
→ Do you want that written down (insert order + the "key conflict → replay" step)? Should AC-4 also check that the second response is `201` with the same body?

**2.3. Fixed test clock vs a seed built relative to "now"** (spec Design:42, AC-12). `db:seed` runs as a CLI with the real time. Tests use a fixed clock. The seeded showtimes won't line up with the test's `now`, so AC-12's "a showtime at `now`" doesn't exist.
→ Should the seed be a function `seed(now)` that both `db:seed` and the test setup call with the clock's `now`?

**2.4. `createdAt desc` is non-deterministic under a fixed clock.** All bookings in a test get the same `createdAt`, so FR-6's order is undefined and an order assertion will be flaky. Two things are missing: a tiebreaker, and a rule that `created_at` comes from `Clock`, not from the DB default.
→ What should the tiebreaker be? Note that `id` is a random UUID.

**2.5. "Same files" isn't exactly true** (`checks.md:18`, AC-1). AC-3, AC-10 and AC-4's parallel case are postgres-only. `npm test` (`vitest run`) picks up every test file, so it needs a way to exclude these. You need a convention, such as `*.func.test.ts` or `describe.skipIf(storage === 'memory')`, and a rule for which files `test:func` includes.
→ Which convention do you want?

**2.6. AC-5 asks for "every error in `docs/api.md`"**, which includes `503` and `500`. Neither can come from a scenario test on the seed data, and AC-7 already makes `503` a manual check. AC-5 should either exclude them or say they are triggered with a fake repository that throws.

**2.7. AC-3 can't tell sorted inserts from retries.** Without sorting, `[a,b]` vs `[b,a]` deadlocks, gets `40P01`, is retried, and then returns `409`. The visible result is the same: one `201`, one `409`, "no deadlock error". To test the sorting itself, assert one attempt (from a retry counter or log) or check the insert order in a unit test.

**2.8. Schema in `shared/db/schema/` vs module boundaries.** Every module's `infrastructure` can import every table, so `bookings` can join `seat`/`showtime`/`movie` directly and skip the ports. That's especially tempting for AC-10. Nothing checks this.
→ Is it allowed (for example, read-only joins for queries), or forbidden by a rule like "infrastructure queries only its module's tables"? If it's forbidden, how is it checked?

**2.9. Small items**

- DoD line 7 still says CI "runs `npm run check`". It now also runs `test:func`.
- `checks.md:11` calls only the PostgreSQL tests "Vitest + `fastify.inject`", but the in-memory scenario tests use `inject` too.
- `api.md:45` reads as one chain (`already CANCELLED -> 200 -> 422 …`). It should be a branch: "if `CANCELLED` → `200`, else if started → `422`, else cancel".
- `Idempotency-Key` with an empty string: say "1–255 chars".
- FR-1: what order are `genres` in?
- AC-11: the `grep` only runs by hand. An ESLint `no-restricted-syntax: TryStatement` override for `http/**` and `application/**` would enforce it in pre-commit and CI. AC-11 is also stricter than NFR-4 ("whole functions"), and that's fine. But "one global error handler" from NFR-4 isn't checked at all.
- The spec is at the edge of one page, mostly because of the long FR table lines.

### 3. Still unresolved

**3.1. Seed.**

- Fixed UUIDs for the 2 users and key entities, so tests can send `X-User-Id`?
- One seed module shared by memory and postgres?
- Where does it live? If it's under `scripts/` it imports `drizzle-orm` outside `src/`, so AC-8 / depcruise don't see it. That's probably fine, but say so.

**3.2. `npm start` storage.** Which storage, chosen by which config, and what's the default?

**3.3. The two stages in AC-1.** How does a reviewer find "the in-memory commit": a tag, or a hash in `docs/evidence/`?

### 4. FR/NFR coverage by AC

| Req       | ACs                           | Gap                                                                                                                                                                                                                                                                           |
| --------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-1      | AC-1, AC-5, AC-10             | No AC checks the content (genre names, by title). AC-1 only says the tests run on both storages, not what they check.                                                                                                                                                         |
| FR-2      | AC-1, AC-5, AC-12             | OK. Order by `startsAt` isn't explicit.                                                                                                                                                                                                                                       |
| FR-3      | AC-2, AC-5, AC-10             | OK                                                                                                                                                                                                                                                                            |
| FR-4      | AC-2, AC-3, AC-4, AC-5, AC-12 | See 2.2 (parallel replay)                                                                                                                                                                                                                                                     |
| FR-5      | AC-2, AC-5                    | "Already cancelled → `200` even after start" (B5) isn't tested                                                                                                                                                                                                                |
| FR-6      | AC-1, AC-10                   | No AC checks the fields, cancelled-included or order (2.4)                                                                                                                                                                                                                    |
| FR-7      | AC-5                          | OK                                                                                                                                                                                                                                                                            |
| FR-8      | AC-6                          | OK                                                                                                                                                                                                                                                                            |
| FR-9      | AC-5, AC-7                    | See 2.6                                                                                                                                                                                                                                                                       |
| NFR-1     | AC-1                          | 3.3                                                                                                                                                                                                                                                                           |
| NFR-2     | AC-8                          | Imports only. "Access checks in services" isn't checked.                                                                                                                                                                                                                      |
| NFR-3     | AC-6                          | Logs only. No AC checks that cross-module repositories join one transaction, or that the pool is passed once.                                                                                                                                                                 |
| NFR-4     | AC-11                         | "One global error handler" isn't checked                                                                                                                                                                                                                                      |
| NFR-5     | AC-7                          | OK (manual)                                                                                                                                                                                                                                                                   |
| NFR-6     | AC-3, AC-9                    | Two gaps: nothing checks that exhausted retries become `503`, and `READ COMMITTED` is never asserted                                                                                                                                                                          |
| NFR-7     | AC-10                         | FR-2, FR-4 (10 seats), FR-5 aren't counted. That's your choice, but NFR-7 says "each endpoint".                                                                                                                                                                               |
| **NFR-8** | **none**                      | **Uncovered**: Docker on a non-default port, a fresh DB per run, `db:migrate`/`db:seed`, CI running `test:func`. One possible AC: "CI log shows `test:func` against the service container; `docker compose up` + `db:migrate` + `db:seed` from the README work; port ≠ 5432". |
| NFR-9     | AC-12                         | Depends on 2.3                                                                                                                                                                                                                                                                |

### Questions

1. 2.1: load the user in a route-level `onRequest` hook instead of `preHandler`?
2. 2.2: write down the insert order (booking → key → seats) and the "key PK conflict → roll back → replay" step, and make AC-4 assert that the second parallel response is the same `201` body?
3. 2.3 / 3.1: a `seed(now)` function shared by `db:seed`, memory storage and tests, with fixed UUIDs?
4. 2.4: what tiebreaker for `createdAt desc`, and does `created_at` come from `Clock`?
5. 2.5: how are postgres-only tests separated from `npm test`?
6. 2.8: may a module's infrastructure query other modules' tables?
7. 3.2: how does `npm start` choose its storage?
8. NFR-8: should I propose an AC wording, or do you have one?

---

## Prompt 3

> Round 2 answers:
>
> 2.1: A global onRequest hook starts the context with requestId; a route-level onRequest hook on FR-4…FR-6 loads the user. So 401 always comes before any 400.
> 2.2: Insert order in the transaction: booking -> idempotency_key -> booking_seat. A parallel request with the same key blocks on the key PK; after the first commits it gets 23505 -> rollback -> reads the key in a new transaction -> replays (or 422 if the hash differs). The AC checks both parallel responses are 201 with the same body.
> 2.3/3.1: buildSeed(now) in src/app/seed.ts returns plain data with fixed UUIDs. Used by db:seed (CLI in src/app/cli/, so depcruise sees it), by memory storage and by tests with now from Clock.
> 2.4: created_at comes from Clock; order created_at desc, id desc; tests advance the clock between bookings.
> 2.5: Scenario tests in test/scenarios/\*.test.ts run on both storages; postgres-only tests are \*.pg.test.ts and npm test excludes them.
> 2.6: Separate ACs: 4xx in scenario tests; 500 through a throwing fake (also checks the single global handler); 503 after retries in a unit test.
> 2.7: AC-4 asserts no retry happened for [a,b] vs [b,a].
> 2.8: A module's infrastructure queries only its own tables; other data comes through ports with batch methods. Schema stays in src/shared/db/schema/, one file per module; depcruise forbids importing another module's schema file.
> 2.9: DoD and checks.md updated; cancel order is a branch; key 1–255 chars; genres by name; try is forbidden by ESLint no-restricted-syntax in http/\*\* and application/\*\*.
> 3.2: STORAGE=memory|postgres, default postgres.
> 3.3: Tag lab2-in-memory on the last commit of the in-memory stage.
> A2/A3: Ports written in architecture: showtimes.getByIds -> showtime + movie title (showtimes batches titles from movies); seats.getByHall, seats.getByIds.
> Coverage: added ACs for response bodies, cancel-after-start, rollback across repositories, NFR-8. Not tool-checked on purpose: access checks in services and "pool passed once" (code review).
>
> Files updated locally again, not committed: specs/02-working-app.md, docs/api.md, docs/architecture.md, adr/0004-request-context-and-transactions.md, standards/checks.md, standards/definition-of-done.md. Re-read the diff and check it against my answers from both rounds. Anything unresolved or contradictory? Is every FR/NFR covered? Do not change any files.

## Answer 3

Your answers landed in five of the six files, but **`specs/02-working-app.md` didn't change this round**. It's byte-for-byte the version I reviewed last time. Its timestamp is 13:19, while `api.md`, `architecture.md`, ADR-0004 and `checks.md` are 13:34 and the DoD is 13:33. My guess is an unsaved editor buffer. Because the spec is stale, most of the coverage work isn't there yet, and two of the updated files now contradict it. I didn't change any files.

### 1. The spec is stale

None of these round-2 answers are in the spec yet:

- **No new ACs.** It still has AC-1…AC-12. There are no ACs for response bodies, cancel after start, rollback across repositories or NFR-8, and no separate 4xx/500/503 ACs (2.6).
- **AC-3** still says "no deadlock error". It doesn't assert that no retry happened (2.7). You wrote "AC-4" in your answer; I assume you meant AC-3.
- **AC-4**'s parallel case still only checks "one booking". It doesn't check that both responses are `201` with the same body (2.2).
- **AC-11** is still the manual `grep`. It doesn't mention the ESLint rule from `checks.md:6`.
- `STORAGE=memory|postgres` with default `postgres` (3.2), the `lab2-in-memory` tag (3.3) and `buildSeed(now)` (Design:42) are all missing.

**New mismatch caused by this:** ADR-0004 now points to the new numbering. Line 90 says `withRetry` is tested by "spec AC-11", and line 91 says context is tested by "AC-8". In the current spec those are the try/catch grep and the drizzle-import check. After you save the spec, please check that these numbers match.

### 2. Answers checked against the other files

| Answer                                            | Where                               | Status                                                                           |
| ------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| 2.1 onRequest (global + route-level)              | api.md:7, ADR:57                    | ✓                                                                                |
| 2.2 insert order, conflict → replay               | api.md:51–53, arch:119, ADR:99      | ✓ written, but see 3.1                                                           |
| 2.3 `buildSeed(now)`, CLI in `src/app/cli/`       | arch:52, checks:40                  | ✓ (spec Design not updated)                                                      |
| 2.4 `created_at` from Clock, `id desc` tiebreaker | api.md:19,21, arch:107              | ✓                                                                                |
| 2.5 `test/scenarios/`, `*.pg.test.ts`             | checks:10–11, 18–23                 | ✓                                                                                |
| 2.8 own tables only, one schema file per module   | arch:41, 58                         | ✓, but see 3.3 and 3.4                                                           |
| 2.9 DoD, cancel branch, key 1–255, genres, ESLint | DoD:7, api.md:14,23,31,45, checks:6 | ✓                                                                                |
| 3.2 `STORAGE` default `postgres`                  | only implied by `checks.md:10–11`   | ✗ not in the spec or architecture.md, which only mention `buildApp({ storage })` |
| 3.3 tag                                           | —                                   | ✗ (spec)                                                                         |
| A2/A3 port table                                  | arch:23–31                          | ✓, but one port is missing (3.3)                                                 |

### 3. New contradictions and problems

**3.1. Replay needs a `try` in `application`, which ESLint now forbids.** ADR:99 says the repository rolls back and "the service handles it (replay)". But the conflict aborts the whole `uow.run` transaction. So the service has to catch an error _outside_ `uow.run` and start a new one to read the key. That's a `try`/`catch` in `bookings/application`, and `checks.md:6` bans every `try` there. A whole-function try is also exactly what NFR-4 is about. Possible fixes:

- (a) a shared helper, such as `uow.runOrReplay(work, onConflict)` in `shared/db` or `withRetry` given a conflict handler, so the `catch` lives in `shared`;
- (b) `uow.run` returns a result type instead of throwing on a key conflict;
- (c) allow `.catch()` on the promise. The lint rule doesn't block that, but it gets around the rule's intent.

→ Which one?

**3.2. Tests share one database per run and only 2 seeded users.** `checks.md:23` creates a fresh DB per _run_, not per test or file, and Vitest runs files in parallel by default. Every test that books for user 1 changes the result of FR-6 "my bookings" for every other test. Two tests booking the same seed seat collide, so AC-3 and AC-4 become flaky. AC-10's "1 vs 20 items" depends on whatever other tests left behind. Memory storage has the same problem if one app instance is shared. Options:

- truncate and reseed before each test;
- one app/DB per file, with Vitest file parallelism off for `test:func`;
- each test uses its own showtime and seats, plus more seeded users.

→ Which one? It also decides whether "fresh DB per run" in NFR-8 and checks.md is the right wording.

**3.3. `showtimes` has no port to get the hall number.** `cinema_hall` belongs to `seats` (arch:99), and arch:41 says infrastructure queries only its own tables. But `showtimes.getByIds` returns `hallNumber` (arch:28), and FR-2 returns `hall: { id, number }`. The port table has no `showtimes → seats` entry, for example `seats.getHallsByIds(ids)`. The graph does allow `showtimes → seats`. Two wording points:

- the table says "all batch", but `seats.getByHall(hallId)` and `users.getById(id)` take a single id;
- that's fine (one hall or one user per request), but then say "batch where a list is involved".

**3.4. Cross-module FKs vs "one schema file per module".** For Drizzle to generate migrations with FKs, `bookings.ts` has to import `seat`/`showtime`/`users` from the other schema files (`references(() => seat.id)`). Arch:92 says cross-module FKs exist "only at the database level". That's fine, but it should say either:

- schema files may import each other for FKs (the depcruise rule restricts only `infrastructure → schema`), or
- cross-module FKs are written by hand in the SQL migrations.

→ Which one? Note that the first option lets `bookings.ts` re-export another module's table.

**3.5. `npm start` now needs a database by default.** With `STORAGE` defaulting to `postgres`, `npm run build && npm start; curl /version` in README:65–66 exits (NFR-5). So does the manual check in spec-01 AC-2. The README is planned for the end of the lab, but Lab 1's AC-2 is now only reproducible with `STORAGE=memory` or Docker running. I'd add one line about that to the README update.

**3.6. Small items**

- **Test setup and seeding:** `checks.md:23` says the fresh DB gets "migrations + seed". If the setup runs the `db:seed` CLI, it seeds with the real time while the tests use a fixed clock (my earlier 2.3). Say that test setup calls `buildSeed(clock.now())` directly.
- **AsyncLocalStorage in Fastify hooks:** `als.run(store, …)` inside an async `onRequest` doesn't carry over to later hooks or the handler. It only works with `run(store, done)` in a callback-style hook, or with `enterWith`. This is an implementation detail and not a spec fix, but it's the one thing in ADR:57 most likely to break AC-6.
- **"Own tables only":** the depcruise rule stops schema imports, not raw `` sql`… FROM seat` `` strings. That's fine, but code review has to catch it.
- **spec-format.md:20:** the Design row still says "Links to `docs/architecture.md`" and doesn't mention `api.md`.
- **Spec length:** once the new ACs go in, the spec will probably exceed one page. Shortening the FR table cells, since the details are now in `api.md`, would win it back.

### 4. FR/NFR coverage

Against the spec as it stands on disk, nothing has changed since round 2. **NFR-8 has no AC.** FR-1/FR-6 content, FR-5 cancel-after-start and NFR-3 transaction propagation are still uncovered, and AC-5 still includes `500`/`503`.

If the spec you meant to save has ACs for response bodies, cancel after start, rollback across repositories, NFR-8 and the separate 4xx/500/503 cases, then everything is covered except the two you're leaving on purpose. On those:

- **NFR-2 "access checks in services" and NFR-3 "pool passed once":** leaving them to code review is legitimate, and `spec-format.md:28` allows a "manual step". But the spec should say so. One way: append "; access checks and single pool creation — check: manual review" to AC-8 and AC-6. Otherwise a reader sees an NFR clause with no check.
- **NFR-7:** still only FR-1, FR-3 and FR-6 are counted. That was your choice last round; I'm only noting it.

Once the spec is saved I'll re-check that every AC has the `(covers …) — check:` format and that the ADR references match.

### Questions

1. The spec: can you save `specs/02-working-app.md` so I can review the real version?
2. 3.1: how does the service replay without a `try` in `application`: (a) a shared helper, (b) a result type, or (c) `.catch()`?
3. 3.2: how are tests isolated (reseed per test, DB per file with no file parallelism, or separate data per test)?
4. 3.3: add `seats.getHallsByIds` for `showtimes`?
5. 3.4: do schema files import each other for FKs, or are cross-module FKs SQL-only?
6. 3.2 of last round: should `STORAGE` and its default go into the spec (NFR-1) or architecture.md?

---

## Prompt 4

> Sorry, the spec wasn't saved last time; it is now. Round 3 answers:
>
> 3.1: No try or catch needed. The key is claimed first with INSERT … ON CONFLICT DO NOTHING RETURNING; under READ COMMITTED a parallel claim waits, then returns nothing and the committed key is visible, so the service replays. The FK idempotency_key.booking_id is DEFERRABLE INITIALLY DEFERRED, so the key goes first. Order: key -> checks -> booking -> booking_seat (ON CONFLICT DO NOTHING; fewer rows -> 409). Any failure rolls back the key too.
> 3.2: test:func runs files one at a time; the DB is migrated once per run and reset + reseeded before each test. Memory tests create a new buildApp per test.
> 3.3: Added seats.getHallsByIds for showtimes; the table says "batch where a list is involved".
> 3.4: Schema files may import each other for FKs; the depcruise rule applies only to module infrastructure.
> Old 3.2: STORAGE (default postgres) is in NFR-1.
> Coverage: manual review noted in AC-8 (pool created once) and AC-10 (access checks).
> AC numbering: in your previous note, AC-4 was right for the "no retry" case.
>
> Files updated locally, not committed: specs/02-working-app.md (saved), docs/api.md, docs/architecture.md, adr/0004-request-context-and-transactions.md, standards/checks.md. Re-read the diff and check it against my answers from all three rounds. Anything unresolved or contradictory? Do the ADR's AC references match the spec? Do not change any files.

## Answer 4

Everything now covers your answers from all three rounds. Every FR/NFR has an AC, and the ADR's AC references match the spec. I found one real contradiction (the in-memory stage vs claiming the key first), one stale sentence in ADR-0004, and a few small gaps. I didn't change any files.

### 1. ADR and other references

Every FR/NFR/AC reference in ADR-0004, `architecture.md` and `api.md` points to the right item:

| Where   | Reference    | Spec item                                                  | OK  |
| ------- | ------------ | ---------------------------------------------------------- | --- |
| ADR:11  | FR-8         | request ID in logs                                         | ✓   |
| ADR:14  | NFR-3, NFR-2 | context without parameters; SQL out of routes and services | ✓   |
| ADR:90  | AC-11        | `withRetry` unit tests                                     | ✓   |
| ADR:91  | AC-8         | `requestId`/`userId` in logs, test captures logs           | ✓   |
| ADR:93  | NFR-1        | two stages                                                 | ✓   |
| arch:32 | FR-4…FR-6    | user loading                                               | ✓   |

You were right about the numbering: AC-4 (the parallel bookings) is where "no retry" lives.

### 2. Answers checked against the files

| Answer                                                                            | Where                                  | Status                                       |
| --------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------- |
| 3.1 claim key first, deferred FK, `ON CONFLICT DO NOTHING`, no `try`              | api.md:51–55, arch:106,114,120, ADR:99 | ✓ for postgres; see 3.1 and 3.2 for the rest |
| 3.2 one file at a time, reset and reseed per test, new `buildApp` per memory test | checks.md:23, NFR-8                    | ✓, see 3.3                                   |
| 3.3 `seats.getHallsByIds`, "batch where a list is involved"                       | arch:23,27,41, NFR-7                   | ✓                                            |
| 3.4 schema files import each other for FKs                                        | arch:59                                | ✓                                            |
| Old 3.2 `STORAGE`, default `postgres`                                             | NFR-1, arch:52                         | ✓                                            |
| Old 3.3 tag `lab2-in-memory`                                                      | NFR-1, AC-1                            | ✓                                            |
| Manual review for "pool created once" and access checks                           | AC-8, AC-10                            | ✓                                            |
| Earlier rounds (contract, order of checks, ESLint, seed, clock, ports)            | spec, api.md, arch, checks, DoD        | ✓, nothing lost in the rewrite               |

The claim mechanism itself is sound under `READ COMMITTED`. The second `INSERT … ON CONFLICT DO NOTHING` waits for the first transaction. If that one commits, the insert returns no row, and the next `SELECT` takes a fresh snapshot and sees the committed key. If it rolls back, the second insert claims the key. Because the app generates IDs, the key can carry the booking ID before the booking row exists, and the deferred FK allows that.

### 3. Remaining problems

**3.1. Claiming the key first doesn't work in the in-memory stage.** ADR:93 (from A1) says in-memory repositories "check everything first and write only if all checks pass", because the in-memory UoW has no rollback. The documented order (api.md:51, arch:120) starts with a write: claim the key, then run the checks. In memory, a request that then fails with `404`/`422`/`409` leaves the key behind. That breaks two things:

- "a failed request stores nothing, so the key can be reused" (api.md:53);
- part of AC-5/AC-6 on the memory run.

The fix is one sentence in api.md or ADR:93: "in memory: look up the key → run all checks → write key, booking and seats in one synchronous step". The observable behaviour, including the check order in api.md:43, stays the same.

**3.2. ADR:100 still uses the old seat-conflict example.** It says repositories translate "the `booking_seat` primary key, `23505` -> 'seat taken' -> `409`". With `ON CONFLICT DO NOTHING` there's no `23505` on `booking_seat` any more. The repository returns a row count, and the service _throws_ `SeatTaken` inside `work` so that `uow.run` rolls back. That throw is fine: it's a throw, not a `try`. But the example now contradicts ADR:99 and api.md:51,55. It also helps to say explicitly that the 409 path rolls back because the service throws (api.md:51 only says "fewer rows → 409").

**3.3. Which database does `test:func` use locally?** NFR-8 used to say "a separate database per test run". Now it says "reset and reseed before each test", and checks.md:23 says "migrated once per run". Nothing says it's a _different_ database from the one `db:seed` fills for local development. If `test:func` uses the same `DATABASE_URL`, every run wipes your dev data.
→ Should there be a separate test database, for example `cinema_test` via its own `DATABASE_URL` in the test setup?

**3.4. Where does the "20 items" data for AC-12 come from?** FR-6 is easy, because the test creates 20 bookings. For FR-1 (20 movies) and FR-3 (a hall with 1 seat vs 20 seats) there's no admin API, and `buildSeed(now)` is the fixed seed. Either the seed contains those shapes (for example, a 1-seat hall and a 20-seat hall), or tests insert extra rows through a helper.
→ Which one? If it's a helper, the helper writes to every module's tables, so say it lives in `test/` and not in a module.

**3.5. Deferrable FK and Drizzle.** As far as I know, Drizzle's `foreignKey()` builder doesn't support `DEFERRABLE INITIALLY DEFERRED`; please check your version. If it doesn't, that one constraint has to be written in SQL in a migration. The next `drizzle-kit generate` may then try to "fix" it. Worth a line next to arch:106 if it turns out to be the case.

**3.6. Small items**

- **AC-4 "with no retry":** the check doesn't say how a test observes that. You need a retry counter or log line from `withRetry`, for example `attempt` in the log captured by the AC-8 helper.
- **AC-10 "a module imports only its own schema file":** that should be "a module's `infrastructure` …", since `application` can't import `shared/db/` at all.
- **spec-format.md:20:** the Design row still says "Links to `docs/architecture.md`", without `api.md`. This was raised last round and is still open.
- **Coverage gaps you're accepting:** `READ COMMITTED` itself isn't asserted by any AC, and NFR-7 query counts skip FR-2 and FR-5. Both are fine as deliberate choices.

### 4. Coverage

| Req   | ACs                                            |
| ----- | ---------------------------------------------- |
| FR-1  | AC-2, AC-6, AC-12                              |
| FR-2  | AC-2, AC-6, AC-13                              |
| FR-3  | AC-2, AC-3, AC-6, AC-12                        |
| FR-4  | AC-2, AC-3, AC-4, AC-5, AC-6, AC-12, AC-13     |
| FR-5  | AC-2, AC-3, AC-6                               |
| FR-6  | AC-2, AC-6, AC-12                              |
| FR-7  | AC-6                                           |
| FR-8  | AC-8                                           |
| FR-9  | AC-6, AC-7, AC-14                              |
| NFR-1 | AC-1                                           |
| NFR-2 | AC-9, AC-10 (access checks: manual review)     |
| NFR-3 | AC-8 (pool: manual review), AC-9               |
| NFR-4 | AC-7                                           |
| NFR-5 | AC-14                                          |
| NFR-6 | AC-4, AC-11                                    |
| NFR-7 | AC-12                                          |
| NFR-8 | AC-15                                          |
| NFR-9 | AC-13 (and the `createdAt` order through AC-2) |

Every AC follows the `(covers …): … — check: …` format. AC-8 and AC-10 have two `check:` parts, which is readable and fine. The spec is also back to about one page.

### Questions

1. 3.1: add the in-memory order (look up the key → checks → one synchronous write)?
2. 3.2: replace the `23505` example in ADR:100, and say that the 409 path rolls back because the service throws?
3. 3.3: does `test:func` use a separate test database?
4. 3.4: does the AC-12 data come from the seed or from a test helper?

---

## Prompt 5

> Round 4 answers:
>
> 3.1: In memory the order is: look up the key -> checks -> one synchronous write of key, booking and seats. Written in api.md and ADR-0004; the response and check order don't change.
> 3.2: ADR example replaced: a taken seat gives fewer inserted rows, the service throws SeatTaken inside work, uow.run rolls back (key included) and rethrows; the handler maps it to 409. Throwing is allowed in application, catching is not.
> 3.3: test:func uses a separate test database (TEST_DATABASE_URL), never the dev one. NFR-8 and checks.md updated.
> 3.4: Extra rows for AC-12 come from test/support/fixtures.ts, outside src/ (so depcruise doesn't scan it; stated in checks.md).
> 3.5: If Drizzle can't express the deferrable FK, it goes into a hand-written SQL migration; noted in architecture.md. To be verified during implementation.
> 3.6: AC-4 observes retries through the attempt field logged by withRetry; AC-10 says "a module's infrastructure"; spec-format Design row links api.md. READ COMMITTED and query counts for FR-2/FR-5 stay outside the ACs on purpose.
>
> Files updated locally, not committed. Re-read the diff. Anything unresolved or contradictory? Do not change any files.

## Answer 5

Almost everything landed. Again, though, **two files weren't saved**: `standards/checks.md` (last modified 13:44, the previous round) and `standards/spec-format.md` (13:19, two rounds ago). The other four files are from 13:50–13:53. Apart from that, I found one small gap in the new in-memory rule. Nothing else is unresolved or contradictory. I didn't change any files.

### 1. Answers that aren't on disk

| Answer                                                | Expected in          | On disk                                                                                                                                                              |
| ----------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.3 `TEST_DATABASE_URL`                               | NFR-8 ✓, `checks.md` | `checks.md:23` still says only "the database is migrated once per run…", with no test database or `TEST_DATABASE_URL`                                                |
| 3.4 fixtures outside `src/`, not scanned by depcruise | `checks.md`          | Not in `checks.md`. It _is_ in `architecture.md:60`, which is a fine place for it. Either keep it there and drop "stated in checks.md", or add one line to checks.md |
| 3.6 Design row links `api.md`                         | `spec-format.md:20`  | Still "Links to `docs/architecture.md`"                                                                                                                              |

### 2. Gap: in-memory "one synchronous step"

ADR:93 and api.md:52 say in memory the order is "look up the key → checks → one synchronous write, with no `await` in between". But the checks call other modules' ports (`showtimes.getByIds`, `seats.getByIds`), and those are async. So there _are_ `await`s between the lookup and the write.

Two parallel requests in memory (same key, or the same seat) can both pass the lookup and the checks, and then both write. Tests don't hit this, because AC-4 and AC-5's parallel cases are `*.pg.test.ts` only. `STORAGE=memory` is still a real runtime mode, though.

The fix: the final synchronous write re-checks that the key is unused and the seats are free right before writing, then writes or throws. The wording could be: "lookup and checks may await; the final write step is synchronous and re-checks key and seats".

### 3. Everything else checks out

- **3.1:** api.md:51–52 and ADR:93 describe the postgres and memory orders separately. The response and check order are unchanged. ✓
- **3.2:** ADR:99–101 now say that conflicts are detected by row count and the service throws `SeatTaken` inside `work`. `uow.run` rolls back and rethrows, and the handler maps it to `409`. "Throwing allowed, catching not" is consistent with NFR-4 and AC-7. The old `23505` example is gone. ✓
- **3.4:** AC-12 names `test/support/fixtures.ts`, and arch:60 allows it to write to any table outside depcruise. ✓
- **3.5:** arch:107 notes the hand-written SQL migration fallback. ✓
- **3.6:** AC-4 says it observes retries through the `attempt` field, and ADR:90 matches. AC-10 says "a module's `infrastructure`". ✓ Leaving `READ COMMITTED` and the FR-2/FR-5 query counts out of the ACs is noted as deliberate.
- **References:** ADR → AC-4, AC-8, AC-11, NFR-1, NFR-2, NFR-3, FR-8, and arch → FR-4…FR-6 all point to the right items in the current spec.
- **Coverage:** every FR/NFR still has at least one AC (same table as last round). NFR-8 is covered by AC-15, and AC-15's "README setup works" lines up with your plan to update the README at the end of the lab.

### Before committing

1. Save `standards/checks.md` with `TEST_DATABASE_URL` (and, if you want, the fixtures line).
2. Save the `standards/spec-format.md` Design row.
3. Decide whether to reword the in-memory rule (section 2) in ADR:93 and api.md:52.

After that I have nothing left to raise on this spec.

---

## Prompt 6

> Saved checks.md and spec-format.md. Reworded the in-memory rule in ADR-0004, api.md and architecture.md: reads and checks may await; the repository's final step re-checks the key and the seats and writes everything in one synchronous step. Please confirm the diff is consistent now. Do not change any files.

## Answer 6

The diff is consistent now, with one exception: **`docs/architecture.md` wasn't saved this round.** Its timestamp is still 13:53, while the other files you edited are 13:55–13:56. I didn't change any files.

- **ADR-0004:93** and **api.md:52** have the new wording: reads and checks may `await`, and the repository's final step re-checks the key and the seats, then writes everything in one synchronous step. The two match. ✓
- **architecture.md:121** still says "In memory: look up the key -> checks -> one synchronous write", without the re-check. It doesn't contradict the other two files, because it links to `api.md#idempotency`. But it's the less precise, older wording. Save your edited version, or add "(the final write re-checks the key and the seats)".
- **checks.md:11, 22–24** have `TEST_DATABASE_URL` ("never the development one"), the new `buildApp` per memory test, and the line saying `test/support/fixtures.ts` is outside depcruise. They match NFR-8, AC-12 and arch:60. ✓
- **spec-format.md:20:** the Design row now links both `docs/architecture.md` and `docs/api.md`. ✓
- `prettier --check` passes on `specs/`, `docs/`, `adr/` and `standards/`.

Once `architecture.md` is saved, I have nothing left to raise on this spec.
