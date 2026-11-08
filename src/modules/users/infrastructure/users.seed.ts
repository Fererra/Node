/** Rows of the table `users` owns (docs/architecture.md#physical-schema). */
export interface UsersSeed {
  users: { id: string; name: string; email: string }[];
}
