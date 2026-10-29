import { describe, it, expect } from 'vitest';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { hashPassword } from '@/lib/auth/password';
import { listPublicPostings, updateApplicationStatus } from '@/lib/services/candidateService';
import {
  approveApplication,
  declineInternalOffer,
} from '@/lib/services/talentAcquisitionService';

/**
 * Alur setelah status lamaran menjadi OFFERED.
 *
 * Fokus: integritas data saat kandidat menerima atau MENOLAK penawaran.
 * Setiap test memakai DB sendiri agar tidak saling memengaruhi.
 */

const PUBLIC_POSTING = '87000000-0000-4000-8000-000000000001';
const SEED_INTERNAL_APP = '88000000-0000-4000-8000-000000000001';
const SEED_MPP = '50000000-0000-4000-8000-000000000001';

interface Harness {
  client: Awaited<ReturnType<typeof createTestDb>>['client'];
  db: any;
  close: () => Promise<void>;
}

async function newHarness(): Promise<Harness> {
  const { client, db } = await createTestDb();
  await runSeed(client);
  return { client, db, close: () => client.close() };
}

/** Kandidat publik + lamaran berstatus tertentu pada lowongan publik seed. */
async function makeApplication(
  h: Harness,
  email: string,
  status: string
): Promise<string> {
  const hash = await hashPassword('rahasia123');
  const acc = await h.client.query<{ id: string }>(
    `INSERT INTO candidate_accounts (email, password_hash, full_name, is_verified)
     VALUES ($1, $2, 'Kandidat Penawaran', TRUE) RETURNING id`,
    [email, hash]
  );
  const cand = await h.client.query<{ id: string }>(
    `INSERT INTO candidates (full_name, email, account_id)
     VALUES ('Kandidat Penawaran', $1, $2) RETURNING id`,
    [email, acc.rows[0].id]
  );
  const app = await h.client.query<{ id: string }>(
    `INSERT INTO job_applications (application_no, candidate_id, job_posting_id, status)
     VALUES ($1, $2, $3::uuid, $4::application_status_enum) RETURNING id`,
    [`APP-OFR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, cand.rows[0].id, PUBLIC_POSTING, status]
  );
  return app.rows[0].id;
}

const statusOf = async (h: Harness, applicationId: string): Promise<string> => {
  const res = await h.client.query<{ status: string }>(
    `SELECT status::text AS status FROM job_applications WHERE id = $1::uuid`,
    [applicationId]
  );
  return res.rows[0].status;
};

describe('Alur OFFERED — integritas data', () => {
  it('tidak menandai HIRED bila konversi karyawan gagal (atomik, status utuh)', async () => {
    const h = await newHarness();
    try {
      const email = `bentrok.${Date.now()}@example.com`;
      const dept = await h.client.query<{ id: string }>(`SELECT id FROM departments LIMIT 1`);
      const pos = await h.client.query<{ id: string }>(`SELECT id FROM job_positions LIMIT 1`);

      // Karyawan lama memakai email tersebut TANPA akun `users`, sehingga INSERT
      // employees saat konversi melanggar UNIQUE(email) dan konversi gagal.
      await h.client.query(
        `INSERT INTO employees (employee_code, full_name, email, department_id, position_id,
                                status, base_salary, join_date)
         VALUES ($1, 'Karyawan Lama', $2, $3::uuid, $4::uuid, 'PERMANENT', 0, CURRENT_DATE)`,
        [`EMP-DUP-${Date.now()}`, email, dept.rows[0].id, pos.rows[0].id]
      );

      const applicationId = await makeApplication(h, email, 'OFFERED');

      await expect(
        updateApplicationStatus(h.db, applicationId, 'HIRED')
      ).rejects.toThrow();

      // Status TIDAK boleh tertinggal di HIRED: kandidat tidak akan punya akun.
      expect(await statusOf(h, applicationId)).toBe('OFFERED');

      // Tidak ada karyawan kedua yang terbentuk dari lamaran ini.
      const emps = await h.client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM employees WHERE lower(email) = $1`,
        [email]
      );
      expect(emps.rows[0].n).toBe(1);

      // Akun kandidat tetap aktif karena konversi tidak selesai.
      const acc = await h.client.query<{ is_active: boolean }>(
        `SELECT is_active FROM candidate_accounts WHERE lower(email) = $1`,
        [email]
      );
      expect(acc.rows[0].is_active).toBe(true);
    } finally {
      await h.close();
    }
  }, 60000);

  it('status OFFER_DECLINED melepas kuota lowongan publik', async () => {
    const h = await newHarness();
    try {
      const applicationId = await makeApplication(
        h,
        `menolak.${Date.now()}@example.com`,
        'OFFERED'
      );

      const before = (await listPublicPostings(h.db)).find((p) => p.id === PUBLIC_POSTING);
      expect(before).toBeTruthy();

      await updateApplicationStatus(h.db, applicationId, 'OFFER_DECLINED');

      expect(await statusOf(h, applicationId)).toBe('OFFER_DECLINED');
      const after = (await listPublicPostings(h.db)).find((p) => p.id === PUBLIC_POSTING);
      // Kuota publik dihitung dari status HIRED/OFFERED; menolak harus mengembalikannya.
      expect(after!.hired).toBe(before!.hired - 1);
      expect(after!.remaining).toBe(before!.remaining + 1);
    } finally {
      await h.close();
    }
  }, 60000);

  it('menolak tawaran internal mengembalikan kuota MPP', async () => {
    const h = await newHarness();
    try {
      const quota = async (): Promise<number> => {
        const res = await h.client.query<{ hired_count: number }>(
          `SELECT hired_count FROM manpower_plans WHERE id = $1::uuid`,
          [SEED_MPP]
        );
        return res.rows[0].hired_count;
      };
      const initial = await quota();

      // Menyetujui lamaran internal memakai satu kuota (status OFFERED).
      await approveApplication(h.db, SEED_INTERNAL_APP, null);
      expect(await quota()).toBe(initial + 1);

      const res = await declineInternalOffer(h.db, SEED_INTERNAL_APP, null);
      expect(res.status).toBe('WITHDRAWN');

      // Kandidat menolak -> kuota kembali, tidak hangus.
      expect(await quota()).toBe(initial);

      const row = await h.client.query<{ status: string }>(
        `SELECT status FROM internal_applications WHERE id = $1::uuid`,
        [SEED_INTERNAL_APP]
      );
      expect(row.rows[0].status).toBe('WITHDRAWN');
    } finally {
      await h.close();
    }
  }, 60000);

  it('menolak tawaran internal dua kali tidak membuat kuota negatif', async () => {
    const h = await newHarness();
    try {
      await approveApplication(h.db, SEED_INTERNAL_APP, null);
      await declineInternalOffer(h.db, SEED_INTERNAL_APP, null);

      // Status sudah WITHDRAWN: penolakan ulang harus ditolak aturan bisnis,
      // bukan mengurangi kuota lagi.
      await expect(declineInternalOffer(h.db, SEED_INTERNAL_APP, null)).rejects.toThrow();

      const res = await h.client.query<{ hired_count: number }>(
        `SELECT hired_count FROM manpower_plans WHERE id = $1::uuid`,
        [SEED_MPP]
      );
      expect(res.rows[0].hired_count).toBeGreaterThanOrEqual(0);
    } finally {
      await h.close();
    }
  }, 60000);
});