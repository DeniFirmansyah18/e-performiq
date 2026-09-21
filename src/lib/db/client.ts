import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const globalForDb = globalThis as unknown as {
  __eperformiqDb?: ReturnType<typeof createDb>;
};

function createDb() {
  const dataDir = process.env.PGLITE_DATA_DIR ?? resolve(process.cwd(), '.pglite');
  const client = new PGlite(dataDir);
  return drizzle(client);
}

/**
 * Singleton: Next.js dev me-reload modul, dan setiap reload membuat
 * instance PGlite baru sehingga koneksi menumpuk serta file dataDir terkunci.
 */
export const db = globalForDb.__eperformiqDb ?? createDb();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__eperformiqDb = db;
}

export type Db = typeof db;
