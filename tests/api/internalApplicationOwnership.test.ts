import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/v1/talent-acquisition/applications/route';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';

// #1: HR tidak boleh memutuskan lamaran lowongan internal miliknya sendiri.

const dbs: any = { posting: '', emp: '', user: '' };

function buatReq(body: any, token: string) {
  return new NextRequest('http://localhost:3000/api/v1/talent-acquisition/applications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', cookie: SESSION_COOKIE_NAME + '=' + token },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const db: any = await getDb();
  const pos = await db.query('SELECT id::text AS id FROM job_postings ORDER BY posted_at LIMIT 1');
  dbs.posting = pos.rows[0] ? pos.rows[0].id : '';
  const hr = await db.query(
    'SELECT u.id::text AS uid, e.id::text AS eid FROM users u ' +
      'JOIN employees e ON e.id = u.employee_id ' +
      "WHERE e.employee_code = 'HRM-2018-0002' LIMIT 1"
  );
  dbs.user = hr.rows[0] ? hr.rows[0].uid : '';
  dbs.emp = hr.rows[0] ? hr.rows[0].eid : '';
}, 60000);

describe('#1 lamaran internal - pencegahan benturan kepentingan', () => {
  it('data uji tersedia', () => {
    expect(dbs.posting).toBeTruthy();
    expect(dbs.emp).toBeTruthy();
    expect(dbs.user).toBeTruthy();
  });

  it('HR ditolak saat memutuskan lamarannya sendiri', async () => {
    const db: any = await getDb();

    await db.query(
      'DELETE FROM internal_applications WHERE job_posting_id = $1 AND applicant_employee_id = $2',
      [dbs.posting, dbs.emp]
    );

    const ins = await db.query(
      'INSERT INTO internal_applications (job_posting_id, applicant_employee_id, cover_letter, cv_url) ' +
        'VALUES ($1, $2, $3, $4) RETURNING id::text AS id',
      [dbs.posting, dbs.emp, 'Saya tertarik pada posisi ini.', 'https://contoh.id/cv.pdf']
    );
    const appId = ins.rows[0].id;

    const token = await signSession({
      userId: dbs.user,
      employeeId: dbs.emp,
      role: 'HR_MANAGER',
      email: '[EMAIL_3]',
    } as any);

    const res = await PATCH(buatReq({ applicationId: appId, action: 'APPROVE' }, token));

    expect(res.status).toBe(403);
    const isi = await res.json();
    expect(String(isi.detail || '')).toMatch(/sendiri/i);

    const cek = await db.query('SELECT status FROM internal_applications WHERE id = $1', [appId]);
    expect(cek.rows[0].status).not.toBe('APPROVED');
  });
});
