// test:func, every test file: the database is reset and reseeded with
// buildSeed(NOW) before each test, so tests don't see each other's rows.
import { afterAll, beforeEach } from 'vitest';
import { loadSeed } from '../../src/app/db-seed.js';
import { buildSeed } from '../../src/app/seed.js';
import { NOW } from './app.js';
import { closeTestDb, testDb } from './db.js';

beforeEach(async () => {
  await loadSeed(testDb(), buildSeed(NOW));
});

afterAll(async () => {
  await closeTestDb();
});
