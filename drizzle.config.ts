import { defineConfig } from 'drizzle-kit';

// `npx drizzle-kit generate` writes SQL migrations to drizzle/ from the
// schema. Migrations are applied by `npm run db:migrate`.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/shared/db/schema/index.ts',
  out: './drizzle',
  ...(process.env.DATABASE_URL
    ? { dbCredentials: { url: process.env.DATABASE_URL } }
    : {}),
});
