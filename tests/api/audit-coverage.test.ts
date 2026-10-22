import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import type { SqlClient } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { POST as publish } from '@/app/api/v1/policies/route';
import { PUT as putBpjs } from '@/app/api/v1/hr/employees/[id]/social-security/route';
import { POST as postAction } from '@/app/api/v1/hr/disciplinary-actions/route';
import { PUT as putVerify } from '@/app/api/v1/hr/documents/[id]/verify/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000001';

const jsonReq = (path: string, method: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });

describe('jejak audit untuk aksi HR sensitif', () => {
  let client: SqlClient;
  let hrCookie = '';
  let employeeId = '';
  let documentId = '';
  const stamp = Date.now();

  const auditCount = async (entityName: string) => {
    const res = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_logs WHERE entity_name = $1`, [entityName],
    );
    return Number(res.rows[0].n);
  };

  beforeAll(async () => {
    client = await getDb();
    await runSeed(client);

    const emp = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'Audit Uji', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 9000000, CURRENT_DATE) RETURNING id`,
      [`AUD-${stamp}`, `aud.${stamp}@eperformiq.co.id`],
    );
    employeeId = emp.rows[0].id;

    const doc = await client.query<{ id: string }>(
      `INSERT INTO employee_documents (employee_id, document_type, file_url, verification_status)
       VALUES ($1::uuid, 'KTP', 'https://files.example.com/ktp.pdf', 'PENDING') RETURNING id`,
      [employeeId],
    );
    documentId = doc.rows[0].id;

    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
  });

  beforeEach(() => {
    delete process.env.FILE_STORAGE_DIR;
    delete process.env.S3_BUCKET;
  });

  it('menerbitkan SOP tercatat di audit', async () => {
    const before = await auditCount('policy_documents');
    const res = await publish(jsonReq('/api/v1/policies', 'POST', {
      documentCode: `SOP-AUD-${stamp}`, title: 'SOP Audit', policyType: 'SOP',
      version: '1.0', effectiveDate: '2026-10-01', fileUrl: 'https://files.example.com/a.pdf',
    }, hrCookie));
    expect(res.status).toBe(200);
    expect(await auditCount('policy_documents')).toBe(before + 1);
  });

  it('menyimpan BPJS tercatat TANPA nomor lengkap', async () => {
    const before = await auditCount('employee_social_security');
    const res = await putBpjs(
      jsonReq(`/api/v1/hr/employees/${employeeId}/social-security`, 'PUT', {
        bpjsTkNumber: '8109999888877776', bpjsKesClass: 'Kelas 1',
      }, hrCookie),
      { params: { id: employeeId } } as any,
    );
    expect(res.status).toBe(200);
    expect(await auditCount('employee_social_security')).toBe(before + 1);

    const rows = await client.query<{ description: string; new_data: string | null }>(
      `SELECT description, new_data::text AS new_data FROM audit_logs
        WHERE entity_name = 'employee_social_security' ORDER BY id DESC LIMIT 1`,
    );
    const text = `${rows.rows[0].description ?? ''} ${rows.rows[0].new_data ?? ''}`;
    expect(text).not.toContain('8109999888877776');
    expect(text).toMatch(/BPJS/i);
  });

  it('menerbitkan sanksi tercatat di audit', async () => {
    const before = await auditCount('disciplinary_actions');
    const res = await postAction(jsonReq('/api/v1/hr/disciplinary-actions', 'POST', {
      employeeId, actionType: 'SP1', reason: 'Terlambat berulang', effectiveDate: '2026-10-20',
    }, hrCookie));
    expect(res.status).toBe(200);
    expect(await auditCount('disciplinary_actions')).toBe(before + 1);
  });

  it('verifikasi berkas tercatat di audit', async () => {
    const before = await auditCount('employee_documents');
    const res = await putVerify(
      jsonReq(`/api/v1/hr/documents/${documentId}/verify`, 'PUT', { decision: 'VERIFIED' }, hrCookie),
      { params: { id: documentId } } as any,
    );
    expect(res.status).toBe(200);
    expect(await auditCount('employee_documents')).toBe(before + 1);
  });

  it('setiap baris audit menyebut pelaku (user HR)', async () => {
    const rows = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_logs
        WHERE entity_name IN ('policy_documents','employee_social_security','disciplinary_actions','employee_documents')
          AND user_id = $1::uuid`,
      [HR_USER],
    );
    expect(Number(rows.rows[0].n)).toBeGreaterThanOrEqual(4);
  });
});
