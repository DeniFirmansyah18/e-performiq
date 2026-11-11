/**
 * Pulihkan database PGlite yang rusak ("RuntimeError: Aborted()").
 *
 * Latar belakang: PGlite menulis langsung ke berkas data. Bila proses dimatikan
 * paksa saat masih menulis, berkasnya rusak dan SEMUA query gagal dengan
 * "Aborted()". Gejalanya: login 500, "Terjadi kesalahan internal pada server",
 * dan "Gagal memuat analitik kepegawaian: Aborted()".
 *
 * Urutan kerja (penting): direktori lama DIPINDAHKAN lebih dulu, sebelum
 * PGlite dibuka. Instance PGlite yang sudah rusak tidak melepaskan berkasnya
 * walau close() dipanggil, jadi membukanya lebih dulu akan mengunci direktori
 * dan membuat pemindahan gagal dengan EPERM.
 *
 * Pemakaian:  npx tsx scripts/pulihkan-db.ts
 */
import { existsSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const DIR = resolve(process.cwd(), process.env.PGLITE_DATA_DIR ?? '.pglite');

/** Coba pindahkan direktori beberapa kali (Windows kadang melepas handle lambat). */
function pindahkanAman(dari: string, ke: string): boolean {
  for (let coba = 1; coba <= 8; coba++) {
    try {
      renameSync(dari, ke);
      return true;
    } catch {
      if (coba === 8) return false;
      // Tunggu singkat secara sinkron agar handle dilepas.
      const t = Date.now();
      while (Date.now() - t < 500) { /* jeda */ }
    }
  }
  return false;
}

async function main() {
  if (!existsSync(DIR)) {
    console.log('Direktori tidak ada:', DIR);
    return;
  }

  // 1. Pindahkan dulu. Ini sekaligus menjadi uji: bila gagal, berarti ada
  //    proses lain yang benar-benar memakai DB (mis. `next dev` masih hidup).
  const cap = `${DIR}-rusak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  if (!pindahkanAman(DIR, cap)) {
    console.error('Tidak bisa memindahkan direktori. Hentikan `next dev` lebih dulu, lalu ulangi.');
    process.exit(1);
  }
  console.log('Direktori lama dipindah ke:', cap);

  // 2. Bangun ulang di direktori baru.
  const db = new PGlite(DIR);
  const klien = {
    query: async <T,>(sqlText: string, params?: unknown[]) => {
      const res = await db.query<T>(sqlText, params as any[]);
      return { rows: res.rows as T[] };
    },
    exec: async (sqlText: string) => db.exec(sqlText),
  };

  const { runMigrations } = await import('../src/lib/db/migrate');
  const { runSeed } = await import('../src/lib/db/seed');

  await runMigrations(klien as any);
  console.log('Migrasi selesai.');
  await runSeed(klien as any);
  console.log('Seed selesai.');

  // 3. Verifikasi hasilnya benar-benar bisa dibaca.
  const r = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM employees');
  const u = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM users');
  console.log('Verifikasi — karyawan:', r.rows[0].n, '| akun:', u.rows[0].n);
  if (r.rows[0].n < 1 || u.rows[0].n < 1) {
    console.error('Hasil seed kosong — periksa manual.');
    process.exit(1);
  }
  await db.close();
  console.log('Database pulih dan siap dipakai.');
}

main().catch((e) => {
  console.error('GAGAL:', String(e?.message ?? e).slice(0, 300));
  process.exit(1);
});
