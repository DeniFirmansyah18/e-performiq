import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';

const NEW_TABLES = ['course_modules', 'course_completions', 'certificates', 'candidates', 'job_applications'];

describe('migration 0010: materials/careers/profile tables', () => {
  let client: PGlite;
  beforeAll(async () => { ({ client } = await createTestDb()); });
  afterAll(async () => { await client.close(); });

  it('membuat seluruh tabel baru', async () => {
    for (const t of NEW_TABLES) {
      const r = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS exists`, [t]);
      expect(r.rows[0].exists, `missing ${t}`).toBe(true);
    }
  });

  it('menambah kolom profil pada employees dan is_public pada job_postings', async () => {
    const emp = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name='employees'`);
    const cols = emp.rows.map((r) => r.column_name);
    expect(cols).toEqual(expect.arrayContaining(['date_of_birth', 'address', 'emergency_contact_name', 'emergency_contact_phone', 'photo_url', 'bio']));
    const jp = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name='job_postings'`);
    expect(jp.rows.map((r) => r.column_name)).toContain('is_public');
  });
});
