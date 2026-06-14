import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const pkg = (name: string) => resolve(repoRoot, 'packages', name, 'src', 'index.ts');

export default defineConfig({
  resolve: {
    alias: {
      '@pia/db': pkg('db'),
      '@pia/knowledge': pkg('knowledge'),
      '@pia/ai': pkg('ai'),
      '@pia/contracts': pkg('contracts'),
      '@pia/config': pkg('config'),
      '@pia/audit': pkg('audit'),
      '@pia/auth': pkg('auth'),
      '@pia/storage': pkg('storage'),
      '@pia/observability': pkg('observability'),
    },
  },
  test: {
    name: 'e2e',
    include: ['test/e2e/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
