/**
 * Penjaga untuk script `db:migrate:pg` / `db:seed:pg`.
 *
 * Tanpa penjaga ini, `db:migrate.ts` jatuh ke PGlite ketika DATABASE_URL kosong —
 * perintah yang namanya menjanjikan PostgreSQL justru hanya menyentuh database
 * lokal, dan tidak ada satu pun pesan yang memberi tahu. Lebih baik gagal keras.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function readEnvValue(key, files = ['.env.local', '.env']) {
  if (process.env[key]) return process.env[key];
  for (const file of files) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const line = readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith(`${key}=`));
    if (!line) continue;
    let value = line.slice(line.indexOf('=') + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value) return value;
  }
  return '';
}

export function requireDatabaseUrl(env = readEnvValue('DATABASE_URL')) {
  if (!env) {
    return {
      ok: false,
      message:
        'DATABASE_URL kosong. Perintah ini menargetkan PostgreSQL server, bukan PGlite lokal.\n' +
        'Isi DATABASE_URL di .env (atau .env.local), lalu jalankan ulang.\n' +
        'Untuk database lokal PGlite, gunakan `npm run db:migrate` / `npm run db:seed`.',
    };
  }
  return { ok: true, message: '' };
}

// Dijalankan sebagai script (bukan diimpor oleh tes).
if (process.argv[1]?.endsWith('require-db-url.mjs')) {
  const result = requireDatabaseUrl();
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
  console.log('DATABASE_URL terdeteksi — melanjutkan ke PostgreSQL.');
}
