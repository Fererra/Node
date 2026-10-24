# ADR-0003: Drizzle ORM for database access

- Status: accepted
- Date: 2026-10-24

## Context

The service uses PostgreSQL. Lab 1 has no database; the first DB lab adds the schema, migrations and functional tests. The key data rule is that one seat can't be booked twice for one showtime: it relies on a composite primary key and on transactions (spec, Data and Key update scenarios). The previous version of this project used TypeORM.

## Decision Drivers

- Types of rows and queries come from the schema, with TypeScript strict mode.
- Composite keys, partial indexes and transactions are easy to express and to read in the generated SQL.
- The ORM lives only in `infrastructure` and doesn't leak into `domain` or `application` (ADR-0001).
- Migrations are plain SQL files that can be reviewed in a PR.

## Considered Options

### Option A: Drizzle ORM

- Pros: schema in TypeScript, types inferred from it; query builder close to SQL, so constraints and transactions stay visible; migrations generated as SQL; no decorators, no runtime reflection.
- Cons: younger than TypeORM and Prisma, smaller community; no automatic relation loading, joins are written by hand.

### Option B: TypeORM

- Pros: I used it in the previous version; mature, many features.
- Cons: entities with decorators or entity schemas push persistence details toward the domain; weaker type safety for query results; behaviour like lazy relations and `synchronize` is easy to misuse.

### Option C: Prisma

- Pros: very good types and developer experience; popular.
- Cons: separate schema language and code generation step; partial unique indexes and some PostgreSQL features need raw SQL; a runtime query engine adds weight.

## Decision

Option A: Drizzle ORM, used only inside module `infrastructure` layers. It is applied starting from the first DB lab; Lab 1 has no database.

## Consequences

- Good: query result types follow the schema, so a schema change shows up as type errors.
- Good: the composite PK on `BookingSeat` and the booking transaction are written explicitly and are easy to review.
- Good: migrations are SQL files in the repo.
- Bad: relations and joins are written by hand, which means more code than with TypeORM.
- Bad: the previous version's TypeORM entities can't be reused; the schema is rewritten.
- Follow-up: the first DB lab adds the Drizzle config, migrations, PostgreSQL in CI and `test:func` (`standards/checks.md`).
