import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb, db as appDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getHrLetters } from '@/app/api/v1/hr/letters/route';
import { POST as postPublish } from '@/app/api/v1/policies/route';
import { GET as getHrPolicies } from '@/app/api/v1/hr/policies/route';
import { GET as getUsers } from '@/app/api/v1/hr/users/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000001';
const EMP_USER = 'e0000000-0000-4000-8000-000000000004';
const MGR_USER = 'e0000000-0000-4000-8000-000000000002';

const jsonReq = (path: string, method: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });
const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });

describe('panel HR: e-Surat & SOP', () => {
  let hrCookie = '';
  let empCookie = '';
  const stamp = Date.now();

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);

    // Surat TERBATAS: hanya HR yang boleh melihat di register.
    await client.query(
      `INSERT INTO letters (agenda_number, direction, classification, subject, letter_date, status, created_by)
       VALUES ($1, 'INCOMING', 'TERBATAS', 'Surat terbatas direksi', '2026-10-20', 'OPEN', $2::uuid)`,
      [`HR-AGT-${stamp}`, HR_USER],
    );
    await client.query(
      `INSERT INTO letters (agenda_number, direction, classification, subject, letter_date, status, created_by)
       VALUES ($1, 'INCOMING', 'BIASA', 'Undangan umum', '2026-10-21', 'OPEN', $2::uuid)`,
      [`HR-AGB-${stamp}`, HR_USER],
    );

    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: EMP_USER, employeeId: 'b0000000-0000-4000-8000-000000000004', role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
  });

  describe('GET /api/v1/hr/letters', () => {
    it('HR melihat seluruh surat termasuk TERBATAS', async () => {
      const res = await getHrLetters(getReq('/api/v1/hr/letters', hrCookie));
      expect(res.status).toBe(200);
      const items = (await res.json()).data.items as any[];
      const terbatas = items.find((l) => l.agendaNumber === `HR-AGT-${stamp}`);
      expect(terbatas).toBeTruthy();
      expect(terbatas.classification).toBe('TERBATAS');
    });

    it('karyawan ditolak', async () => {
      const res = await getHrLetters(getReq('/api/v1/hr/letters', empCookie));
      expect(res.status).toBe(403);
    });

    it('filter status bekerja', async () => {
      const res = await getHrLetters(getReq('/api/v1/hr/letters?status=OPEN', hrCookie));
      const items = (await res.json()).data.items as any[];
      expect(items.every((l) => l.status === 'OPEN')).toBe(true);
    });

    it('filter status tak dikenal → 400', async () => {
      const res = await getHrLetters(getReq('/api/v1/hr/letters?status=NGAWUR', hrCookie));
      expect(res.status).toBe(400);
    });

    it('mengembalikan jumlah disposisi terbuka per surat', async () => {
      const client = await getDb();
      const letter = await client.query<{ id: string }>(
        `SELECT id FROM letters WHERE agenda_number = $1`, [`HR-AGB-${stamp}`],
      );
      await client.query(
        `INSERT INTO letter_dispositions (letter_id, from_user_id, to_user_id, instruction)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'Siapkan bahan')`,
        [letter.rows[0].id, HR_USER, MGR_USER],
      );

      const res = await getHrLetters(getReq('/api/v1/hr/letters', hrCookie));
      const items = (await res.json()).data.items as any[];
      const row = items.find((l) => l.agendaNumber === `HR-AGB-${stamp}`);
      expect(row.openDispositions).toBe(1);
    });
  });

  describe('POST /api/v1/policies (publikasi versi)', () => {
    it('karyawan tidak boleh menerbitkan', async () => {
      const res = await postPublish(jsonReq('/api/v1/policies', 'POST', {
        documentCode: `SOP-X-${stamp}`, title: 'SOP Uji', policyType: 'SOP',
        version: '1.0', effectiveDate: '2026-10-01', fileUrl: 'https://files.example.com/x.pdf',
      }, empCookie));
      expect(res.status).toBe(403);
    });

    it('menolak berkas non-PDF', async () => {
      const res = await postPublish(jsonReq('/api/v1/policies', 'POST', {
        documentCode: `SOP-X-${stamp}`, title: 'SOP Uji', policyType: 'SOP',
        version: '1.0', effectiveDate: '2026-10-01', fileUrl: 'https://files.example.com/x.exe',
      }, hrCookie));
      expect(res.status).toBe(400);
    });

    it('HR menerbitkan versi 1.0', async () => {
      const res = await postPublish(jsonReq('/api/v1/policies', 'POST', {
        documentCode: `SOP-X-${stamp}`, title: 'SOP Uji', policyType: 'SOP',
        version: '1.0', effectiveDate: '2026-10-01', fileUrl: 'https://files.example.com/x.pdf',
      }, hrCookie));
      expect(res.status).toBe(200);
      expect((await res.json()).data.status).toBe('AKTIF');
    });

    it('versi ganda untuk kode+versi sama ditolak', async () => {
      const res = await postPublish(jsonReq('/api/v1/policies', 'POST', {
        documentCode: `SOP-X-${stamp}`, title: 'SOP Uji', policyType: 'SOP',
        version: '1.0', effectiveDate: '2026-10-01', fileUrl: 'https://files.example.com/x.pdf',
      }, hrCookie));
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('menerbitkan versi 2.0 men-Obsolete-kan versi 1.0', async () => {
      const res = await postPublish(jsonReq('/api/v1/policies', 'POST', {
        documentCode: `SOP-X-${stamp}`, title: 'SOP Uji', policyType: 'SOP',
        version: '2.0', effectiveDate: '2026-11-01', fileUrl: 'https://files.example.com/x2.pdf',
        supersedesVersion: '1.0',
      }, hrCookie));
      expect(res.status).toBe(200);

      const list = await getHrPolicies(getReq('/api/v1/hr/policies', hrCookie));
      const rows = (await list.json()).data.items as any[];
      const v1 = rows.find((p) => p.documentCode === `SOP-X-${stamp}` && p.version === '1.0');
      const v2 = rows.find((p) => p.documentCode === `SOP-X-${stamp}` && p.version === '2.0');
      expect(v1.status).toBe('OBSOLETE');
      expect(v2.status).toBe('AKTIF');
    });

    it('supersedesVersion yang tidak ada → 422 (BusinessRuleError, konsisten dengan codebase)', async () => {
      const res = await postPublish(jsonReq('/api/v1/policies', 'POST', {
        documentCode: `SOP-X-${stamp}`, title: 'SOP Uji', policyType: 'SOP',
        version: '3.0', effectiveDate: '2026-12-01', fileUrl: 'https://files.example.com/x3.pdf',
        supersedesVersion: '9.9',
      }, hrCookie));
      expect(res.status).toBe(422);
      expect(String((await res.json()).detail ?? '')).toMatch(/tidak ditemukan/i);
    });
  });

  describe('GET /api/v1/hr/policies', () => {
    it('HR melihat semua status beserta jumlah acknowledgment', async () => {
      const res = await getHrPolicies(getReq('/api/v1/hr/policies', hrCookie));
      expect(res.status).toBe(200);
      const items = (await res.json()).data.items as any[];
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items.every((p) => typeof p.acknowledgedCount === 'number')).toBe(true);
      expect(items.some((p) => p.status === 'OBSOLETE')).toBe(true);
    });

    it('karyawan ditolak', async () => {
      const res = await getHrPolicies(getReq('/api/v1/hr/policies', empCookie));
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/hr/users', () => {
    it('HR mendapat daftar pengguna untuk picker disposisi', async () => {
      const res = await getUsers(getReq('/api/v1/hr/users', hrCookie));
      expect(res.status).toBe(200);
      const items = (await res.json()).data.items as any[];
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items[0]).toHaveProperty('id');
      expect(items[0]).toHaveProperty('role');
      // Tidak boleh membocorkan hash kata sandi.
      expect(JSON.stringify(items)).not.toMatch(/password|hash/i);
    });

    it('karyawan ditolak', async () => {
      const res = await getUsers(getReq('/api/v1/hr/users', empCookie));
      expect(res.status).toBe(403);
    });
  });
});
