# Cinema Booking Service

Backend for booking cinema tickets. Admins manage movies, halls and showtimes, users pick a showtime, choose seats and book tickets.

The app is a modular monolith: one application, split into modules that talk to each other only through their public interfaces.

Based on the previous version of this project ([Fererra/coursework](https://github.com/Fererra/coursework), Express + TypeORM + JS). This repo is a redesign with a new stack and structure.

## Features

- Auth: sign up, log in
- Movies: list and manage movies and genres
- Halls and seats: halls with seat layout
- Showtimes: schedule a movie in a hall at a given time
- Bookings: book seats for a showtime, cancel a booking. One seat can't be booked twice

## Scope

What's in this course:

- module structure with checked boundaries between modules
- git hooks: format, lint, type check, unit + smoke tests, build
- CI on every PR, required to merge into `main`
- domain logic for the features above

Not included for now:

- tariffs and payments
- email/push notifications
- deployment

## Stack

- Node.js 26
- TypeScript
- Fastify
- PostgreSQL
- Drizzle ORM

## Docs

- [specs/](./specs): one spec per lab, with acceptance criteria
- [docs/architecture.md](./docs/architecture.md): module graph, rules and ER diagram
- [standards/](./standards): my engineering standards
- [adr/](./adr): architecture decisions

## Getting started

Requires Node 26 (see `.nvmrc`). Older Node versions are not supported: `npm ci` fails on the `engines` check.

Node 26 was the latest major release when the project started. There is no requirement to support older versions, so the project targets only this one. Use a version manager to install it:

```bash
# nvm (macOS / Linux) or fnm read .nvmrc
nvm install && nvm use
# nvm-windows doesn't read .nvmrc
nvm install 26 && nvm use 26
```

Then:

```bash
npm ci
npm run check
npm run build && npm start
curl localhost:3000/version
```
