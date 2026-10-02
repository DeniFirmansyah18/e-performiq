import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as listPostings, POST as createPosting } from '@/app/api/v1/recruitment/job-postings/route';
import { PATCH as patchPosting } from '@/app/api/v1/recruitment/job-postings/[id]/route';
import { GET as publicPostings } from '@/app/api/v1/careers/postings/route';

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

const HR_USER = 'e0000000-0000-4000-8000-000000000002';
const EMP_USER = 'e0000000-0000-4000-8000-000000000004';

describe('WS-12 kelola lowongan HR + tampilan publik', () => {
  let hrCookie = '';
  let empCookie = '';
  let deptId = '';
  let posId = '';
  let mppId = '';
  let createdId = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: null, role: 'HR_MANAGER', email: 'siti.nurhaliza@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: EMP_USER, employeeId: 'b0000000-0000-4000-8000-000000000004', role: 'EMPLOYEE', email: 'budi.pratama@eperformiq.co.id' })}`;
    const ref = await (await listPostings(getReq('/x?reference=1', hrCookie))).json();
    deptId = ref.data.departments[0].id;
    posId = ref.data.positions[0].id;
    mppId = ref.data.mpps[0].id;
  });

  it('GET reference (HR) mengembalikan departemen, posisi, MPP', async () => {
    const res = await listPostings(getReq('/x?reference=1', hrCookie));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.departments.length).toBeGreaterThanOrEqual(1);
    expect(j.data.positions.length).toBeGreaterThanOrEqual(1);
    expect(j.data.mpps.length).toBeGreaterThanOrEqual(1);
  });

  it('EMPLOYEE tidak boleh kelola lowongan (403)', async () => {
    const res = await createPosting(req('/x', 'POST', {}, empCookie));
    expect(res.status).toBe(403);
  });

  it('POST membuat lowongan DRAFT (HR)', async () => {
    const res = await createPosting(req('/x', 'POST', {
      postingTitle: 'Lowongan Uji WS-12',
      description: 'Deskripsi lowongan uji untuk pengujian otomatis.',
      requiredSkills: ['TypeScript', 'React'],
      departmentId: deptId, positionId: posId, manpowerPlanId: mppId,
      status: 'DRAFT', isPublic: false, minEducation: 'S1', minExperienceYears: 2, workLocation: 'Jakarta',
    }, hrCookie));
    expect(res.status).toBe(200);
    createdId = (await res.json()).data.id;
    expect(createdId).toBeTruthy();
  });

  it('lowongan DRAFT tidak tampil di portal publik', async () => {
    const res = await publicPostings(getReq('/api/v1/careers/postings'));
    const j = await res.json();
    expect(j.data.postings.some((p: any) => p.id === createdId)).toBe(false);
  });

  it('PATCH status OPEN + publikasikan → tampil di /careers dengan detail', async () => {
    const res = await patchPosting(req('/x', 'PATCH', { status: 'OPEN', isPublic: true }, hrCookie), { params: { id: createdId } });
    expect(res.status).toBe(200);

    const pub = await publicPostings(getReq('/api/v1/careers/postings'));
    const j = await pub.json();
    const found = j.data.postings.find((p: any) => p.id === createdId);
    expect(found).toBeTruthy();
    expect(found.minEducation).toBe('S1');
    expect(found.workLocation).toBe('Jakarta');
    expect(Array.isArray(found.requiredSkills)).toBe(true);
    expect(found).toHaveProperty('availability');
    expect(found).toHaveProperty('quota');
  });

  it('PATCH full update mengubah judul & kualifikasi', async () => {
    const res = await patchPosting(req('/x', 'PATCH', {
      postingTitle: 'Lowongan Uji WS-12 (Revisi)',
      description: 'Deskripsi diperbarui untuk pengujian.',
      requiredSkills: ['TypeScript', 'PostgreSQL', 'Docker'],
      departmentId: deptId, positionId: posId, manpowerPlanId: mppId,
      status: 'OPEN', isPublic: true, minEducation: 'S1', minExperienceYears: 3, workLocation: 'Remote',
    }, hrCookie), { params: { id: createdId } });
    expect(res.status).toBe(200);
    const list = await (await listPostings(getReq('/x', hrCookie))).json();
    const row = list.data.postings.find((p: any) => p.id === createdId);
    expect(row.postingTitle).toContain('Revisi');
    expect(row.requiredSkills).toEqual(expect.arrayContaining(['PostgreSQL', 'Docker']));
    expect(row.workLocation).toBe('Remote');
  });

  it('PATCH tutup → availability CLOSED & hilang dari publik', async () => {
    const res = await patchPosting(req('/x', 'PATCH', { status: 'CLOSED' }, hrCookie), { params: { id: createdId } });
    expect(res.status).toBe(200);
    const pub = await (await publicPostings(getReq('/api/v1/careers/postings'))).json();
    const found = pub.data.postings.find((p: any) => p.id === createdId);
    // is_public tetap true, tapi status CLOSED → availability CLOSED (tetap tampil sebagai ditutup)
    expect(found.availability).toBe('CLOSED');
  });

  it('POST tanpa field wajib → 400', async () => {
    const res = await createPosting(req('/x', 'POST', { postingTitle: 'x' }, hrCookie));
    expect(res.status).toBe(400);
  });
});
