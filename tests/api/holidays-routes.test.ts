import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getHolidays, POST as postHoliday } from '@/app/api/v1/hr/holidays/route';
import { DELETE as deleteHoliday } from '@/app/api/v1/hr/holidays/[date]/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000001';

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

describe('kalender hari libur', () => {
  let hrCookie = '';
  let empCookie = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: 'e0000000-0000-4000-8000-000000000004', employeeId: 'b0000000-0000-4000-8000-000000000004', role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
  });

  it('karyawan tidak boleh menulis kalender libur', async () => {
    const res = await postHoliday(jsonReq('/api/v1/hr/holidays', 'POST', {
      holidayDate: '2030-08-17', name: 'Hari Kemerdekaan',
    }, empCookie));
    expect(res.status).toBe(403);
  });

  it('HR menambah hari libur', async () => {
    const res = await postHoliday(jsonReq('/api/v1/hr/holidays', 'POST', {
      holidayDate: '2030-08-17', name: 'Hari Kemerdekaan',
    }, hrCookie));
    expect(res.status).toBe(200);
    expect((await res.json()).data.holidayDate).toBe('2030-08-17');
  });

  it('menambah tanggal yang sama memperbarui nama (idempoten)', async () => {
    const res = await postHoliday(jsonReq('/api/v1/hr/holidays', 'POST', {
      holidayDate: '2030-08-17', name: 'HUT Kemerdekaan RI',
    }, hrCookie));
    expect(res.status).toBe(200);
    expect((await res.json()).data.name).toBe('HUT Kemerdekaan RI');
  });

  it('daftar libur memuat entri', async () => {
    const res = await getHolidays(getReq('/api/v1/hr/holidays?year=2030', hrCookie));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items.some((h: any) => h.holidayDate === '2030-08-17')).toBe(true);
  });

  it('HR menghapus hari libur', async () => {
    const res = await deleteHoliday(delReq('/api/v1/hr/holidays/2030-08-17', hrCookie), { params: { date: '2030-08-17' } } as any);
    expect(res.status).toBe(200);

    const list = await getHolidays(getReq('/api/v1/hr/holidays?year=2030', hrCookie));
    expect((await list.json()).data.items.some((h: any) => h.holidayDate === '2030-08-17')).toBe(false);
  });
});
