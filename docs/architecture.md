# Architecture

Source: diagrams from my earlier project ([Fererra/KPI](https://github.com/Fererra/KPI)), redrawn in Mermaid.
Updated when a lab spec changes modules or data.

## Modules

`movies` owns genres; `seats` owns cinema halls and their seats.

```mermaid
flowchart LR
  auth --> users
  showtimes --> movies
  showtimes --> seats
  bookings --> showtimes
  bookings --> seats
  bookings --> users
```

## Data

Conceptual ER: foreign keys are implied by relations and not drawn.

```mermaid
erDiagram
  Movie ||--|{ MovieGenre : has_genre
  Genre ||--|{ MovieGenre : classified_as
  Movie ||--o{ Showtime : is_shown_in
  CinemaHall ||--|{ Seat : contains
  CinemaHall ||--o{ Showtime : hosts
  Seat ||--o{ BookingSeat : reserved_as
  Booking ||--o{ BookingSeat : includes
  Showtime ||--o{ Booking : has_booking
  Showtime ||--o{ BookingSeat : has_reserved_seats
  User ||--o{ Booking : makes
```