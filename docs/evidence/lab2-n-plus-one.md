# Lab 2: N+1 evidence (AC-12)

Run by hand on branch `lab2-working-app`, 2026-11-08, against the PostgreSQL test database.

## Where N+1 would appear

`GET /me/bookings` (FR-6) needs each booking's showtime, movie title and hall. `bookings` gets them through the `showtimes` port, and `showtimes` gets titles and halls through the `movies` and `seats` ports. Calling the port once per booking makes the query count grow with the number of bookings.

The service does it with one batch call for all bookings (`src/modules/bookings/application/bookings.service.ts`, `listMine`):

```ts
showtimes
  .getByIds([...new Set(bookings.map((b) => b.showtimeId))])
  .then((list) => new Map(list.map((s) => [s.id, s]))),
```

## Breaking it on purpose

Temporary change: one port call per booking, without de-duplication. The response body stays the same; only the number of queries changes.

```ts
Promise.all(bookings.map((b) => showtimes.getByIds([b.showtimeId])))
  .then((lists) => lists.flat())
  .then((list) => new Map(list.map((s) => [s.id, s]))),
```

```text
$ npm run test:func -- query-counts

 ❯ test/pg/query-counts.pg.test.ts (4 tests | 1 failed) 1291ms
   ❯ AC-12: the same query count for 1 and for many items (4)
     ✓ FR-1 GET /movies: 1 vs 20 movies 568ms
     ✓ FR-3 GET /showtimes/:id/seats: 1 vs 20 seats, half of them taken 209ms
     × FR-6 GET /me/bookings: 1 vs 20 bookings (20 showtimes, movies, halls) 299ms
     ✓ FR-4 POST /bookings: 1 vs 10 seats 212ms

 FAIL  test/pg/query-counts.pg.test.ts > AC-12: the same query count for 1 and for many items > FR-6 GET /me/bookings: 1 vs 20 bookings (20 showtimes, movies, halls)
AssertionError: expected [ …(63) ] to have a length of 6 but got 63

 ❯ test/pg/query-counts.pg.test.ts:85:26
     83|     expect(JSON.parse(one.body)).toHaveLength(1);
     84|     expect(JSON.parse(many.body)).toHaveLength(20);
     85|     expect(many.queries).toHaveLength(one.queries.length);

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

- Batch version: 6 queries for any number of bookings: user, bookings, then one batch each for showtimes, movies, halls and seats.
- Per-booking version: 63 queries for 20 bookings: user, bookings, seats, plus 20 × (showtime, movie, hall). That is `3 + 3N`: the N+1 multiplies through the ports.
- The body assertions (lines 83–84) still pass, so only the query-count check catches it.

The change was reverted with `git restore`; the batch version is in the code.

## How it is prevented

- Rule in `docs/architecture.md#rules`: cross-module ports offer batch methods where a list is involved.
- AC-12 pins the query count for FR-1, FR-3, FR-6 and FR-4 on 1 vs many items, so a per-item call fails `test:func` in CI.
