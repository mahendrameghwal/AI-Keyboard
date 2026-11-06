import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// The DB-backed suites skip themselves without DATABASE_URL, which is how a dead CI database
// service turns into a green check. REQUIRE_DB_TESTS (set in CI) makes that combination an error.
if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile();
if (process.env.REQUIRE_DB_TESTS === 'true' && !process.env.DATABASE_URL) {
  throw new Error('REQUIRE_DB_TESTS=true but DATABASE_URL is unset — no database-backed test ran.');
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
    },
    // DB-backed suites run against a hosted Postgres; allow for network latency.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
