# ADR-0002: Fastify as the HTTP framework

- Status: accepted
- Date: 2026-10-24

## Context

The service is a JSON REST API in TypeScript. Each module exports a plugin from `create<Name>Module` (ADR-0001), and the smoke test must start the app and call `/health` without a network port or a database (spec AC-1). The previous version of this project used Express with a separate JSON Schema validator.

## Decision Drivers

- First-class TypeScript types for requests and responses.
- Request validation by JSON Schema without extra glue code.
- A plugin model that matches one plugin per module.
- In-process requests for tests, without opening a port.
- Small framework surface: the architecture rules are mine, not the framework's.

## Considered Options

### Option A: Fastify

- Pros: JSON Schema validation and serialization built in; encapsulated plugins fit `create<Name>Module → { plugin }`; `app.inject()` runs requests in-process for smoke and functional tests; good TypeScript types.
- Cons: plugin encapsulation and the order of `register` calls need care; a smaller middleware ecosystem than Express.

### Option B: Express

- Pros: I already know it from the previous version; the largest ecosystem.
- Cons: no built-in validation (the previous version needed its own validator); TypeScript types are added on top; tests need Supertest or a running server; no plugin encapsulation, so modules share one global middleware chain.

### Option C: NestJS

- Pros: modules, dependency injection and validation out of the box.
- Cons: brings its own module and DI system, which would overlap with my own module rules and factories; decorators and reflection hide dependencies from dependency-cruiser; much larger surface to learn and defend.

## Decision

Option A: Fastify. Each module's `index.ts` returns a Fastify plugin; `src/app/` registers them.

## Consequences

- Good: the smoke test uses `app.inject()`, so pre-push needs no port and no database.
- Good: request validation is declared next to each route as JSON Schema.
- Good: one plugin per module keeps module routes and hooks encapsulated.
- Bad: plugin encapsulation rules (what is visible across `register` scopes) must be understood to avoid surprises.
- Bad: some Express middleware I used before has no direct Fastify equivalent.
- Follow-up: module plugins are registered by `src/app/` in the same dependency order as their factories (ADR-0001).
