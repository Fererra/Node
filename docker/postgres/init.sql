-- Runs once, when the data volume is created. The development database
-- (`cinema`) comes from POSTGRES_DB; tests and E2E use separate ones.
-- scripts/test-all.mjs also creates them when an older volume lacks them.
CREATE DATABASE cinema_test;
CREATE DATABASE cinema_e2e;
