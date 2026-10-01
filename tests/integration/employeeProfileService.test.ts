import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { getMyProfile, updateMyProfile } from '@/lib/services/employeeProfileService';
import type { Db } from '@/lib/db/client';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const HR_USER = 'e0000000-0000-4000-8000-000000000002';

describe('employeeProfileService', () => {
  let client: PGlite; let db: Db;
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });
  afterAll(async () => { await client.close(); });

  it('getMyProfile mengembalikan data dasar', async () => {
    const p = await getMyProfile(db, BUDI);
    expect(p.fullName).toBeTruthy();
    expect(p.employeeCode).toBeTruthy();
  });

  it('updateMyProfile hanya mengubah field yang diizinkan (sensitif diabaikan)', async () => {
    await updateMyProfile(db, BUDI, { phone_number: '+62 812-9999-0000', base_salary: 1 } as any, HR_USER);
    const p = await getMyProfile(db, BUDI);
    expect(p.phoneNumber).toBe('+62 812-9999-0000');
    expect(Number(p.baseSalary)).not.toBe(1);
  });

  it('menulis satu baris audit_logs untuk perubahan profil', async () => {
    const before = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM audit_logs`);
    await updateMyProfile(db, BUDI, { bio: 'Update bio test' }, HR_USER);
    const after = await client.query<{ c: string }>(`SELECT count(*)::text AS c FROM audit_logs`);
    expect(Number(after.rows[0].c)).toBe(Number(before.rows[0].c) + 1);
    const row = await client.query<{ entity_name: string; record_id: string }>(
      `SELECT entity_name, record_id FROM audit_logs ORDER BY created_at DESC LIMIT 1`);
    expect(row.rows[0].entity_name).toBe('employees');
    expect(row.rows[0].record_id).toBe(BUDI);
  });
});
