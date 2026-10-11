import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { db, getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME, type SessionPayload } from '@/lib/auth/session';
import { POST as postRuns } from '@/app/api/v1/payroll/runs/route';
import {
  createOffboardingRequest,
  verifyHandoverItem,
  calculateOffboardingSeverance,
} from '@/lib/services/offboardingService';
import { selectHandoversByRequest } from '@/lib/repositories/offboardingRepository';
import { getPayslipDetail } from '@/lib/services/payrollService';

function req(path: string, method: string, body: unknown, cookie?: string): NextRequest {
  const headers = new Headers();
  if (body) headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
}

const HR_USER = 'e0000000-0000-4000-8000-000000000002';
const EMP = 'b0000000-0000-4000-8000-000000000004'; // Budi Pratama

const HR_SESSION: SessionPayload = {
  userId: HR_USER,
  employeeId: 'b0000000-0000-4000-8000-000000000002',
  role: 'HR_MANAGER',
  email: 'siti.nurhaliza@eperformiq.co.id',
};

describe('Payroll final settlement (pesangon → slip gaji)', () => {
  let hrCookie = '';
  let offboardingRequestId = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;

    // Bersihkan state karyawan uji agar idempoten.
    await client.query(`DELETE FROM payroll_items WHERE employee_id = $1::uuid`, [EMP]);
    await client.query(`DELETE FROM knowledge_handovers WHERE offboarding_request_id IN (SELECT id FROM offboarding_requests WHERE employee_id = $1::uuid)`, [EMP]);
    await client.query(`DELETE FROM severance_calculations WHERE offboarding_request_id IN (SELECT id FROM offboarding_requests WHERE employee_id = $1::uuid)`, [EMP]);
    await client.query(`DELETE FROM offboarding_requests WHERE employee_id = $1::uuid`, [EMP]);
    await client.query(`DELETE FROM payroll_runs WHERE period_code LIKE $1`, ['2026-12-FS-%']);

    const created = await createOffboardingRequest(db, HR_SESSION, {
      employeeId: EMP,
      reasonForLeaving: 'Resign',
      resignationNoticeDate: '2026-11-01',
      lastWorkingDay: '2026-12-01',
    });
    offboardingRequestId = created.id;
  });

  it('POST runs(FS) ditolak tanpa offboardingRequestId', async () => {
    const res = await postRuns(req('/x', 'POST', {
      periodCode: '2026-12', periodStart: '2026-12-01', periodEnd: '2026-12-31', mode: 'FINAL_SETTLEMENT',
    }, hrCookie));
    expect(res.status).toBe(400);
  });

  it('POST runs(FS) gagal bila pesangon belum dihitung', async () => {
    const res = await postRuns(req('/x', 'POST', {
      periodCode: '2026-12', periodStart: '2026-12-01', periodEnd: '2026-12-31',
      mode: 'FINAL_SETTLEMENT', offboardingRequestId,
    }, hrCookie));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('POST runs(FS) membuat run + slip gaji memuat komponen pesangon', async () => {
    // Verifikasi seluruh handover via service agar gate clearance lolos, lalu hitung pesangon.
    const handovers = await selectHandoversByRequest(db, offboardingRequestId);
    expect(handovers.length).toBeGreaterThan(0);
    for (const h of handovers) {
      await verifyHandoverItem(db, HR_SESSION, h.id);
    }
    const severance = await calculateOffboardingSeverance(db, HR_SESSION, offboardingRequestId, 'EFFICIENCY');
    expect(Number(severance.totalDisbursement)).toBeGreaterThan(0);

    const res = await postRuns(req('/x', 'POST', {
      periodCode: '2026-12', periodStart: '2026-12-01', periodEnd: '2026-12-31',
      mode: 'FINAL_SETTLEMENT', offboardingRequestId,
    }, hrCookie));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.runId).toBeTruthy();
    expect(j.data.severance).toBeGreaterThan(0);
    expect(j.data.net).toBeCloseTo(Number(j.data.severance) + Number(j.data.dplkTopup), 2);

    // Slip gaji karyawan harus memuat severance & runType FINAL_SETTLEMENT.
    const slip = await getPayslipDetail(db, EMP);
    expect(slip).toBeTruthy();
    expect(slip!.runType).toBe('FINAL_SETTLEMENT');
    expect(Number(slip!.severance)).toBeGreaterThan(0);
  });
});
