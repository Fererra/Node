// Table owned by `users` (docs/architecture.md#physical-schema).
// Plural because `user` is a reserved word in PostgreSQL.
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
});
