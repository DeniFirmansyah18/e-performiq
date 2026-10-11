import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as listProbation } from '@/app/api/v1/pre-employment/probation/route';
import { PUT as evalProbation } from '@/app/api/v1/pre-employment/probation/[id]/route';

function req(path: string, method: string, body?: unknown, cookie?: string): NextRequest {
  const headers = new Headers();
  if (body) headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
}

const HR_USER = 'e0000000-0000-4000-8000-000000000002';
const PROBATION_EMP = 'b0000000-0000-4000-8000-000000000009'; // Rian Hidayat (PROBATION)

describe('Probation (30-60-90) routes', () => {
  let hrCookie = '';
  let milestoneId = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;

    // Pastikan ada baris onboarding_milestones untuk karyawan probation.
    await client.query(
      `INSERT INTO onboarding_programs (employee_id, position_id, status)
       SELECT $1::uuid, e.position_id, 'IN_PROGRESS' FROM employees e WHERE e.id = $1::uuid
       ON CONFLICT (employee_id) DO NOTHING`,
      [PROBATION_EMP]
    );
    await client.query(
      `INSERT INTO onboarding_milestones (employee_id, probation_passed)
       SELECT $1::uuid, FALSE WHERE NOT EXISTS (SELECT 1 FROM onboarding_milestones WHERE employee_id = $1::uuid)`,
      [PROBATION_EMP]
    );
    const row = await client.query<{ id: string }>(
      `SELECT id FROM onboarding_milestones WHERE employee_id = $1::uuid`, [PROBATION_EMP]);
    milestoneId = row.rows[0].id;
  });

  it('GET daftar probation mengembalikan milestone dengan skor 30-60-90', async () => {
    const res = await listProbation(req('/x', 'GET', undefined, hrCookie));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(Array.isArray(j.data.milestones)).toBe(true);
    expect(j.data.milestones.length).toBeGreaterThan(0);
    const found = j.data.milestones.find((m: any) => m.id === milestoneId);
    expect(found).toBeTruthy();
    expect(found).toHaveProperty('day30Score');
  });

  it('PUT evaluasi probation menyimpan skor & mengangkat karyawan ke PERMANENT', async () => {
    const res = await evalProbation(
      req(`/x/${milestoneId}`, 'PUT', {
        day_30_score: 82,
        day_60_score: 85,
        day_90_score: 88,
        manager_notes: 'Kinerja stabil, direkomendasikan tetap.',
        probation_passed: true,
      }, hrCookie),
      { params: { id: milestoneId } }
    );
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.milestone.probationPassed).toBe(true);

    const client = await getDb();
    const emp = await client.query<{ status: string }>(
      `SELECT status FROM employees WHERE id = $1::uuid`, [PROBATION_EMP]);
    expect(emp.rows[0].status).toBe('PERMANENT');

    const ms = await client.query<{ day_90_score: number; manager_notes: string }>(
      `SELECT day_90_score, manager_notes FROM onboarding_milestones WHERE id = $1::uuid`, [milestoneId]);
    expect(Number(ms.rows[0].day_90_score)).toBe(88);
    expect(ms.rows[0].manager_notes).toContain('stabil');
  });
});
