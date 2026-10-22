import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as listBpjs } from '@/app/api/v1/hr/social-security/route';
import { PUT as putBpjs } from '@/app/api/v1/hr/employees/[id]/social-security/route';
import { GET as listDocs } from '@/app/api/v1/hr/documents/route';
import { GET as listActions, POST as postAction } from '@/app/api/v1/hr/disciplinary-actions/route';
import { PUT as putAppeal } from '@/app/api/v1/hr/disciplinary-actions/[id]/appeal/route';
import { GET as listLadder, POST as postStep } from '@/app/api/v1/hr/career-ladder/route';
import { PUT as putStep, DELETE as deleteStep } from '@/app/api/v1/hr/career-ladder/[id]/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000001';
const EMP_USER = 'e0000000-0000-4000-8000-000000000004';
const HR_EMPLOYEE = 'b0000000-0000-4000-8000-000000000001';

const jsonReq = (path: string, method: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });
const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });
const delReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'DELETE', headers: new Headers({ cookie }) });

describe('panel HR — data kepegawaian', () => {
  let hrCookie = '';
  let empCookie = '';
  let employeeId = '';
  let actionId = '';
  let stepId = '';
  let fromPosition = '';
  let toPosition = '';
  const stamp = Date.now();

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);

    const emp = await client.query<{ id: string; position_id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'Data Uji HR', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 9000000, CURRENT_DATE)
       RETURNING id, position_id`,
      [`HRDATA-${stamp}`, `hrdata.${stamp}@eperformiq.co.id`],
    );
    employeeId = emp.rows[0].id;
    fromPosition = emp.rows[0].position_id;

    const other = await client.query<{ id: string }>(
      `SELECT id FROM job_positions WHERE id <> $1::uuid ORDER BY id LIMIT 1`, [fromPosition],
    );
    toPosition = other.rows[0].id;

    await client.query(
      `INSERT INTO employee_documents (employee_id, document_type, file_url, verification_status)
       VALUES ($1::uuid, 'KTP', 'https://files.example.com/ktp.pdf', 'PENDING')`,
      [employeeId],
    );

    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: HR_EMPLOYEE, role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: EMP_USER, employeeId: 'b0000000-0000-4000-8000-000000000004', role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
  });

  /* ------------------------------- BPJS ------------------------------- */

  it('BPJS: karyawan tidak boleh membaca daftar HR', async () => {
    const res = await listBpjs(getReq('/api/v1/hr/social-security', empCookie));
    expect(res.status).toBe(403);
  });

  it('BPJS: daftar HR menampilkan nomor ter-masking', async () => {
    const client = await getDb();
    await client.query(
      `INSERT INTO employee_social_security (employee_id, bpjs_tk_number, bpjs_kes_class)
       VALUES ($1::uuid, '8109876543210987', 'Kelas 2')`,
      [employeeId],
    );

    const res = await listBpjs(getReq('/api/v1/hr/social-security', hrCookie));
    expect(res.status).toBe(200);

    const items = (await res.json()).data.items as any[];
    const row = items.find((i) => i.employeeId === employeeId);
    expect(row.bpjsTkNumber).toBe('••••••••••••0987');
    expect(row.bpjsKesClass).toBe('Kelas 2');
    expect(JSON.stringify(items)).not.toContain('8109876543210987');
  });

  it('BPJS: HR memperbarui data peserta', async () => {
    const res = await putBpjs(
      jsonReq(`/api/v1/hr/employees/${employeeId}/social-security`, 'PUT', {
        bpjsTkNumber: '8101111222233334',
        bpjsKesNumber: '0009876543210',
        bpjsKesClass: 'Kelas 1',
        bpjsTkStatus: 'ACTIVE',
      }, hrCookie),
      { params: { id: employeeId } } as any,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.bpjsTkNumber).toBe('••••••••••••3334');
  });

  it('BPJS: karyawan tidak boleh memperbarui', async () => {
    const res = await putBpjs(
      jsonReq(`/api/v1/hr/employees/${employeeId}/social-security`, 'PUT', {
        bpjsTkNumber: '1234',
      }, empCookie),
      { params: { id: employeeId } } as any,
    );
    expect(res.status).toBe(403);
  });

  it('BPJS: nomor tidak valid ditolak', async () => {
    const res = await putBpjs(
      jsonReq(`/api/v1/hr/employees/${employeeId}/social-security`, 'PUT', {
        bpjsTkNumber: 'bukan-angka',
      }, hrCookie),
      { params: { id: employeeId } } as any,
    );
    expect(res.status).toBe(400);
  });

  /* ------------------------------ Berkas ------------------------------ */

  it('Berkas: daftar HR memuat status verifikasi', async () => {
    const res = await listDocs(getReq('/api/v1/hr/documents', hrCookie));
    expect(res.status).toBe(200);
    const items = (await res.json()).data.items as any[];
    const row = items.find((d) => d.employeeId === employeeId);
    expect(row.verificationStatus).toBe('PENDING');
    expect(row.employeeName).toBe('Data Uji HR');
  });

  it('Berkas: filter status PENDING', async () => {
    const res = await listDocs(getReq('/api/v1/hr/documents?status=PENDING', hrCookie));
    const items = (await res.json()).data.items as any[];
    expect(items.every((d) => d.verificationStatus === 'PENDING')).toBe(true);
  });

  it('Berkas: filter status tak dikenal → 400', async () => {
    const res = await listDocs(getReq('/api/v1/hr/documents?status=ANEh', hrCookie));
    expect(res.status).toBe(400);
  });

  it('Berkas: karyawan ditolak', async () => {
    const res = await listDocs(getReq('/api/v1/hr/documents', empCookie));
    expect(res.status).toBe(403);
  });

  /* ------------------------------ Sanksi ------------------------------ */

  it('Sanksi: HR menerbitkan SP1', async () => {
    const res = await postAction(jsonReq('/api/v1/hr/disciplinary-actions', 'POST', {
      employeeId,
      actionType: 'SP1',
      reason: 'Terlambat berulang tiga kali',
      effectiveDate: '2026-10-20',
    }, hrCookie));
    expect(res.status).toBe(200);

    const json = await res.json();
    actionId = json.data.id;
    expect(json.data.appealStatus).toBe('NONE');
    expect(String(json.data.appealDeadline).slice(0, 10)).toBe('2026-10-25');
  });

  it('Sanksi: alasan terlalu pendek ditolak', async () => {
    const res = await postAction(jsonReq('/api/v1/hr/disciplinary-actions', 'POST', {
      employeeId, actionType: 'SP2', reason: 'x', effectiveDate: '2026-10-20',
    }, hrCookie));
    expect(res.status).toBe(400);
  });

  it('Sanksi: karyawan tidak boleh menerbitkan', async () => {
    const res = await postAction(jsonReq('/api/v1/hr/disciplinary-actions', 'POST', {
      employeeId, actionType: 'SP1', reason: 'percobaan', effectiveDate: '2026-10-20',
    }, empCookie));
    expect(res.status).toBe(403);
  });

  it('Sanksi: daftar HR memuat nama karyawan', async () => {
    const res = await listActions(getReq('/api/v1/hr/disciplinary-actions', hrCookie));
    expect(res.status).toBe(200);
    const row = ((await res.json()).data.items as any[]).find((a) => a.id === actionId);
    expect(row.employeeName).toBe('Data Uji HR');
  });

  it('Sanksi: keputusan keberatan hanya untuk yang UNDER_APPEAL', async () => {
    const res = await putAppeal(
      jsonReq(`/api/v1/hr/disciplinary-actions/${actionId}/appeal`, 'PUT', {
        decision: 'APPEAL_ACCEPTED', note: 'bukti dinas luar valid',
      }, hrCookie),
      { params: { id: actionId } } as any,
    );
    expect(res.status).toBe(422);
  });

  it('Sanksi: HR menerima keberatan setelah karyawan mengajukan', async () => {
    const client = await getDb();
    await client.query(
      `UPDATE disciplinary_actions SET appeal_status = 'UNDER_APPEAL', appeal_reason = 'saya dinas luar'
        WHERE id = $1::uuid`,
      [actionId],
    );

    const res = await putAppeal(
      jsonReq(`/api/v1/hr/disciplinary-actions/${actionId}/appeal`, 'PUT', {
        decision: 'APPEAL_ACCEPTED', note: 'bukti dinas luar valid',
      }, hrCookie),
      { params: { id: actionId } } as any,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.appealStatus).toBe('APPEAL_ACCEPTED');
  });

  /* --------------------------- Jenjang karir -------------------------- */

  it('Karir: HR menambah tahapan', async () => {
    const res = await postStep(jsonReq('/api/v1/hr/career-ladder', 'POST', {
      fromPositionId: fromPosition,
      toPositionId: toPosition,
      stepOrder: 1,
      stepName: 'Sertifikasi manajemen proyek',
      requirementType: 'CERTIFICATION',
      requirementRef: 'PMP',
      thresholdValue: 1,
    }, hrCookie));
    expect(res.status).toBe(200);

    const json = await res.json();
    stepId = json.data.id;
    expect(json.data.requirementType).toBe('CERTIFICATION');
  });

  it('Karir: posisi asal = tujuan ditolak', async () => {
    const res = await postStep(jsonReq('/api/v1/hr/career-ladder', 'POST', {
      fromPositionId: fromPosition, toPositionId: fromPosition, stepOrder: 2,
      stepName: 'Tidak valid', requirementType: 'TENURE', thresholdValue: 12,
    }, hrCookie));
    expect(res.status).toBe(422);
  });

  it('Karir: urutan tahapan duplikat ditolak', async () => {
    const res = await postStep(jsonReq('/api/v1/hr/career-ladder', 'POST', {
      fromPositionId: fromPosition, toPositionId: toPosition, stepOrder: 1,
      stepName: 'Duplikat', requirementType: 'TENURE', thresholdValue: 12,
    }, hrCookie));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('Karir: daftar HR memuat nama posisi', async () => {
    const res = await listLadder(getReq('/api/v1/hr/career-ladder', hrCookie));
    expect(res.status).toBe(200);
    const row = ((await res.json()).data.items as any[]).find((s) => s.id === stepId);
    expect(row.fromPositionTitle).toBeTruthy();
    expect(row.toPositionTitle).toBeTruthy();
  });

  it('Karir: HR memperbarui ambang tahapan', async () => {
    const res = await putStep(
      jsonReq(`/api/v1/hr/career-ladder/${stepId}`, 'PUT', { thresholdValue: 2 }, hrCookie),
      { params: { id: stepId } } as any,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.thresholdValue).toBe(2);
  });

  it('Karir: karyawan tidak boleh mengubah konfigurasi', async () => {
    const res = await postStep(jsonReq('/api/v1/hr/career-ladder', 'POST', {
      fromPositionId: fromPosition, toPositionId: toPosition, stepOrder: 3,
      stepName: 'Percobaan', requirementType: 'TENURE', thresholdValue: 12,
    }, empCookie));
    expect(res.status).toBe(403);
  });

  it('Karir: HR menghapus tahapan', async () => {
    const res = await deleteStep(
      delReq(`/api/v1/hr/career-ladder/${stepId}`, hrCookie),
      { params: { id: stepId } } as any,
    );
    expect(res.status).toBe(200);

    const list = await listLadder(getReq('/api/v1/hr/career-ladder', hrCookie));
    expect(((await list.json()).data.items as any[]).some((s) => s.id === stepId)).toBe(false);
  });
});
