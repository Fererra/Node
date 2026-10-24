# Cinema Booking Service

Backend for booking cinema tickets. Admins manage movies, halls and showtimes, users pick a showtime, choose seats and book tickets.

The app is a modular monolith: one application, split into modules that talk to each other only through their public interfaces.

Based on my earlier coursework ([Fererra/coursework](https://github.com/Fererra/coursework), Express + TypeORM + JS). This repo is a redesign with a new stack and structure.

## Features

- Auth: sign up, log in
- Movies: list and manage movies
- Halls and seats: halls with seat layout
- Showtimes: schedule a movie in a hall at a given time
- Tariffs: ticket prices per showtime or seat type
- Bookings: book seats for a showtime, cancel a booking. One seat can't be booked twice

## Scope

What's in this course:
- module structure with checked boundaries between modules
- git hooks: format, lint, type check, tests, build
- domain logic for the features above

Not included for now:
- payments
- email/push notifications
- deployment

## Stack

- Node.js 
- TypeScript 
- Fastify
- PostgreSQL
- Drizzle ORM

## Docs

- [specs/](./specs/NN-<short-name>.md): specification and acceptance criteria
- [standards/](./standards): my engineering standards
- [adr/](./adr): architecture decisions

## Getting started

TODO: add after tooling setup