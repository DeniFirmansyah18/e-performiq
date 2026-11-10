import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getMyProfile } from '@/lib/services/employeeProfileService';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const DANU = 'b0000000-0000-4000-8000-000000000003';
const HENDRA = 'b0000000-0000-4000-8000-000000000001';

describe('getMyProfile — konteks kepegawaian', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  it('menyertakan jabatan, departemen, dan atasan', async () => {
    const p = await getMyProfile(db, BUDI);
    expect(p.positionTitle).toBeTruthy();
    expect(p.departmentName).toBeTruthy();
    expect(p.managerName).toBe('Raden Mas Danu, S.T., M.Kom.');
  });

  it('menghitung bawahan langsung untuk People Manager', async () => {
    const p = await getMyProfile(db, DANU);
    expect(p.directReportCount).toBeGreaterThan(0);
  });

  it('tidak mengirim gaji pokok ke klien', async () => {
    const p = await getMyProfile(db, BUDI);
    expect('baseSalary' in p).toBe(false);
  });

  it('atasan NULL untuk CEO tidak membuat query gagal', async () => {
    const p = await getMyProfile(db, HENDRA);
    expect(p.managerName).toBeNull();
    expect(p.directReportCount).toBeGreaterThanOrEqual(0);
  });
});
