import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { runMigrations } from '@/lib/db/migrate';
import type { Db } from '@/lib/db/client';

/**
 * PGlite in-memory baru per pemanggilan, tanpa dataDir, sehingga
 * setiap tes terisolasi dan tidak menyentuh .pglite/ milik dev.
 */
export async function createTestDb(): Promise<{ db: Db; client: PGlite }> {
  const client = new PGlite();
  try {
    await runMigrations(client);
    const db = drizzle(client) as unknown as Db;
    return { db, client };
  } catch (err) {
    await client.close();
    throw err;
  }
}
