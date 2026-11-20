// Fixed user ids of the seed (src/app/seed.ts, `seedIds.users`). They are
// part of the seed contract, and E2E tests import nothing from src/, so
// they are copied here; test/app/seed-ids.test.ts checks that they match.
export const users = {
  alice: '60000000-0000-4000-8000-000000000001',
  bob: '60000000-0000-4000-8000-000000000002',
} as const;
