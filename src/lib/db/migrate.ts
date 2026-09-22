import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const MIGRATIONS_DIR = join(process.cwd(), 'src/lib/db/migrations');

/** Menjalankan seluruh file .sql secara alfabetis dengan tracking table __migrations. Idempoten. */
export async function runMigrations(client: PGlite): Promise<void> {
  await client.exec(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Deteksi jika 0001_init.sql sudah pernah jalan sebelum tabel __migrations dibuat
  const checkInit = await client.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'companies'
    );
  `);
  if (checkInit.rows[0]?.exists) {
    await client.exec(`INSERT INTO __migrations (name) VALUES ('0001_init.sql') ON CONFLICT DO NOTHING;`);
  }

  const appliedResult = await client.query<{ name: string }>(
    'SELECT name FROM __migrations'
  );
  const applied = new Set(appliedResult.rows.map((r) => r.name));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (!applied.has(file)) {
      await client.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
      await client.exec(`INSERT INTO __migrations (name) VALUES ('${file}') ON CONFLICT DO NOTHING;`);
    }
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
