import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { ForbiddenError } from '@/lib/auth/errors';
import { can } from '@/lib/auth/rbac';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import type { UserRole } from '@/types';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const DANU = 'b0000000-0000-4000-8000-000000000003';

const sess = (role: string, employeeId: string | null): SessionPayload => ({
  userId: `u-${role}`,
  employeeId,
  role: role as UserRole,
  email: 'x@y.z',
});

describe('Scope & RBAC per role setelah penyederhanaan 6 peran', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('role ASSESSOR sudah tidak ada di matriks RBAC', () => {
    // Setiap permission harus menolak string role yang tak terdaftar.
    expect(can('ASSESSOR' as UserRole, 'appraisal:calibrate')).toBe(false);
    expect(can('ASSESSOR' as UserRole, 'kpi:read')).toBe(false);
  });

  it('PEOPLE_MANAGER mewarisi tugas kalibrasi yang dulu milik assessor', async () => {
    const scope = await resolveVisibleEmployeeIds(db, sess('PEOPLE_MANAGER', DANU));
    expect(scope).not.toBe('ALL');
    expect(scope).toContain(BUDI);
  });

  it('EMPLOYEE hanya melihat dirinya sendiri', async () => {
    const scope = await resolveVisibleEmployeeIds(db, sess('EMPLOYEE', BUDI));
    expect(scope).toEqual([BUDI]);
  });

  it('EMPLOYEE tak dapat mengakses karyawan lain di luar scope (403)', async () => {
    const scope = await resolveVisibleEmployeeIds(db, sess('EMPLOYEE', BUDI));
    expect(() => assertEmployeeVisible(scope, BUDI)).not.toThrow();
    expect(() => assertEmployeeVisible(scope, DANU)).toThrow(ForbiddenError);
  });

  it('EMPLOYEE boleh mengubah profilnya sendiri namun tidak mengkalibrasi', () => {
    expect(can('EMPLOYEE', 'profile:write')).toBe(true);
    expect(can('EMPLOYEE', 'appraisal:calibrate')).toBe(false);
    expect(can('EMPLOYEE', 'appraisal:calculate')).toBe(false);
  });

  it('peran org-wide melihat seluruh organisasi', async () => {
    for (const role of ['SUPER_ADMIN', 'BOD', 'HR_MANAGER']) {
      expect(await resolveVisibleEmployeeIds(db, sess(role, null))).toBe('ALL');
    }
  });

  it('direktori pegawai terpisah dari employment:read', () => {
    // `employment:read` mencakup data DIRI SENDIRI, jadi EMPLOYEE memilikinya.
    expect(can('EMPLOYEE', 'employment:read')).toBe(true);
    // Direktori mencakup SELURUH perusahaan, jadi EMPLOYEE tidak boleh.
    expect(can('EMPLOYEE', 'directory:read')).toBe(false);
    for (const role of ['SUPER_ADMIN', 'BOD', 'HR_MANAGER', 'PEOPLE_MANAGER'] as UserRole[]) {
      expect(can(role, 'directory:read'), `${role} harus bisa membaca direktori`).toBe(true);
    }
  });

  it('manajemen akun hanya milik SUPER_ADMIN, bukan HR/BOD', () => {
    expect(can('SUPER_ADMIN', 'user:manage')).toBe(true);
    expect(can('SUPER_ADMIN', 'user:read')).toBe(true);
    for (const role of ['BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE'] as UserRole[]) {
      expect(can(role, 'user:manage'), `${role} tak boleh mengelola akun`).toBe(false);
      expect(can(role, 'user:read'), `${role} tak boleh membaca akun`).toBe(false);
    }
  });
});
