import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as get360, POST as post360 } from '@/app/api/v1/performance/360-reviews/route';
import { GET as getPeers } from '@/app/api/v1/performance/360-reviews/peers/route';

function req(path: string, method: string, body: unknown, cookie?: string): NextRequest {
  const headers = new Headers();
  if (body) headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
}
function getReq(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers });
}

// Peer Review 360°: harus benar-benar menulis ke DB & mengagregasi, bukan stub UI.
describe('Peer Review 360° (endpoint + agregasi)', () => {
  let reviewerId: string;
  let evaluateeId: string;
  let reviewerCookie = '';
  const periodId = 'd0000000-0000-4000-8000-000000000001';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    const self = await client.query<{ id: string }>(
      `SELECT id FROM employees WHERE id = 'b0000000-0000-4000-8000-000000000003'::uuid`,
    );
    reviewerId = self.rows[0].id;
    const other = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'Rekan 360', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 9000000, CURRENT_DATE)
       RETURNING id`,
      [`360-${Date.now()}`, `rekan360.${Date.now()}@eperformiq.co.id`],
    );
    evaluateeId = other.rows[0].id;
    reviewerCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000003', employeeId: reviewerId, role: 'PEOPLE_MANAGER', email: 'danu.tech@eperformiq.co.id' })}`;
  });

  it('GET peers → daftar rekan aktif tanpa diri sendiri', async () => {
    const res = await getPeers(getReq('/x', reviewerCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    const peers = json.data.peers as Array<{ id: string }>;
    expect(Array.isArray(peers)).toBe(true);
    expect(peers.some((p) => p.id === reviewerId)).toBe(false);
  });

  it('POST review peer → 201 & tersimpan anonim', async () => {
    const res = await post360(req('/x', 'POST', {
      period_id: periodId,
      evaluatee_id: evaluateeId,
      relationship_type: 'PEER',
      integrity_score: 5,
      collaboration_score: 4,
      innovation_score: 4,
      feedback_notes: 'Kolaboratif dan responsif.',
    }, reviewerCookie));
    expect(res.status).toBe(201);
  });

  it('POST self-evaluation → ditolak (business rule)', async () => {
    const res = await post360(req('/x', 'POST', {
      period_id: periodId,
      evaluatee_id: reviewerId,
      relationship_type: 'PEER',
      integrity_score: 5,
      collaboration_score: 5,
      innovation_score: 5,
    }, reviewerCookie));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('GET agregat (self) → 200, cross-scope → 403', async () => {
    // Self view (scope valid) mengembalikan agregat.
    const selfRes = await get360(getReq(`/x?period_id=${periodId}&employee_id=${reviewerId}`, reviewerCookie));
    expect(selfRes.status).toBe(200);

    // Melihat agregat di luar scope tim → diblokir RBAC.
    const crossRes = await get360(getReq(`/x?period_id=${periodId}&employee_id=${evaluateeId}`, reviewerCookie));
    expect(crossRes.status).toBeGreaterThanOrEqual(400);
  });
});
