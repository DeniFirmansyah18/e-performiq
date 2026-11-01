import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getRetirement, POST as postRetirement } from '@/app/api/v1/post-employment/retirement/route';
import { GET as getClearance, POST as postClearance } from '@/app/api/v1/post-employment/clearance/route';
import {
  PATCH as patchAsset,
  DELETE as deleteAsset,
} from '@/app/api/v1/post-employment/clearance/asset/[id]/route';
import { POST as postSignoff } from '@/app/api/v1/post-employment/clearance/signoff/route';
import { GET as getLetters, POST as postLetter } from '@/app/api/v1/post-employment/service-letters/route';
import { GET as verifyLetter } from '@/app/api/v1/post-employment/service-letters/verify/[code]/route';
import {
  GET as getObligations,
  POST as postObligation,
} from '@/app/api/v1/post-employment/obligations/route';
import { PATCH as patchObligation } from '@/app/api/v1/post-employment/obligations/[id]/route';
import { GET as getAlumni, POST as postAlumni } from '@/app/api/v1/post-employment/alumni/route';
import { PATCH as patchAlumni } from '@/app/api/v1/post-employment/alumni/[id]/route';
import { GET as getExitAnalytics } from '@/app/api/v1/post-employment/exit-analytics/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000002';
const HR_EMPLOYEE = 'b0000000-0000-4000-8000-000000000002';

const getReq = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'GET',
    headers: new Headers(cookie ? { cookie } : {}),
  });

const send = (method: string, body: unknown, cookie?: string) =>
  new NextRequest('http://localhost:3000/api/v1/post-employment/_test', {
    method,
    headers: new Headers({
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    }),
    body: JSON.stringify(body),
  });

const params = <T extends Record<string, string>>(p: T) => ({ params: p }) as any;

describe('rute pasca-kerja', () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let hrCookie = '';
  let empCookie = '';
  let employeeId = '';
  let assetId = '';
  let empUserId = '';

  beforeAll(async () => {
    db = await getDb();
    await runSeed(db);

    // Fixture unik: tes route memakai .pglite dev yang bertahan antar-run.
    const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    const ins = await db.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'Pasca Uji', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 9000000, CURRENT_DATE - INTERVAL '6 years')
       RETURNING id`,
      [`POST-${stamp}`, `pasca.${stamp}@hrcc.local`],
    );
    employeeId = ins.rows[0].id;

    // Tanggal lahir diisi terpisah supaya proyeksi pensiun ikut teruji.
    await db.query(`UPDATE employees SET birth_date = DATE '1975-04-12' WHERE id = $1::uuid`, [employeeId]);

    // Kolom pelaku (issued_by dll.) ber-FK ke users(id), jadi akun uji harus nyata.
    const usr = await db.query<{ id: string }>(
      `INSERT INTO users (id, email, password_hash, role, employee_id, is_active)
       VALUES (gen_random_uuid(), $1, 'x', 'EMPLOYEE', $2::uuid, true)
       RETURNING id`,
      [`pasca.${stamp}@hrcc.local`, employeeId],
    );
    empUserId = usr.rows[0].id;

    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({
      userId: HR_USER,
      employeeId: HR_EMPLOYEE,
      role: 'HR_MANAGER',
      email: 'hr@hrcc.local',
    })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({
      userId: empUserId,
      employeeId,
      role: 'EMPLOYEE',
      email: `pasca.${stamp}@hrcc.local`,
    })}`;
  }, 240_000);

  describe('pensiun & kaderisasi', () => {
    it('menolak permintaan tanpa sesi', async () => {
      const res = await getRetirement(getReq('/api/v1/post-employment/retirement'));
      expect(res.status).toBe(401);
    });

    it('HR membaca proyeksi pensiun seluruh karyawan', async () => {
      const res = await getRetirement(getReq('/api/v1/post-employment/retirement', hrCookie));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data.candidates)).toBe(true);
      expect(json.data.summary).toHaveProperty('coveredPercentage');
      const mine = json.data.candidates.find((c: any) => c.employeeId === employeeId);
      expect(mine).toBeTruthy();
      expect(mine.birthDate).toBe('1975-04-12');
      expect(mine.plannedRetirementDate).toBe('2033-04-12');
    });

    it('HR menyimpan rencana pensiun karyawan', async () => {
      const res = await postRetirement(
        send('POST', {
          employee_id: employeeId,
          planned_retirement_date: '2040-04-12',
          knowledge_transfer_status: 'IN_PROGRESS',
          notes: 'Kaderisasi disiapkan',
        }, hrCookie),
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.data.plannedRetirementDate).toBe('2040-04-12');
      expect(json.data.data.knowledgeTransferLabel).toBeTruthy();

      const one = await getRetirement(
        getReq(`/api/v1/post-employment/retirement?employeeId=${employeeId}`, hrCookie),
      );
      expect(one.status).toBe(200);
      const detail = await one.json();
      expect(detail.data.plannedRetirementDate).toBe('2040-04-12');
    });

    it('menolak tanggal yang tidak valid', async () => {
      const res = await postRetirement(
        send('POST', { employee_id: employeeId, planned_retirement_date: 'bukan-tanggal' }, hrCookie),
      );
      expect(res.status).toBe(422);
    });

    it('menolak karyawan yang tidak ada', async () => {
      const res = await postRetirement(
        send('POST', {
          employee_id: '11111111-1111-4111-8111-111111111111',
          planned_retirement_date: '2040-04-12',
        }, hrCookie),
      );
      expect(res.status).toBe(404);
    });
  });

  describe('serah terima aset & clearance', () => {
    it('karyawan tidak boleh menambah aset', async () => {
      const res = await postClearance(
        send('POST', { employee_id: employeeId, asset_name: 'Laptop' }, empCookie),
      );
      expect(res.status).toBe(403);
    });

    it('HR menambah aset dan ringkasan terbarui', async () => {
      const res = await postClearance(
        send('POST', {
          employee_id: employeeId,
          asset_name: 'Laptop Lenovo',
          asset_code: 'INV-001',
          asset_category: 'LAPTOP',
        }, hrCookie),
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      assetId = json.data.data.id;

      const overview = await getClearance(
        getReq(`/api/v1/post-employment/clearance?employeeId=${employeeId}`, hrCookie),
      );
      expect(overview.status).toBe(200);
      const data = await overview.json();
      expect(data.data.assets.some((a: any) => a.id === assetId && a.assetName === 'Laptop Lenovo')).toBe(true);
      expect(data.data.summary.assetsTotal).toBeGreaterThanOrEqual(1);
    });

    it('HR menandai aset kembali lalu menghapusnya', async () => {
      const patch = await patchAsset(
        send('PATCH', { is_returned: true }, hrCookie),
        params({ id: assetId }),
      );
      expect(patch.status).toBe(200);
      const patched = await patch.json();
      expect(patched.data.data.isReturned).toBe(true);

      const del = await deleteAsset(send('DELETE', {}, hrCookie), params({ id: assetId }));
      expect(del.status).toBe(200);

      const overview = await getClearance(
        getReq(`/api/v1/post-employment/clearance?employeeId=${employeeId}`, hrCookie),
      );
      const data = await overview.json();
      expect(data.data.assets.some((a: any) => a.id === assetId)).toBe(false);
    });

    it('menolak unit kerja yang tidak dikenal', async () => {
      const res = await postSignoff(
        send('POST', {
          employee_id: employeeId,
          department: 'MARKETING',
          is_cleared: true,
        }, hrCookie),
      );
      expect(res.status).toBe(422);
    });

    it('HR mencatat persetujuan bebas tanggungan', async () => {
      const res = await postSignoff(
        send('POST', {
          employee_id: employeeId,
          department: 'IT',
          is_cleared: true,
          notes: 'Akses sistem sudah dicabut',
        }, hrCookie),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.data.department).toBe('IT');
      expect(json.data.data.isCleared).toBe(true);

      const after = await getClearance(
        getReq(`/api/v1/post-employment/clearance?employeeId=${employeeId}`, hrCookie),
      );
      const detail = await after.json();
      const it = detail.data.signoffs.find((s: any) => s.department === 'IT');
      expect(it.isCleared).toBe(true);
    });

    it('karyawan asing ditolak dengan 404', async () => {
      const res = await getClearance(
        getReq('/api/v1/post-employment/clearance?employeeId=11111111-1111-4111-8111-111111111111', hrCookie),
      );
      expect(res.status).toBe(404);
    });
  });

  describe('surat keterangan kerja', () => {
    let code = '';

    it('HR menerbitkan paklaring', async () => {
      const res = await postLetter(
        send('POST', {
          employee_id: employeeId,
          letter_type: 'EXPERIENCE',
          purpose: 'Persyaratan bank',
        }, hrCookie),
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      const letter = json.data.data;
      expect(letter.letterTypeLabel).toBe('Surat Pengalaman Kerja');
      expect(letter.letterNumber).toBeTruthy();
      code = letter.verificationCode;
      expect(code).toBeTruthy();
    });

    it('daftar surat memuat surat yang baru terbit', async () => {
      const res = await getLetters(getReq('/api/v1/post-employment/service-letters', hrCookie));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.some((r: any) => r.verificationCode === code)).toBe(true);
    });

    it('verifikasi publik berjalan tanpa sesi', async () => {
      const res = await verifyLetter(
        getReq(`/api/v1/post-employment/service-letters/verify/${code}`),
        params({ code }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.isValid).toBe(true);
      expect(json.data.employeeName).toBe('Pasca Uji');
    });

    it('kode verifikasi palsu mengembalikan data kosong', async () => {
      const res = await verifyLetter(
        getReq('/api/v1/post-employment/service-letters/verify/TIDAK-ADA'),
        params({ code: 'TIDAK-ADA' }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeNull();
    });

    it('menolak jenis surat yang tidak dikenal', async () => {
      const res = await postLetter(
        send('POST', {
          employee_id: employeeId,
          letter_type: 'SURAT_SAKTI',
        }, hrCookie),
      );
      expect(res.status).toBe(422);
    });
  });

  describe('kepatuhan pasca-kerja', () => {
    let obligationId = '';

    it('HR membuat paket kewajiban dari templat', async () => {
      const res = await postObligation(send('POST', { employee_id: employeeId }, hrCookie));
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.data.created).toBe(6);
    });

    it('daftar kewajiban memuat butir baru', async () => {
      const res = await getObligations(getReq('/api/v1/post-employment/obligations', hrCookie));
      expect(res.status).toBe(200);
      const json = await res.json();
      const mine = json.data.obligations.filter((o: any) => o.employeeId === employeeId);
      expect(mine.length).toBe(6);
      obligationId = mine[0].id;
      expect(['DONE', 'OPEN', 'OVERDUE', 'DUE_SOON']).toContain(mine[0].status);
    });

    it('membuat ulang tidak menduplikasi kewajiban', async () => {
      const res = await postObligation(send('POST', { employee_id: employeeId }, hrCookie));
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.data.created).toBe(0);
    });

    it('HR menandai kewajiban selesai', async () => {
      const res = await patchObligation(
        send('PATCH', { is_completed: true, reference_no: 'BPJS/2026/001' }, hrCookie),
        params({ id: obligationId }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.data.isCompleted).toBe(true);

      const list = await getObligations(getReq('/api/v1/post-employment/obligations', hrCookie));
      const data = await list.json();
      const row = data.data.obligations.find((o: any) => o.id === obligationId);
      expect(row.status).toBe('DONE');
      expect(row.statusLabel).toBe('Selesai');
    });

    it('karyawan tidak boleh mengubah kewajiban', async () => {
      const res = await patchObligation(
        send('PATCH', { is_completed: false }, empCookie),
        params({ id: obligationId }),
      );
      expect(res.status).toBe(403);
    });

    it('kewajiban yang tidak ada menghasilkan 404', async () => {
      const res = await patchObligation(
        send('PATCH', { is_completed: true }, hrCookie),
        params({ id: '11111111-1111-4111-8111-111111111111' }),
      );
      expect(res.status).toBe(404);
    });
  });

  describe('direktori alumni', () => {
    let alumniId = '';

    it('HR mendaftarkan karyawan keluar sebagai alumni', async () => {
      await db.query(
        `UPDATE employees SET status = 'RESIGNED', last_working_day = DATE '2026-04-30' WHERE id = $1::uuid`,
        [employeeId],
      );

      const res = await postAlumni(send('POST', { employee_id: employeeId }, hrCookie));
      expect(res.status).toBe(201);
      const json = await res.json();
      alumniId = json.data.data.id;
      expect(json.data.data.employeeName).toBe('Pasca Uji');
    });

    it('daftar alumni memuat data baru', async () => {
      const res = await getAlumni(getReq('/api/v1/post-employment/alumni', hrCookie));
      expect(res.status).toBe(200);
      const json = await res.json();
      const row = json.data.alumni.find((a: any) => a.id === alumniId);
      expect(row).toBeTruthy();
      expect(row.exitDate).toBe('2026-04-30');
      expect(json.data.summary.total).toBeGreaterThan(0);
    });

    it('HR mengubah status layak kembali', async () => {
      const res = await patchAlumni(
        send('PATCH', { rehire_eligible: true, rehire_reason: 'Kinerja konsisten' }, hrCookie),
        params({ id: alumniId }),
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.data.rehireEligible).toBe(true);
    });

    it('mendaftarkan ulang tidak membuat baris ganda', async () => {
      const res = await postAlumni(send('POST', { employee_id: employeeId }, hrCookie));
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.data.id).toBe(alumniId);
    });
  });

  describe('analitik keluar & biaya', () => {
    it('HR membaca analitik keluar', async () => {
      const res = await getExitAnalytics(getReq('/api/v1/post-employment/exit-analytics', hrCookie));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveProperty('totalExits');
      expect(Array.isArray(json.data.exitReasons)).toBe(true);
      expect(Array.isArray(json.data.byDepartment)).toBe(true);
      expect(json.data.totalExits).toBeGreaterThan(0);
    });

    it('karyawan tidak boleh membaca analitik keluar', async () => {
      const res = await getExitAnalytics(getReq('/api/v1/post-employment/exit-analytics', empCookie));
      expect(res.status).toBe(403);
    });

    it('tanpa sesi ditolak', async () => {
      const res = await getExitAnalytics(getReq('/api/v1/post-employment/exit-analytics'));
      expect(res.status).toBe(401);
    });
  });
});
