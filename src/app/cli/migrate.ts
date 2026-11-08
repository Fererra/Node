// `npm run db:migrate`: applies drizzle/ migrations to DATABASE_URL.
import { runMigrations } from '../../shared/db/migrate.js';
import { runWithDatabase } from './cli.js';

await runWithDatabase('db:migrate', ({ db }) => runMigrations(db));
