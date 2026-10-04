import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  registerEmployee, verifyEmployeeEmail, listPendingRegistrations,
  approveRegistration, rejectRegistration,
} from '@/lib/services/employeeRegistrationService';

describe('WS-2 registrasi mandiri karyawan', () => {
  let client: PGlite; let db: any;
  beforeAll(async () => { ({ client, db } = await createTestDb()); await runSeed(client); });
  afterAll(async () => { await client.close(); });

  it('register → PENDING_EMAIL + token 64 char', async () => {
    const r = await registerEmployee(db, { fullName: 'Sari Baru', email: 'sari.baru@example.com', password: 'rahasia123' });
    expect(r.status).toBe('PENDING_EMAIL');
    expect(r.verifyToken).toHaveLength(64);
  });

  it('duplicate email ditolak', async () => {
    await registerEmployee(db, { fullName: 'X', email: 'dupe@example.com', password: 'rahasia123' });
    await expect(registerEmployee(db, { fullName: 'Y', email: 'dupe@example.com', password: 'rahasia123' }))
      .rejects.toThrow(/sudah terdaftar/i);
  });

  it('verify token valid → ok', async () => {
    const { verifyToken } = await registerEmployee(db, { fullName: 'Verif', email: 'verif@example.com', password: 'x1234567' });
    expect((await verifyEmployeeEmail(db, verifyToken)).ok).toBe(true);
  });

  it('token tidak valid → INVALID', async () => {
    expect(await verifyEmployeeEmail(db, 'tidak-ada-token')).toEqual({ ok: false, reason: 'INVALID' });
  });

  it('approve membuat user + employee, idempotent', async () => {
    const { verifyToken } = await registerEmployee(db, { fullName: 'Approve Me', email: 'appr@example.com', password: 'x1234567' });
    await verifyEmployeeEmail(db, verifyToken);
    const pend = (await listPendingRegistrations(db)).find((p) => p.email === 'appr@example.com')!;
    const dept = (await client.query<{ id: string }>(`SELECT id FROM departments LIMIT 1`)).rows[0].id;
    const pos = (await client.query<{ id: string }>(`SELECT id FROM job_positions LIMIT 1`)).rows[0].id;
    const a = await approveRegistration(db, pend.id, { approvedBy: 'admin', departmentId: dept, positionId: pos });
    expect(a.userId).toBeTruthy();
    const again = await approveRegistration(db, pend.id, { approvedBy: 'admin', departmentId: dept, positionId: pos });
    expect(again.userId).toBe(a.userId);
    const n = await client.query<{ c: string }>(`SELECT COUNT(*)::text c FROM users WHERE LOWER(email)='appr@example.com'`);
    expect(n.rows[0].c).toBe('1');
  });

  it('reject menandai REJECTED', async () => {
    const { verifyToken } = await registerEmployee(db, { fullName: 'R', email: 'rej@example.com', password: 'x1234567' });
    await verifyEmployeeEmail(db, verifyToken);
    const pend = (await listPendingRegistrations(db)).find((p) => p.email === 'rej@example.com')!;
    await rejectRegistration(db, pend.id, { approvedBy: 'admin', reason: 'bukan karyawan' });
    const row = await client.query<{ status: string }>(`SELECT status FROM employee_registrations WHERE id=$1::uuid`, [pend.id]);
    expect(row.rows[0].status).toBe('REJECTED');
  });
});
