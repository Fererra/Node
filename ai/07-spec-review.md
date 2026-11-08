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
