import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Tes route memakai getDb() yang membuka PGlite dari PGLITE_DATA_DIR.
// Bawaannya `.pglite` milik dev — bila server dev ikut berjalan, dua proses
// menulis file yang sama dan PGlite abort ("RuntimeError: Aborted()"),
// membuat puluhan tes route gagal serentak. Tes memakai direktori terpisah
// agar tidak pernah berebut dengan server dev.
process.env.PGLITE_DATA_DIR = process.env.PGLITE_DATA_DIR ?? resolve(__dirname, '.pglite-test');

export default defineConfig({
  // tsconfig keeps jsx: "preserve" for Next.js; Vitest must compile JSX itself.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // PGlite bersifat single-process, jadi berkas tes dijalankan berurutan.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
