import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { runSeed } from '@/lib/db/seed';
import { db, getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { POST as contractAction } from '@/app/api/v1/hr/contracts/actions/route';
import { extendContract, convertToPermanent } from '@/lib/services/contractActionService';

const HR_USER = 'e0000000-0000-4000-8000-000000000002';
const EMPLOYEE_USER = 'e0000000-0000-4000-8000-000000000006';

// Pegawai PKWT hasil seed: masa berlaku relatif terhadap tanggal acuan seed,
// sehingga nilainya diambil ulang dari basis data agar uji tidak rapuh.
const MAYA = 'c0000000-0000-4000-8000-000000000102';
const LESTARI = 'c0000000-0000-4000-8000-000000000104';
const BUDI = 'b0000000-0000-4000-8000-000000000004';

function req(path: string, method: string, cookie?: string, body?: unknown): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function contractOf(employeeId: string): Promise<{
  employmentStatus: string;
  contractStartDate: string | null;
  contractEndDate: string | null;
}> {
  const res = (await db.execute(sql`
    SELECT
      employment_status::text AS employment_status,
      contract_start_date::text AS contract_start_date,
      contract_end_date::text AS contract_end_date
    FROM employees WHERE id = ${employeeId}::uuid
  `)) as unknown as {
    rows: Array<{ employment_status: string; contract_start_date: string | null; contract_end_date: string | null }>;
  };
  const row = res.rows[0];
  return {
    employmentStatus: row.employment_status,
    contractStartDate: row.contract_start_date,
    contractEndDate: row.contract_end_date,
  };
}

function plusYear(iso: string): string {
  return `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;
}

/**
 * Seed bersifat idempotent (ON CONFLICT DO NOTHING), sehingga baris yang sudah
 * diubah oleh uji lain tidak kembali ke kondisi awal. Uji yang mengubah status
 * kontrak harus mengembalikan baris tersebut ke PKWT secara eksplisit.
 */
async function resetToPkwt(employeeId: string, startDate: string, endDate: string): Promise<void> {
  await db.execute(sql`
    UPDATE employees
       SET employment_status = 'PKWT',
           status = 'CONTRACT',
           contract_start_date = ${startDate}::date,
           contract_end_date = ${endDate}::date
     WHERE id = ${employeeId}::uuid
  `);
  await db.execute(sql`DELETE FROM employment_status_history WHERE employee_id = ${employeeId}::uuid`);
}

describe('contractActionService', () => {
  beforeAll(async () => {
    await runSeed(await getDb());
  });

  it('memperpanjang PKWT dan mencatat audit log', async () => {
    const before = await contractOf(MAYA);
    expect(before.employmentStatus).toBe('PKWT');
    expect(before.contractEndDate).not.toBeNull();

    const newEndDate = plusYear(before.contractEndDate as string);
    const result = await extendContract(db, {
      employeeId: MAYA,
      newEndDate,
      effectiveDate: before.contractEndDate as string,
      reason: 'Perpanjangan PKWT periode berikutnya',
      decidedBy: HR_USER,
    });

    expect(result.employmentStatus).toBe('PKWT');
    expect(result.contractEndDate).toBe(newEndDate);

    const audit = (await db.execute(sql`
      SELECT action_type, description FROM audit_logs
      WHERE record_id = ${MAYA} AND description LIKE '%Perpanjangan kontrak PKWT%'
    `)) as unknown as { rows: Array<{ action_type: string; description: string }> };
    expect(audit.rows.length).toBeGreaterThan(0);
  });

  it('menolak perpanjangan bila tanggal akhir baru tidak melewati tanggal lama', async () => {
    const before = await contractOf(MAYA);
    await expect(
      extendContract(db, {
        employeeId: MAYA,
        newEndDate: '2000-01-01',
        effectiveDate: '2000-01-01',
        reason: 'Perpanjangan tidak valid',
        decidedBy: HR_USER,
      })
    ).rejects.toThrow();
    const after = await contractOf(MAYA);
    expect(after.contractEndDate).toBe(before.contractEndDate);
  });

  it('menolak perpanjangan untuk pegawai bukan PKWT', async () => {
    await expect(
      extendContract(db, {
        employeeId: BUDI,
        newEndDate: '2030-01-01',
        effectiveDate: '2029-01-01',
        reason: 'Pegawai tetap tidak punya PKWT',
        decidedBy: HR_USER,
      })
    ).rejects.toThrow(/PKWT/);
  });

  it('mengangkat PKWT menjadi pegawai tetap beserta riwayat status', async () => {
    const seeded = await contractOf(LESTARI);
    await resetToPkwt(
      LESTARI,
      seeded.contractStartDate as string,
      seeded.contractEndDate as string
    );

    const before = await contractOf(LESTARI);
    expect(before.employmentStatus).toBe('PKWT');

    const result = await convertToPermanent(db, {
      employeeId: LESTARI,
      effectiveDate: before.contractStartDate as string,
      reason: 'Pengangkatan menjadi pegawai tetap',
      decidedBy: HR_USER,
    });
    expect(result.employmentStatus).toBe('PKWTT');

    const history = (await db.execute(sql`
      SELECT previous_status::text AS previous_status, new_status::text AS new_status
      FROM employment_status_history WHERE employee_id = ${LESTARI}::uuid
    `)) as unknown as { rows: Array<{ previous_status: string; new_status: string }> };
    expect(history.rows.some((r) => r.previous_status === 'PKWT' && r.new_status === 'PKWTT')).toBe(true);
  });

  it('menolak pengangkatan ulang pegawai yang sudah PKWTT', async () => {
    // Pastikan status PKWTT tanpa bergantung pada urutan uji sebelumnya.
    await db.execute(sql`
      UPDATE employees SET employment_status = 'PKWTT' WHERE id = ${LESTARI}::uuid
    `);
    await expect(
      convertToPermanent(db, {
        employeeId: LESTARI,
        effectiveDate: '2026-01-01',
        reason: 'Pengangkatan ganda',
        decidedBy: HR_USER,
      })
    ).rejects.toThrow(/PKWT/);
  });
});

describe('POST /api/v1/hr/contracts/actions', () => {
  let hrCookie = '';
  let employeeCookie = '';

  beforeEach(async () => {
    await runSeed(await getDb());
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;
    employeeCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: EMPLOYEE_USER, employeeId: null, role: 'EMPLOYEE', email: 'budi.pratama@eperformiq.co.id' })}`;
  });

  it('HR_MANAGER dapat memperpanjang PKWT', async () => {
    const current = await contractOf(MAYA);
    const newEndDate = plusYear(current.contractEndDate as string);
    const res = await contractAction(
      req(`/api/v1/hr/contracts/actions?employeeId=${MAYA}`, 'POST', hrCookie, {
        action: 'EXTEND',
        newEndDate,
        effectiveDate: current.contractEndDate,
        reason: 'Perpanjangan lewat API',
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('success');
    expect(body.data.contractEndDate).toBe(newEndDate);
  });

  it('menolak EMPLOYEE dengan 403', async () => {
    const res = await contractAction(
      req(`/api/v1/hr/contracts/actions?employeeId=${MAYA}`, 'POST', employeeCookie, {
        action: 'EXTEND',
        newEndDate: '2030-01-01',
        effectiveDate: '2029-01-01',
        reason: 'Percobaan tanpa hak',
      })
    );
    expect(res.status).toBe(403);
  });

  it('menolak permintaan tanpa sesi', async () => {
    const res = await contractAction(
      req(`/api/v1/hr/contracts/actions?employeeId=${MAYA}`, 'POST', undefined, {
        action: 'EXTEND',
        newEndDate: '2030-01-01',
        effectiveDate: '2029-01-01',
        reason: 'Tanpa sesi',
      })
    );
    expect(res.status).toBeGreaterThanOrEqual(401);
  });

  it('menolak employeeId yang bukan UUID dengan 400', async () => {
    const res = await contractAction(
      req('/api/v1/hr/contracts/actions?employeeId=bukan-uuid', 'POST', hrCookie, {
        action: 'EXTEND',
        newEndDate: '2030-01-01',
        effectiveDate: '2029-01-01',
        reason: 'Id tidak valid',
      })
    );
    expect(res.status).toBe(400);
  });

  it('menolak format tanggal yang salah dengan 400', async () => {
    const res = await contractAction(
      req(`/api/v1/hr/contracts/actions?employeeId=${MAYA}`, 'POST', hrCookie, {
        action: 'EXTEND',
        newEndDate: '01-01-2030',
        effectiveDate: '2029-01-01',
        reason: 'Format tanggal salah',
      })
    );
    expect(res.status).toBe(400);
  });

  it('menolak alasan yang terlalu pendek dengan 400', async () => {
    const res = await contractAction(
      req(`/api/v1/hr/contracts/actions?employeeId=${MAYA}`, 'POST', hrCookie, {
        action: 'EXTEND',
        newEndDate: '2030-01-01',
        effectiveDate: '2029-01-01',
        reason: 'x',
      })
    );
    expect(res.status).toBe(400);
  });

  it('mengembalikan 422 ketika aturan bisnis dilanggar', async () => {
    const current = await contractOf(MAYA);
    const res = await contractAction(
      req(`/api/v1/hr/contracts/actions?employeeId=${MAYA}`, 'POST', hrCookie, {
        action: 'EXTEND',
        newEndDate: current.contractEndDate,
        effectiveDate: current.contractEndDate,
        reason: 'Tanggal akhir tidak maju',
      })
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe('BUSINESS_RULE_VIOLATION');
  });
});
