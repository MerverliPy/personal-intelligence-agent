import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Integration tests share a single PostgreSQL database.
    // Running test files in parallel would cause conflicts with
    // setupTestDatabase() which drops and recreates the same DB.
    fileParallelism: false,
  },
});
