import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'src/lib/db/migrations');

/**
 * Menerapkan file .sql mentah TANPA tracking __migrations, untuk menguji
 * idempotensi pada level statement SQL itu sendiri.
 */
async function applyAllMigrationsRaw(client: PGlite): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    await client.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
}

const GOVERA360_TABLES = [
  // 0003 — 6-box Govera360
  'daily_timesheets',
  'kpi_evidence_attachments',
  'career_path_levels',
  'moodle_course_enrollments',
  'leave_requests',
  'expense_claims',
  'helpdesk_tickets',
  // 0004 — absensi & talent acquisition
  'attendance_records',
  'job_postings',
  'internal_applications',
  'interview_slots',
];

describe('Idempotensi migrasi skema (G-07)', () => {
  let client: PGlite;

  beforeAll(async () => {
    client = new PGlite();
  });

  afterAll(async () => {
    await client.close();
  });

  it('menerapkan seluruh file migrasi dua kali pada PGlite fresh tanpa error', async () => {
    await applyAllMigrationsRaw(client);
    await expect(applyAllMigrationsRaw(client)).resolves.toBeUndefined();
  });

  it('semua tabel Govera360 tersedia setelah migrasi ganda', async () => {
    for (const table of GOVERA360_TABLES) {
      const res = await client.query<{ regclass: string | null }>(
        `SELECT to_regclass('public.${table}') AS regclass`
      );
      expect(res.rows[0]?.regclass, `tabel ${table} harus ada`).not.toBeNull();
    }
  });

  it('runner runMigrations tetap idempoten via tracking __migrations', async () => {
    const { runMigrations } = await import('@/lib/db/migrate');
    await expect(runMigrations(client)).resolves.toBeUndefined();
    await expect(runMigrations(client)).resolves.toBeUndefined();
  });
});
