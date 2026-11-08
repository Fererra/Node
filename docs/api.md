# API contract

Used by `specs/02-working-app.md`. All bodies are JSON. Times are ISO 8601 in UTC.

## Users and request IDs

- `X-User-Id`: required on `POST /bookings`, `POST /bookings/:id/cancel`, `GET /me/bookings`. Missing, not a UUID or unknown -> `401`. Ignored on other routes. The user is loaded by a route-level `onRequest` hook of these routes, before body parsing, so `401` always comes before `400`.
- `X-Request-Id`: accepted from the client if it matches `[A-Za-z0-9_-]{1,64}`, otherwise a UUID is generated. Always returned in the `X-Request-Id` response header.

## Responses

| Endpoint                    | Status | Body                                                                                       |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `GET /movies`               | `200`  | `[{ id, title, durationMin, ageLimit, genres: [name] }]`; movies by title, genres by name  |
| `GET /movies/:id/showtimes` | `200`  | `[{ id, startsAt, hall: { id, number } }]`; future only, by `startsAt`                     |
| `GET /showtimes/:id/seats`  | `200`  | `[{ id, row, number, type, taken }]`; by row and number; past showtimes allowed            |
| `POST /bookings`            | `201`  | Booking                                                                                    |
| `POST /bookings/:id/cancel` | `200`  | Booking                                                                                    |
| `GET /me/bookings`          | `200`  | `[Booking & { movieTitle, startsAt }]`; cancelled included; by `createdAt` desc, `id` desc |

Booking: `{ id, showtimeId, status, seats: [{ id, row, number }], createdAt }`. A cancelled booking has `seats: []`. `createdAt` comes from `Clock`.

`POST /bookings` body: `{ showtimeId: uuid, seatIds: uuid[] }`, 1–10 unique ids. Header `Idempotency-Key`: 1–255 chars.

## Errors

Body: `{ "error": { "code", "message", "requestId" } }`.

| Status | Code                     | When                                                                                                               |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `400`  | `VALIDATION_ERROR`       | malformed JSON, bad UUID in path or body, missing or empty `Idempotency-Key`, key > 255, 0 / >10 / duplicate seats |
| `401`  | `UNAUTHORIZED`           | see `X-User-Id`                                                                                                    |
| `404`  | `NOT_FOUND`              | unknown route, movie, showtime, or a booking that doesn't exist or isn't mine                                      |
| `409`  | `SEAT_TAKEN`             | a requested seat is already booked; nothing is booked                                                              |
| `422`  | `SHOWTIME_STARTED`       | `starts_at <= now` when booking or cancelling a `RESERVED` booking                                                 |
| `422`  | `SEAT_NOT_IN_HALL`       | a seat doesn't exist or isn't in the showtime's hall                                                               |
| `422`  | `IDEMPOTENCY_KEY_REUSED` | the key was used by this user with a different request                                                             |
| `503`  | `SERVICE_UNAVAILABLE`    | database unavailable, or retries exhausted                                                                         |
| `500`  | `INTERNAL_ERROR`         | anything else; generic message                                                                                     |

## Order of checks

`POST /bookings`: `401` -> `400` -> idempotency (replay or `422`) -> `404` showtime -> `422 SHOWTIME_STARTED` -> `422 SEAT_NOT_IN_HALL` -> `409 SEAT_TAKEN`.

`POST /bookings/:id/cancel`: `401` -> `400` -> `404`; then if `CANCELLED` -> `200` with the booking; else if started -> `422 SHOWTIME_STARTED`; else cancel -> `200`.

## Idempotency (`POST /bookings`)

- The key is scoped to the user: `(user_id, key)`.
- Request hash: `showtimeId` + sorted `seatIds`, so `[a,b]` equals `[b,a]`.
- PostgreSQL, inside one transaction: claim the key (`INSERT … ON CONFLICT DO NOTHING RETURNING`) -> checks -> insert `booking` -> insert `booking_seat` rows (sorted by `seat_id`, `ON CONFLICT DO NOTHING`; fewer rows than seats -> the service throws `SeatTaken` -> rollback -> `409`). The key's FK to `booking` is deferred, so the key can be inserted first.
- In memory (no rollback): look up the key -> checks (may `await`) -> the repository re-checks the key and the seats and writes key, booking and seats in one synchronous step. The response and the order of checks are the same.
- If the key already exists: same hash -> `201` with the booking's current state (it may be `CANCELLED`); other hash -> `422`.
- Any failure stores nothing, so the key can be reused.
- Parallel requests with one key (PostgreSQL): the second claim waits for the first transaction. If the first commits, the claim returns nothing and the second request replays the committed booking (`READ COMMITTED` sees it). If the first fails, the second claims the key and proceeds.
- Expected conflicts are detected from row counts, not by catching exceptions.
