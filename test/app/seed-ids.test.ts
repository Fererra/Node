// Spec 03 FR-3: E2E tests take user ids from test/e2e/seed-ids.ts, because
// they import nothing from src/. This keeps the copy in line with the seed.
import { describe, expect, it } from 'vitest';
import { seedIds } from '../../src/app/seed.js';
import { users } from '../e2e/seed-ids.js';

describe('test/e2e/seed-ids.ts', () => {
  it('has the user ids of src/app/seed.ts', () => {
    expect(users).toEqual(seedIds.users);
  });
});
