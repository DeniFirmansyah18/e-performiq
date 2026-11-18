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

  it('memperbarui hanya label pilar baku yang tepat dan dapat diulang', async () => {
    await client.query(`
      INSERT INTO companies (id, company_name, legal_entity_code)
      VALUES ('a0000000-0000-4000-8000-000000000099', 'Test', 'TEST-MIGRATION')
    `);
    await client.query(`
      INSERT INTO strategic_pillars
        (id, company_id, perspective, pillar_name, description, strategic_weight)
      VALUES
        ('c0000000-0000-4000-8000-000000000091', 'a0000000-0000-4000-8000-000000000099', 'CUSTOMER', 'Kepuasan Stakeholder & Keunggulan Layanan Ekosistem', 'tetap', 25),
        ('c0000000-0000-4000-8000-000000000092', 'a0000000-0000-4000-8000-000000000099', 'INTERNAL_PROCESS', 'Keunggulan Operasional & Zero Fatal SOP Compliance', 'tetap', 25),
        ('c0000000-0000-4000-8000-000000000093', 'a0000000-0000-4000-8000-000000000099', 'FINANCIAL', 'Kepuasan Stakeholder & Keunggulan Layanan Ekosistem', 'custom', 25),
        ('c0000000-0000-4000-8000-000000000094', 'a0000000-0000-4000-8000-000000000099', 'CUSTOMER', 'Nama Pilar Khusus', 'custom', 25)
    `);

    const migration = readFileSync(join(MIGRATIONS_DIR, '0072_plain_language_bod_pillars.sql'), 'utf8');
    await client.exec(migration);
    await client.exec(migration);

    const result = await client.query<{ id: string; pillar_name: string; description: string; strategic_weight: number }>(
      `SELECT id, pillar_name, description, strategic_weight FROM strategic_pillars
       WHERE id IN (
         'c0000000-0000-4000-8000-000000000091',
         'c0000000-0000-4000-8000-000000000092',
         'c0000000-0000-4000-8000-000000000093',
         'c0000000-0000-4000-8000-000000000094'
       ) ORDER BY id`
    );
    expect(Object.fromEntries(result.rows.map((row) => [row.id, row.pillar_name]))).toEqual({
      'c0000000-0000-4000-8000-000000000091': 'Pelayanan yang Memuaskan.',
      'c0000000-0000-4000-8000-000000000092': 'Proses Kerja Tertib dan Andal.',
      'c0000000-0000-4000-8000-000000000093': 'Kepuasan Stakeholder & Keunggulan Layanan Ekosistem',
      'c0000000-0000-4000-8000-000000000094': 'Nama Pilar Khusus',
    });
    expect(result.rows.every((row) => row.description === 'tetap' || row.description === 'custom')).toBe(true);
    expect(result.rows.every((row) => Number(row.strategic_weight) === 25)).toBe(true);
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
