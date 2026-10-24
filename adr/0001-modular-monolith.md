# ADR-0001: Modular monolith with module factories and ports

- Status: accepted
- Date: 2026-10-24

## Context

The service has six business areas: auth, users, movies, seats, showtimes, bookings. It is built by one developer during one course, and each lab adds features on top of the previous ones.

In the previous version of this project the modules imported each other's internal files directly. Nothing checked these imports, and it ended with a cycle between `users` and `auth`. This project needs boundaries that are checked by a tool, not by memory.

## Decision Drivers

- Module boundaries must be checkable by dependency-cruiser (spec NFR-4).
- One developer, one deployment: operational cost must stay low.
- A module must be replaceable or testable without the modules that use it.
- No dependency cycles between modules.

## Considered Options

### Option A: Modular monolith with factories and ports

One application. Each module exposes `create<Name>Module(deps) → { plugin, service }` from its `index.ts`. What a module needs from others is declared as ports in its own `application/ports/`. `src/app/` creates modules in dependency order and passes services as `deps`.

- Pros: boundaries are explicit and checkable; no runtime imports between modules, so no hidden cycles; a module can be tested with fake `deps`; one deployment.
- Cons: more boilerplate (ports, factories, wiring in `app`); dependency order in `app` must be kept by hand.

### Option B: Modular monolith with direct service imports

One application. Modules import each other's services through `index.ts`.

- Pros: less code; simple to start.
- Cons: runtime imports between modules make cycles easy (exactly what happened in the previous version); modules can't be tested in isolation without mocking imports.

### Option C: Layered monolith (controllers / services / repositories folders)

Code grouped by technical layer instead of by business area.

- Pros: familiar; very little structure to set up.
- Cons: no business boundaries at all; every service can reach every repository; dependency-cruiser can't express "bookings may use showtimes".

### Option D: Microservices

One service per module, talking over HTTP or messages.

- Pros: hard boundaries by design; independent deployment.
- Cons: network, deployment and data consistency costs are far too high for one developer and one course; booking seats would need distributed transactions.

## Decision

Option A: a modular monolith with module factories and ports. Rules are written in `docs/architecture.md#rules` and enforced by dependency-cruiser.

## Consequences

- Good: any forbidden import fails `npm run deps:check` before push and in CI.
- Good: modules can be unit-tested with fake `deps`, without starting other modules.
- Good: if a module ever needs to become a separate service, its ports already define the contract.
- Bad: each cross-module need costs a port, an adapter in `app` wiring, and a factory parameter.
- Bad: `src/app/` must create modules in dependency order; a new dependency means updating that order.
- Follow-up: the dependency-cruiser config must treat `index.ts` as the module's assembly point (it may import all of its own layers).
