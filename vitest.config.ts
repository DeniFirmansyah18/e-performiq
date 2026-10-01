import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Route handler tests import routes that use the getDb() PGlite singleton (the dev
    // .pglite), which is single-process. Running test files in parallel makes multiple
    // suites open the same PGlite file concurrently and abort. Serialize files.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
