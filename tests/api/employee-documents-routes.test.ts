import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import type { SqlClient } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getDocs, POST as postDoc } from '@/app/api/v1/me/documents/route';
import { PUT as putVerify } from '@/app/api/v1/hr/documents/[id]/verify/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000001';

const jsonReq = (path: string, method: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });
const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });

describe('employee documents', () => {
  let client: SqlClient;
  let empCookie = '';
  let hrCookie = '';
  let docId = '';

  beforeAll(async () => {
    client = await getDb();
    await runSeed(client);

    const stamp = Date.now();
    const emp = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'Berkas Uji', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 8000000, CURRENT_DATE)
       RETURNING id`,
      [`DOC-${stamp}`, `doc.${stamp}@eperformiq.co.id`],
    );
    const employeeId = emp.rows[0].id;

    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: `u-doc-${stamp}`, employeeId, role: 'EMPLOYEE', email: `doc.${stamp}@eperformiq.co.id` })}`;
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
  });

  it('menolak tipe berkas yang tidak diizinkan', async () => {
    const res = await postDoc(jsonReq('/api/v1/me/documents', 'POST', {
      documentType: 'KTP', fileUrl: 'https://files.example.com/ktp.exe',
    }, empCookie));
    expect(res.status).toBe(400);
  });

  it('menolak kedaluwarsa sebelum tanggal terbit', async () => {
    const res = await postDoc(jsonReq('/api/v1/me/documents', 'POST', {
      documentType: 'KTP', fileUrl: 'https://files.example.com/ktp.pdf',
      issuedDate: '2026-10-10', expiryDate: '2026-10-01',
    }, empCookie));
    expect(res.status).toBe(422);
  });

  it('mengunggah KTP → PENDING', async () => {
    const res = await postDoc(jsonReq('/api/v1/me/documents', 'POST', {
      documentType: 'KTP', fileUrl: 'https://files.example.com/ktp.pdf',
    }, empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.verificationStatus).toBe('PENDING');
    docId = json.data.id;
  });

  it('HR memverifikasi berkas', async () => {
    const res = await putVerify(
      jsonReq(`/api/v1/hr/documents/${docId}/verify`, 'PUT', { decision: 'VERIFIED' }, hrCookie),
      { params: { id: docId } } as any,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.verificationStatus).toBe('VERIFIED');
  });

  it('verifikasi kedua ditolak', async () => {
    const res = await putVerify(
      jsonReq(`/api/v1/hr/documents/${docId}/verify`, 'PUT', { decision: 'REJECTED' }, hrCookie),
      { params: { id: docId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('karyawan tidak boleh memverifikasi berkas', async () => {
    const other = await postDoc(jsonReq('/api/v1/me/documents', 'POST', {
      documentType: 'NPWP', fileUrl: 'https://files.example.com/npwp.pdf',
    }, empCookie));
    const id = (await other.json()).data.id;

    const res = await putVerify(
      jsonReq(`/api/v1/hr/documents/${id}/verify`, 'PUT', { decision: 'VERIFIED' }, empCookie),
      { params: { id } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('karyawan melihat berkasnya sendiri', async () => {
    const res = await getDocs(getReq('/api/v1/me/documents', empCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.find((d: any) => d.id === docId)?.verificationStatus).toBe('VERIFIED');
  });
});
