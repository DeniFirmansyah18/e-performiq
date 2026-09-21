import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const MIGRATIONS_DIR = join(process.cwd(), 'src/lib/db/migrations');

/** Menjalankan seluruh file .sql secara alfabetis. Idempoten. */
export async function runMigrations(client: PGlite): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    await client.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
}

// Dijalankan langsung lewat `npm run db:migrate`
if (process.argv[1]?.includes('migrate')) {
  const client = new PGlite(process.env.PGLITE_DATA_DIR ?? '.pglite');
  runMigrations(client)
    .then(async () => {
      console.log('Migrasi selesai.');
      await client.close();
    })
    .catch(async (err) => {
      console.error('Migrasi gagal:', err);
      await client.close();
      process.exit(1);
    });
}
