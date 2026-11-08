-- Hand-written: Drizzle can't express a deferrable foreign key.
-- The key is claimed (inserted) before its booking exists, in the same
-- transaction; the FK is checked at commit (docs/api.md#idempotency).
ALTER TABLE "idempotency_key"
  ALTER CONSTRAINT "idempotency_key_booking_fk" DEFERRABLE INITIALLY DEFERRED;
