# ADR 003: Idempotensi Migrasi Skema pada PGlite

Tanggal: 2026-09-28
Status: Diterima

## Konteks

`runMigrations` (`src/lib/db/migrate.ts`) sudah melacak file yang diterapkan
melalui tabel `__migrations`, sehingga eksekusi ulang lewat runner bersifat
idempoten. Namun idempotensi pada level *statement SQL* belum dijamin:
menerapkan file migrasi mentah dua kali (mis. via `psql`, `client.exec`
langsung, atau migrasi yang gagal di tengah jalan lalu diulang) akan melempar
error seperti `relation already exists`, `duplicate_object`, atau
`trigger already exists`.

Tes `tests/integration/schema-migrations.test.ts` menerapkan seluruh file
`.sql` dua kali pada PGlite fresh tanpa tracker, lalu menegaskan semua tabel
Govera360 tetap tersedia.

## Keputusan

1. Setiap `CREATE TABLE` pada migrasi memakai `IF NOT EXISTS`.
2. Setiap `CREATE TYPE ... AS ENUM` dibungkus blok
   `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`.
3. Setiap `CREATE INDEX` memakai `IF NOT EXISTS`.
4. Setiap `CREATE TRIGGER` didahului `DROP TRIGGER IF EXISTS <nama> ON <tabel>;`.
5. `CREATE OR REPLACE FUNCTION` dibiarkan apa adanya (sudah idempoten).
6. `ALTER TYPE ... ADD VALUE IF NOT EXISTS` dibiarkan (sudah idempoten).

Perubahan diterapkan pada `src/lib/db/migrations/0001_init.sql`
(24 tabel, 7 enum, 12 index, 2 trigger). Migrasi 0002–0004 sudah idempoten
dan tidak diubah.

## Konsekuensi

- Migrasi aman dijalankan ulang dari SQL mentah maupun lewat runner.
- `IF NOT EXISTS` tidak memvalidasi kesesuaian definisi kolom; perubahan
  skema di masa depan tetap memakai file migrasi baru bernomor urut, bukan
  mengedit file lama.
