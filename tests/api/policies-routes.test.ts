import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb, db as appDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { publishVersion } from '@/lib/services/policyService';
import { GET as getPolicies } from '@/app/api/v1/policies/route';
import { GET as getPolicy } from '@/app/api/v1/policies/[id]/route';
import { POST as postAck } from '@/app/api/v1/policies/[id]/acknowledge/route';
import { GET as getCompliance } from '@/app/api/v1/policies/compliance/route';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const ADMIN_USER = 'e0000000-0000-4000-8000-000000000005';

const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });
const postReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST', headers: new Headers({ cookie }), body: JSON.stringify({}),
  });

describe('perpustakaan kebijakan', () => {
  let empCookie = '';
  let adminCookie = '';
  let v1Id = '';
  let v2Id = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    const db = appDb;

    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: BUDI, role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
    adminCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: ADMIN_USER, employeeId: 'b0000000-0000-4000-8000-000000000005', role: 'SUPER_ADMIN', email: 'audit@eperformiq.co.id' })}`;

    const stamp = Date.now();
    const v1 = await publishVersion(db, {
      documentCode: `SOP-HR-${stamp}`, title: 'SOP Cuti', policyType: 'SOP',
      version: '1.0', effectiveDate: '2026-01-01', fileUrl: 'https://files.example.com/sop-v1.pdf',
    });
    v1Id = v1.id;

    const v2 = await publishVersion(db, {
      documentCode: `SOP-HR-${stamp}`, title: 'SOP Cuti', policyType: 'SOP',
      version: '2.0', effectiveDate: '2026-10-01', fileUrl: 'https://files.example.com/sop-v2.pdf',
      supersedesId: v1Id,
    });
    v2Id = v2.id;
  });

  it('hanya versi AKTIF yang tampil; versi lama OBSOLETE', async () => {
    const res = await getPolicies(getReq('/api/v1/policies', empCookie));
    expect(res.status).toBe(200);
    const ids = (await res.json()).data.items.map((p: any) => p.id);
    expect(ids).toContain(v2Id);
    expect(ids).not.toContain(v1Id);
  });

  it('detail dokumen bisa dibaca', async () => {
    const res = await getPolicy(getReq(`/api/v1/policies/${v2Id}`, empCookie), { params: { id: v2Id } } as any);
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('AKTIF');
  });

  it('dokumen tak dikenal → 404', async () => {
    const unknown = '00000000-0000-4000-8000-000000000000';
    const res = await getPolicy(getReq(`/api/v1/policies/${unknown}`, empCookie), { params: { id: unknown } } as any);
    expect(res.status).toBe(404);
  });

  it('acknowledgment versi lama tidak memenuhi versi baru', async () => {
    const client = await getDb();
    await client.query(
      `INSERT INTO policy_acknowledgments (policy_document_id, employee_id) VALUES ($1::uuid, $2::uuid)`,
      [v1Id, BUDI],
    );

    const res = await getPolicies(getReq('/api/v1/policies', empCookie));
    const row = (await res.json()).data.items.find((p: any) => p.id === v2Id);
    expect(row.acknowledgedAt).toBeNull();
  });

  it('menandai paham versi aktif', async () => {
    const res = await postAck(postReq(`/api/v1/policies/${v2Id}/acknowledge`, empCookie), { params: { id: v2Id } } as any);
    expect(res.status).toBe(200);

    const list = await getPolicies(getReq('/api/v1/policies', empCookie));
    const row = (await list.json()).data.items.find((p: any) => p.id === v2Id);
    expect(row.acknowledgedAt).toBeTruthy();
  });

  it('menandai paham dua kali tidak menggandakan baris', async () => {
    const res = await postAck(postReq(`/api/v1/policies/${v2Id}/acknowledge`, empCookie), { params: { id: v2Id } } as any);
    expect(res.status).toBe(200);

    const client = await getDb();
    const count = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM policy_acknowledgments
        WHERE policy_document_id = $1::uuid AND employee_id = $2::uuid`,
      [v2Id, BUDI],
    );
    expect(count.rows[0].n).toBe(1);
  });

  it('menolak acknowledgment pada dokumen non-aktif', async () => {
    const res = await postAck(postReq(`/api/v1/policies/${v1Id}/acknowledge`, empCookie), { params: { id: v1Id } } as any);
    expect(res.status).toBe(422);
  });

  it('kepatuhan acknowledgment hanya untuk super admin/HR', async () => {
    const denied = await getCompliance(getReq('/api/v1/policies/compliance', empCookie));
    expect(denied.status).toBe(403);

    const allowed = await getCompliance(getReq('/api/v1/policies/compliance', adminCookie));
    expect(allowed.status).toBe(200);
    expect(Array.isArray((await allowed.json()).data.items)).toBe(true);
  });
});
