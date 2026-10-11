import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { ForbiddenError } from '@/lib/auth/errors';
import { can } from '@/lib/auth/rbac';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

const sess = (role: string, employeeId: string | null): SessionPayload => ({
  userId: `u-${role}`,
  employeeId,
  role: role as any,
  email: 'x@y.z',
});

describe('Stage 8 — pembatasan scope & RBAC peran ASSESSOR', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('ASSESSOR tidak lagi org-wide (bukan "ALL")', async () => {
    const scope = await resolveVisibleEmployeeIds(db, sess('ASSESSOR', BUDI));
    expect(scope).not.toBe('ALL');
    expect(scope).toEqual([]);
  });

  it('ASSESSOR tidak dapat mengakses data karyawan di luar scope (403)', async () => {
    const scope = await resolveVisibleEmployeeIds(db, sess('ASSESSOR', BUDI));
    expect(() => assertEmployeeVisible(scope, BUDI)).toThrow(ForbiddenError);
  });

  it('ASSESSOR tidak boleh profile:write', () => {
    expect(can('ASSESSOR', 'profile:write')).toBe(false);
  });

  it('ASSESSOR tetap boleh kalibrasi penilaian (kemandirian komite)', () => {
    expect(can('ASSESSOR', 'appraisal:calibrate')).toBe(true);
    expect(can('ASSESSOR', 'appraisal:calculate')).toBe(true);
  });

  it('peran org-wide lain tak terpengaruh', async () => {
    for (const role of ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'AUDITOR']) {
      expect(await resolveVisibleEmployeeIds(db, sess(role, null))).toBe('ALL');
    }
  });
});
