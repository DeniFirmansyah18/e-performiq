import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { ForbiddenError } from '@/lib/auth/errors';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const DANU = 'b0000000-0000-4000-8000-000000000003';
const ANISA = 'b0000000-0000-4000-8000-000000000007';
const RIAN = 'b0000000-0000-4000-8000-000000000009';
const CEO = 'b0000000-0000-4000-8000-000000000001';

const sess = (role: string, employeeId: string | null): SessionPayload => ({
  userId: `u-${role}`,
  employeeId,
  role: role as any,
  email: 'x@y.z',
});

describe('row-level scope', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it('EMPLOYEE hanya melihat dirinya sendiri', async () => {
    const scope = await resolveVisibleEmployeeIds(db, sess('EMPLOYEE', BUDI));
    expect(scope).toEqual([BUDI]);
  });

  it('EMPLOYEE tidak melihat rekan kerja', async () => {
    const scope = await resolveVisibleEmployeeIds(db, sess('EMPLOYEE', BUDI));
    expect(scope).not.toContain(ANISA);
  });

  it('PEOPLE_MANAGER melihat dirinya + seluruh bawahan langsung', async () => {
    const scope = await resolveVisibleEmployeeIds(db, sess('PEOPLE_MANAGER', DANU));
    expect(scope).toEqual(expect.arrayContaining([DANU, BUDI, ANISA, RIAN]));
    expect(scope).not.toContain(CEO);
  });

  it('HR_MANAGER, BOD, AUDITOR, SUPER_ADMIN melihat seluruh organisasi', async () => {
    for (const role of ['HR_MANAGER', 'BOD', 'AUDITOR', 'SUPER_ADMIN']) {
      expect(await resolveVisibleEmployeeIds(db, sess(role, null))).toBe('ALL');
    }
  });

  it('assertEmployeeVisible melempar 403 untuk karyawan di luar scope', async () => {
    const scope = await resolveVisibleEmployeeIds(db, sess('EMPLOYEE', BUDI));
    expect(() => assertEmployeeVisible(scope, ANISA)).toThrow(ForbiddenError);
  });

  it('assertEmployeeVisible tidak melempar untuk karyawan di dalam scope', async () => {
    const scope = await resolveVisibleEmployeeIds(db, sess('EMPLOYEE', BUDI));
    expect(() => assertEmployeeVisible(scope, BUDI)).not.toThrow();
  });

  it('assertEmployeeVisible tidak melempar saat scope ALL', () => {
    expect(() => assertEmployeeVisible('ALL', ANISA)).not.toThrow();
  });

  it('berhenti pada kedalaman 5 saat hierarki melingkar', async () => {
    // Review Focus butir 3: A atasan B, B atasan A
    await client.exec(`
      ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_manager_id_fkey;
      UPDATE employees SET manager_id = '${BUDI}' WHERE id = '${DANU}';
      UPDATE employees SET manager_id = '${DANU}' WHERE id = '${BUDI}';
    `);

    const start = Date.now();
    const scope = await resolveVisibleEmployeeIds(db, sess('PEOPLE_MANAGER', DANU));
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);
    expect(Array.isArray(scope)).toBe(true);
  });
});
