import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb, db as appDb } from '@/lib/db/client';
import type { SqlClient } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { issueDisciplinary, awardRecognition } from '@/lib/services/disciplinaryService';
import { GET as getActions } from '@/app/api/v1/me/disciplinary-actions/route';
import { POST as postAppeal } from '@/app/api/v1/me/disciplinary-actions/[id]/appeal/route';
import { GET as getRecognitions } from '@/app/api/v1/me/recognitions/route';

const ISSUER = 'e0000000-0000-4000-8000-000000000001';

const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });
const postReq = (path: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });

describe('disciplinary & recognition', () => {
  let client: SqlClient;
  let db: any;
  let empCookie = '';
  let activeId = '';
  let expiredId = '';
  let employeeId = '';
  const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const plusDays = (n: number) => {
    const d = new Date(`${today()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    client = await getDb();
    await runSeed(client);

    const stamp = Date.now();
    const emp = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'Sanksi Uji', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 8000000, CURRENT_DATE)
       RETURNING id`,
      [`DISC-${stamp}`, `disc.${stamp}@eperformiq.co.id`],
    );
    employeeId = emp.rows[0].id;
    // Service butuh instance Drizzle (db.execute(sql``)); getDb() mengembalikan
    // SqlClient untuk query mentah. Keduanya menunjuk database yang sama.
    db = appDb;

    // Ruling R7: tanggal relatif terhadap hari ini — tenggat keberatan hanya 5 hari,
    // jadi tanggal absolut akan kedaluwarsa dan tes gagal karena waktu, bukan kode.
    const active = await issueDisciplinary(db, {
      employeeId, actionType: 'SP1', reason: 'Terlambat berulang',
      effectiveDate: today(), issuedBy: ISSUER,
    });
    activeId = active.id;

    const expired = await issueDisciplinary(db, {
      employeeId, actionType: 'TEGURAN', reason: 'Tidak memakai ID card',
      effectiveDate: '2020-01-01', issuedBy: ISSUER,
    });
    expiredId = expired.id;
    await client.query(`UPDATE disciplinary_actions SET appeal_deadline = '2020-01-10' WHERE id = $1::uuid`, [expiredId]);

    await awardRecognition(db, {
      employeeId, recognitionType: 'EMPLOYEE_OF_THE_MONTH',
      title: 'Karyawan Terbaik Oktober', awardedDate: '2026-10-20', points: 50,
    });

    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: `u-disc-${stamp}`, employeeId, role: 'EMPLOYEE', email: `disc.${stamp}@eperformiq.co.id` })}`;
  });

  it('karyawan melihat sanksi aktif & tenggat keberatan', async () => {
    const res = await getActions(getReq('/api/v1/me/disciplinary-actions', empCookie));
    expect(res.status).toBe(200);
    const row = (await res.json()).data.items.find((i: any) => i.id === activeId);
    expect(row.actionType).toBe('SP1');
    expect(row.appealStatus).toBe('NONE');
    expect(String(row.appealDeadline).slice(0, 10)).toBe(plusDays(5));
  });

  it('keberatan mengubah status menjadi UNDER_APPEAL tanpa menghapus catatan', async () => {
    const res = await postAppeal(
      postReq(`/api/v1/me/disciplinary-actions/${activeId}/appeal`, { reason: 'Saya sedang dinas luar' }, empCookie),
      { params: { id: activeId } } as any,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.appealStatus).toBe('UNDER_APPEAL');

    const list = await getActions(getReq('/api/v1/me/disciplinary-actions', empCookie));
    const row = (await list.json()).data.items.find((i: any) => i.id === activeId);
    expect(row.reason).toBe('Terlambat berulang');
  });

  it('keberatan kedua ditolak', async () => {
    const res = await postAppeal(
      postReq(`/api/v1/me/disciplinary-actions/${activeId}/appeal`, { reason: 'mengulang keberatan' }, empCookie),
      { params: { id: activeId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('keberatan setelah tenggat ditolak', async () => {
    const res = await postAppeal(
      postReq(`/api/v1/me/disciplinary-actions/${expiredId}/appeal`, { reason: 'Terlambat mengajukan' }, empCookie),
      { params: { id: expiredId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);

    const list = await getActions(getReq('/api/v1/me/disciplinary-actions', empCookie));
    const row = (await list.json()).data.items.find((i: any) => i.id === expiredId);
    expect(row.appealStatus).toBe('NONE');
  });

  it('alasan sanksi terlalu pendek ditolak', async () => {
    await expect(issueDisciplinary(db, {
      employeeId, actionType: 'SP2', reason: 'x', effectiveDate: '2026-10-02', issuedBy: ISSUER,
    })).rejects.toThrow(/minimal 5 karakter/i);
  });

  it('karyawan melihat penghargaan', async () => {
    const res = await getRecognitions(getReq('/api/v1/me/recognitions', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.some((r: any) => r.title === 'Karyawan Terbaik Oktober')).toBe(true);
  });
});
