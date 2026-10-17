import { defineConfig } from 'vitest/config';

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
