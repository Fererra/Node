// `npm run db:seed`: replaces all data in DATABASE_URL with buildSeed(now).
import { systemClock } from '../../shared/clock.js';
import { loadSeed } from '../db-seed.js';
import { buildSeed } from '../seed.js';
import { runWithDatabase } from './cli.js';

await runWithDatabase('db:seed', ({ db }) =>
  loadSeed(db, buildSeed(systemClock.now())),
);
