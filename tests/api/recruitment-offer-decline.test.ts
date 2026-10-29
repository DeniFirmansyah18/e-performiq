import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { PATCH as patchStatus } from '@/app/api/v1/recruitment/candidates/[id]/status/route';

/**
 * Validasi kontrak route status lamaran.
 *
 * Test ini sengaja memakai id yang tidak ada sehingga tidak mengubah data:
 * yang diuji adalah LOLOS/TIDAKNYA validasi enum, bukan efek sampingnya.
 * Perilaku penyimpanan diuji di tests/integration/recruitmentOfferFlow.test.ts.
 */

const HR_USER = 'e0000000-0000-4000-8000-000000000002';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

async function hrCookie(): Promise<string> {
  const token = await signSession({
    userId: HR_USER,
    employeeId: null,
    role: 'HR_MANAGER',
    email: 'siti.nurhaliza@eperformiq.co.id',
  });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function req(body: unknown, cookie: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/v1/recruitment/candidates/x/status', {
    method: 'PATCH',
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });
}

describe('PATCH status lamaran — kontrak status', () => {
  it('menerima OFFER_DECLINED (lolos validasi, berlanjut ke pencarian data)', async () => {
    const res = await patchStatus(req({ status: 'OFFER_DECLINED' }, await hrCookie()), {
      params: { id: MISSING_ID },
    });
    // 404 membuktikan validasi lolos; 400 berarti enum belum menampung nilainya.
    expect(res.status).toBe(404);
  });

  it('menerima HIRED dan OFFERED seperti sebelumnya', async () => {
    const cookie = await hrCookie();
    for (const status of ['OFFERED', 'HIRED']) {
      const res = await patchStatus(req({ status }, cookie), { params: { id: MISSING_ID } });
      expect(res.status).toBe(404);
    }
  });

  it('menolak status di luar enum (400)', async () => {
    const res = await patchStatus(req({ status: 'MENOLAK' }, await hrCookie()), {
      params: { id: MISSING_ID },
    });
    expect(res.status).toBe(400);
  });
});