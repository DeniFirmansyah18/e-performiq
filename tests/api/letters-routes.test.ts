import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { POST as postLetter, GET as getLetters } from '@/app/api/v1/letters/route';
import { POST as postDisposition } from '@/app/api/v1/letters/[id]/dispositions/route';
import { PUT as putDisposition } from '@/app/api/v1/letters/dispositions/[id]/route';
import { POST as postClose } from '@/app/api/v1/letters/[id]/close/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000001';
const MGR_USER = 'e0000000-0000-4000-8000-000000000002';
const EMP_USER = 'e0000000-0000-4000-8000-000000000004';

const jsonReq = (path: string, method: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });
const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });

describe('e-Surat & disposisi', () => {
  let hrCookie = '';
  let mgrCookie = '';
  let empCookie = '';
  let letterId = '';
  let dispositionId = '';
  const stamp = Date.now();

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
    mgrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: MGR_USER, employeeId: 'b0000000-0000-4000-8000-000000000002', role: 'PEOPLE_MANAGER', email: 'mgr@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: EMP_USER, employeeId: 'b0000000-0000-4000-8000-000000000004', role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
  });

  it('HR mendaftarkan surat masuk', async () => {
    const res = await postLetter(jsonReq('/api/v1/letters', 'POST', {
      agendaNumber: `AG-${stamp}-0001`, direction: 'INCOMING', classification: 'BIASA',
      subject: 'Undangan rapat koordinasi', sender: 'Kementerian BUMN',
      letterDate: '2026-10-20', fileUrl: 'https://files.example.com/surat.pdf',
    }, hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('OPEN');
    letterId = json.data.id;
  });

  it('nomor agenda ganda ditolak', async () => {
    const res = await postLetter(jsonReq('/api/v1/letters', 'POST', {
      agendaNumber: `AG-${stamp}-0001`, direction: 'INCOMING', classification: 'BIASA',
      subject: 'Duplikat', letterDate: '2026-10-20',
    }, hrCookie));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('karyawan tidak boleh mendaftarkan surat', async () => {
    const res = await postLetter(jsonReq('/api/v1/letters', 'POST', {
      agendaNumber: `AG-${stamp}-0002`, direction: 'INCOMING', classification: 'BIASA',
      subject: 'Tes', letterDate: '2026-10-20',
    }, empCookie));
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('manajer meneruskan disposisi → BELUM_DIBACA dan surat IN_PROGRESS', async () => {
    const res = await postDisposition(
      jsonReq(`/api/v1/letters/${letterId}/dispositions`, 'POST', {
        toUserId: EMP_USER,
        instruction: 'Siapkan bahan paparan', priority: 'HIGH', dueDate: '2026-10-25',
      }, mgrCookie),
      { params: { id: letterId } } as any,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('BELUM_DIBACA');
    dispositionId = json.data.id;

    const list = await getLetters(getReq('/api/v1/letters', hrCookie));
    expect((await list.json()).data.items.find((l: any) => l.id === letterId)?.status).toBe('IN_PROGRESS');
  });

  it('disposisi ke diri sendiri ditolak', async () => {
    const res = await postDisposition(
      jsonReq(`/api/v1/letters/${letterId}/dispositions`, 'POST', {
        toUserId: MGR_USER, instruction: 'Untuk saya sendiri',
      }, mgrCookie),
      { params: { id: letterId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('surat tidak boleh ditutup selama disposisi belum selesai', async () => {
    const res = await postClose(
      jsonReq(`/api/v1/letters/${letterId}/close`, 'POST', {}, hrCookie),
      { params: { id: letterId } } as any,
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(String(json.detail ?? '')).toMatch(/belum selesai/i);
  });

  it('bukan penerima tidak boleh mengubah status disposisi', async () => {
    const res = await putDisposition(
      jsonReq(`/api/v1/letters/dispositions/${dispositionId}`, 'PUT', { status: 'SELESAI' }, mgrCookie),
      { params: { id: dispositionId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('penerima memperbarui status disposisi sampai SELESAI dan waktu baca tercatat', async () => {
    for (const status of ['DIBACA', 'DIKERJAKAN', 'SELESAI']) {
      const res = await putDisposition(
        jsonReq(`/api/v1/letters/dispositions/${dispositionId}`, 'PUT', { status, note: 'dikerjakan' }, empCookie),
        { params: { id: dispositionId } } as any,
      );
      expect(res.status).toBe(200);
    }

    const list = await getLetters(getReq('/api/v1/letters', empCookie));
    const row = (await list.json()).data.items.find((l: any) => l.id === letterId);
    expect(row.dispositions[0].status).toBe('SELESAI');
    expect(row.dispositions[0].readAt).toBeTruthy();
  });

  it('surat bisa ditutup setelah semua disposisi selesai', async () => {
    const res = await postClose(
      jsonReq(`/api/v1/letters/${letterId}/close`, 'POST', {}, hrCookie),
      { params: { id: letterId } } as any,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('CLOSED');
  });

  it('surat yang sudah ditutup tidak bisa diberi disposisi baru', async () => {
    const res = await postDisposition(
      jsonReq(`/api/v1/letters/${letterId}/dispositions`, 'POST', {
        toUserId: EMP_USER, instruction: 'Tindak lanjut baru',
      }, mgrCookie),
      { params: { id: letterId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('karyawan melihat surat yang terlihat olehnya', async () => {
    const res = await getLetters(getReq('/api/v1/letters', empCookie));
    expect(res.status).toBe(200);
    expect((await res.json()).data.items.some((l: any) => l.id === letterId)).toBe(true);
  });
});
