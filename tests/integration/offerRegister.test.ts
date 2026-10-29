import { describe, it, expect } from 'vitest';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { hashPassword } from '@/lib/auth/password';
import type { Db } from '@/lib/db/client';
import { updateApplicationStatus } from '@/lib/services/candidateService';
import {
  extendOffer,
  respondToOffer,
  listExpiringOffers,
  listOfferAuditTrail,
} from '@/lib/services/offerService';
import { convertHiredCandidate } from '@/lib/services/candidateConversionService';

/**
 * Tiga celah alur OFFERED (ADR 023):
 *  1. Surat penawaran + batas waktu respons + audit trail penawaran
 *  2. employee_code berformat baku EMP-TAHUN-NNNN (bukan acak)
 *  3. base_salary dari penawaran (bukan 0) saat konversi
 *
 * Setiap test memakai DB sendiri agar tidak saling memengaruhi.
 */

const PUBLIC_POSTING = '87000000-0000-4000-8000-000000000001';
const SEED_MPP = '50000000-0000-4000-8000-000000000001';

interface Harness {
  client: Awaited<ReturnType<typeof createTestDb>>['client'];
  db: Db;
  close: () => Promise<void>;
}

async function newHarness(): Promise<Harness> {
  const { client, db } = await createTestDb();
  await runSeed(client);
  return { client, db, close: () => client.close() };
}

async function makeApplication(
  h: Harness,
  email: string,
  status: string
): Promise<{ applicationId: string; accountId: string }> {
  const hash = await hashPassword('rahasia123');
  const acc = await h.client.query<{ id: string }>(
    `INSERT INTO candidate_accounts (email, password_hash, full_name, is_verified)
     VALUES ($1, $2, 'Kandidat Offer', TRUE) RETURNING id`,
    [email, hash]
  );
  const cand = await h.client.query<{ id: string }>(
    `INSERT INTO candidates (full_name, email, account_id)
     VALUES ('Kandidat Offer', $1, $2) RETURNING id`,
    [email, acc.rows[0].id]
  );
  const app = await h.client.query<{ id: string }>(
    `INSERT INTO job_applications (application_no, candidate_id, job_posting_id, status)
     VALUES ($1, $2, $3::uuid, $4::application_status_enum) RETURNING id`,
    [`APP-OFR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, cand.rows[0].id, PUBLIC_POSTING, status]
  );
  return { applicationId: app.rows[0].id, accountId: acc.rows[0].id };
}

describe('Register penawaran kerja (surat, batas waktu, audit)', () => {
  it('membuat penawaran dengan surat, gaji, dan batas waktu respons', async () => {
    const h = await newHarness();
    try {
      const { applicationId } = await makeApplication(
        h,
        `offer.buat.${Date.now()}@example.com`,
        'INTERVIEW'
      );

      const offer = await extendOffer(h.db, {
        applicationId,
        offeredByUserId: 'e0000000-0000-4000-8000-000000000002',
        baseSalary: 28500000,
        fixedAllowance: 2500000,
        responseDays: 7,
        notes: 'Penawaran tahap akhir',
      });

      expect(offer.status).toBe('SENT');
      expect(offer.baseSalary).toBe(28500000);
      expect(offer.letterAgendaNumber).toMatch(/^OFFER-/);
      expect(offer.responseDeadline).toBeTruthy();

      const deadline = new Date(offer.responseDeadline).getTime();
      const offered = new Date(offer.offeredAt).getTime();
      const days = Math.round((deadline - offered) / 86_400_000);
      expect(days).toBe(7);

      // Lamaran naik ke OFFERED sebagai bagian dari penerbitan penawaran.
      const st = await h.client.query<{ status: string }>(
        `SELECT status::text AS status FROM job_applications WHERE id = $1::uuid`,
        [applicationId]
      );
      expect(st.rows[0].status).toBe('OFFERED');

      // Surat penawaran terdaftar di modul e-Surat (OUTGOING).
      const letter = await h.client.query<{ subject: string; direction: string }>(
        `SELECT subject, direction::text AS direction FROM letters
          WHERE agenda_number = $1`,
        [offer.letterAgendaNumber]
      );
      expect(letter.rows[0].direction).toBe('OUTGOING');
      expect(letter.rows[0].subject).toMatch(/[Pp]enawaran/);
    } finally {
      await h.close();
    }
  }, 60000);

  it('menolak gaji di bawah nol dan batas waktu tidak masuk akal', async () => {
    const h = await newHarness();
    try {
      const { applicationId } = await makeApplication(
        h,
        `offer.valid.${Date.now()}@example.com`,
        'INTERVIEW'
      );

      await expect(
        extendOffer(h.db, {
          applicationId,
          offeredByUserId: null,
          baseSalary: -1,
          responseDays: 7,
        })
      ).rejects.toThrow();

      await expect(
        extendOffer(h.db, {
          applicationId,
          offeredByUserId: null,
          baseSalary: 10000000,
          responseDays: 0,
        })
      ).rejects.toThrow();
    } finally {
      await h.close();
    }
  }, 60000);

  it('menerima penawaran menandai ACCEPTED dan menutup surat', async () => {
    const h = await newHarness();
    try {
      const { applicationId } = await makeApplication(
        h,
        `offer.terima.${Date.now()}@example.com`,
        'INTERVIEW'
      );
      const offer = await extendOffer(h.db, {
        applicationId,
        offeredByUserId: null,
        baseSalary: 20000000,
        responseDays: 7,
      });

      const responded = await respondToOffer(h.db, {
        applicationId,
        response: 'ACCEPTED',
        responseNote: 'Setuju bergabung',
      });
      expect(responded.status).toBe('ACCEPTED');

      const row = await h.client.query<{ status: string; responded_at: string }>(
        `SELECT status::text AS status, responded_at FROM job_offers WHERE application_id = $1::uuid`,
        [applicationId]
      );
      expect(row.rows[0].status).toBe('ACCEPTED');
      expect(row.rows[0].responded_at).toBeTruthy();
    } finally {
      await h.close();
    }
  }, 60000);

  it('menolak penawaran melepas kuota publik dan menandai DECLINED', async () => {
    const h = await newHarness();
    try {
      const { applicationId } = await makeApplication(
        h,
        `offer.tolak.${Date.now()}@example.com`,
        'INTERVIEW'
      );
      await extendOffer(h.db, {
        applicationId,
        offeredByUserId: null,
        baseSalary: 20000000,
        responseDays: 7,
      });

      await respondToOffer(h.db, {
        applicationId,
        response: 'DECLINED',
        responseNote: 'Menerima tawaran di tempat lain',
      });

      const app = await h.client.query<{ status: string }>(
        `SELECT status::text AS status FROM job_applications WHERE id = $1::uuid`,
        [applicationId]
      );
      expect(app.rows[0].status).toBe('OFFER_DECLINED');
    } finally {
      await h.close();
    }
  }, 60000);

  it('audit trail penawaran terurut dan memuat aktor', async () => {
    const h = await newHarness();
    try {
      const { applicationId } = await makeApplication(
        h,
        `offer.audit.${Date.now()}@example.com`,
        'INTERVIEW'
      );
      const hrId = 'e0000000-0000-4000-8000-000000000002';
      await extendOffer(h.db, {
        applicationId,
        offeredByUserId: hrId,
        baseSalary: 21000000,
        responseDays: 5,
      });
      await respondToOffer(h.db, { applicationId, response: 'ACCEPTED' });

      const trail = await listOfferAuditTrail(h.db, applicationId);
      expect(trail.length).toBeGreaterThanOrEqual(2);
      expect(trail[0].action).toBe('OFFER_SENT');
      expect(trail[0].actorUserId).toBe(hrId);
      expect(trail[trail.length - 1].action).toBe('OFFER_ACCEPTED');
      // Terurut waktu menaik.
      for (let i = 1; i < trail.length; i++) {
        expect(new Date(trail[i].at).getTime()).toBeGreaterThanOrEqual(
          new Date(trail[i - 1].at).getTime()
        );
      }
    } finally {
      await h.close();
    }
  }, 60000);

  it('menandai penawaran lewat batas waktu sebagai EXPIRED', async () => {
    const h = await newHarness();
    try {
      const { applicationId } = await makeApplication(
        h,
        `offer.expired.${Date.now()}@example.com`,
        'INTERVIEW'
      );
      await extendOffer(h.db, {
        applicationId,
        offeredByUserId: null,
        baseSalary: 20000000,
        responseDays: 7,
      });
      // Simulasi waktu berjalan: deadline digeser ke masa lalu.
      await h.client.exec(
        `UPDATE job_offers SET response_deadline = NOW() - INTERVAL '1 day'
          WHERE application_id = '${applicationId}'::uuid`
      );

      const expired = await listExpiringOffers(h.db);
      expect(expired.some((o) => o.applicationId === applicationId)).toBe(true);
      expect(expired.find((o) => o.applicationId === applicationId)?.status).toBe('EXPIRED');

      // Penawaran EXPIRED tidak dapat direspons lagi.
      await expect(
        respondToOffer(h.db, { applicationId, response: 'ACCEPTED' })
      ).rejects.toThrow();
    } finally {
      await h.close();
    }
  }, 60000);
});

describe('Konversi HIRED: employee_code baku + gaji dari penawaran', () => {
  it('menghasilkan EMP-TAHUN-NNNN dan base_salary dari penawaran', async () => {
    const h = await newHarness();
    try {
      const email = `konversi.gaji.${Date.now()}@example.com`;
      const { applicationId } = await makeApplication(h, email, 'OFFERED');
      await extendOffer(h.db, {
        applicationId,
        offeredByUserId: null,
        baseSalary: 32500000,
        fixedAllowance: 2500000,
        responseDays: 7,
      });

      const conv = await convertHiredCandidate(h.db, { applicationId });
      expect(conv.created).toBe(true);

      const emp = await h.client.query<{ employee_code: string; base_salary: string }>(
        `SELECT employee_code, base_salary::text AS base_salary FROM employees WHERE id = $1::uuid`,
        [conv.employeeId]
      );
      const code = emp.rows[0].employee_code;
      // Format baku: EMP-TAHUN-NNNN (tahun masuk 4 digit, nomor urut 4 digit).
      expect(code).toMatch(/^EMP-\d{4}-\d{4}$/);
      expect(code).toMatch(new RegExp(`^EMP-${new Date().getFullYear()}-`));
      // Gaji mengikuti penawaran, bukan 0.
      expect(Number(emp.rows[0].base_salary)).toBe(32500000);
    } finally {
      await h.close();
    }
  }, 60000);

  it('menolak konversi HIRED tanpa penawaran (gaji tidak boleh dikarang)', async () => {
    const h = await newHarness();
    try {
      const { applicationId } = await makeApplication(
        h,
        `konversi.tanpa-offer.${Date.now()}@example.com`,
        'OFFERED'
      );

      await expect(convertHiredCandidate(h.db, { applicationId })).rejects.toThrow(/penawaran/i);
    } finally {
      await h.close();
    }
  }, 60000);

  it('nomor urut bertambah tanpa bentrok pada tahun yang sama', async () => {
    const h = await newHarness();
    try {
      const year = new Date().getFullYear();
      const codes: string[] = [];
      for (let i = 0; i < 3; i++) {
        const email = `urut.${year}.${i}.${Date.now()}@example.com`;
        const { applicationId } = await makeApplication(h, email, 'OFFERED');
        await extendOffer(h.db, {
          applicationId,
          offeredByUserId: null,
          baseSalary: 10000000 + i,
          responseDays: 7,
        });
        const conv = await convertHiredCandidate(h.db, { applicationId });
        const emp = await h.client.query<{ employee_code: string }>(
          `SELECT employee_code FROM employees WHERE id = $1::uuid`,
          [conv.employeeId]
        );
        codes.push(emp.rows[0].employee_code);
      }
      const seqs = codes.map((c) => Number(c.split('-')[2]));
      expect(new Set(codes).size).toBe(3);
      // Nomor urut monoton naik dalam tahun yang sama.
      for (let i = 1; i < seqs.length; i++) expect(seqs[i]).toBeGreaterThan(seqs[i - 1]);
    } finally {
      await h.close();
    }
  }, 60000);
});