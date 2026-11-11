/**
 * Cek cepat apakah database bisa dibaca. Exit code 0 = sehat.
 * Dipakai skrip uji untuk membuktikan DB tidak rusak setelah server berhenti.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const DIR = resolve(process.cwd(), process.env.PGLITE_DATA_DIR ?? '.pglite');

async function main() {
  if (!existsSync(DIR)) {
    console.error('DB tidak ada:', DIR);
    process.exit(1);
  }
  const db = new PGlite(DIR);
  try {
    const r = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM employees');
    console.log('SEHAT — karyawan:', r.rows[0].n);
    await db.close();
    process.exit(0);
  } catch (e: any) {
    console.error('RUSAK —', String(e?.message ?? e).slice(0, 120));
    process.exit(1);
  }
}

main();
