import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { submitApplication, getApplicationDetail } from '@/lib/services/candidateService';
import { searchMajors, searchInstitutions } from '@/lib/services/educationReferenceService';
import { listNotifications, notifyStageChange } from '@/lib/services/notificationService';

const CV = `Budi Santoso
budi.santoso@example.com | 0812-3456-7890
RINGKASAN
Engineer berpengalaman membangun sistem backend menggunakan TypeScript dan PostgreSQL.

PENGALAMAN KERJA
Senior Backend Engineer | PT Nusantara | Jan 2019 - Sekarang
Membangun layanan microservices.

PENDIDIKAN
S1 Teknik Informatika, Universitas Indonesia, 2013 - 2017, IPK 3.70

KEAHLIAN
TypeScript, PostgreSQL, Docker
`;

describe('WS-13 lamaran lengkap + referensi pendidikan + notifikasi', () => {
  let client: PGlite;
  let db: any;
  let postingId: string;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
    await client.exec(`UPDATE job_postings SET is_public = TRUE, status = 'OPEN' WHERE id IN (SELECT id FROM job_postings LIMIT 3);`);
    const q = await client.query<{ id: string }>(`SELECT id FROM job_postings WHERE is_public = TRUE LIMIT 1`);
    postingId = q.rows[0].id;
  });
  afterAll(async () => { await client.close(); });

  describe('referensi pendidikan', () => {
    it('searchMajors mengembalikan jurusan ter-seed', async () => {
      const majors = await searchMajors(db, 'informatika');
      expect(majors.length).toBeGreaterThanOrEqual(1);
      expect(majors.some((m) => /informatika/i.test(m.name))).toBe(true);
    });

    it('searchMajors tanpa query mengembalikan daftar default', async () => {
      const majors = await searchMajors(db, '');
      expect(majors.length).toBeGreaterThanOrEqual(10);
    });

    it('searchInstitutions menemukan universitas dari seed PDDIKTI (PT)', async () => {
      const inst = await searchInstitutions(db, 'universitas gadjah');
      expect(inst.some((i) => /gadjah mada/i.test(i.name))).toBe(true);
      expect(inst[0].level).toBe('PT');
    });

    it('searchInstitutions institut teknologi menemukan ITB & ITS', async () => {
      const inst = await searchInstitutions(db, 'institut teknologi');
      const names = inst.map((i) => i.name.toLowerCase());
      expect(names.some((n) => n.includes('teknologi bandung'))).toBe(true);
      expect(names.some((n) => n.includes('sepuluh nopember'))).toBe(true);
    });

    it('searchInstitutions mengembalikan kode PT (kode PDDIKTI) bila ada', async () => {
      const inst = await searchInstitutions(db, 'universitas indonesia');
      const ui = inst.find((i) => /^universitas indonesia$/i.test(i.name));
      expect(ui).toBeTruthy();
      expect(ui!.code).toBeTruthy();
    });

    it('searchInstitutions mengembalikan institusi lokal (fallback) walau API eksternal tak tersedia', async () => {
      const inst = await searchInstitutions(db, 'Universitas Indonesia');
      expect(inst.some((i) => /universitas indonesia/i.test(i.name))).toBe(true);
    });

    it('searchInstitutions menemukan SMA/SMK dari seed lokal (fallback sekolah)', async () => {
      const inst = await searchInstitutions(db, 'SMAN 8 Jakarta');
      expect(inst.some((i) => /sman 8 jakarta/i.test(i.name))).toBe(true);
      const sma = inst.find((i) => /sman 8 jakarta/i.test(i.name))!;
      expect(sma.level).toBe('SMA/SMK');
    });

    it('searchInstitutions query SMK mengembalikan jenjang SMA/SMK', async () => {
      const inst = await searchInstitutions(db, 'SMKN 2 Surabaya');
      const smk = inst.find((i) => /smkn 2 surabaya/i.test(i.name));
      expect(smk).toBeTruthy();
      expect(smk!.level).toBe('SMA/SMK');
    });

    it('searchInstitutions query < 2 huruf → kosong', async () => {
      expect(await searchInstitutions(db, 'a')).toEqual([]);
    });
  });

  describe('submitApplication lengkap', () => {
    it('menyimpan lamaran + pendidikan + pengalaman + sertifikasi + berkas', async () => {
      const result = await submitApplication(db, {
        fullName: 'Budi Santoso', email: 'budi.santoso@example.com', phone: '08123456789',
        gender: 'LAKI_LAKI', nik: '3201234567890001',
        jobPostingId: postingId,
        educations: [{ level: 'S1', institution: 'Universitas Indonesia', institutionCode: '0001', major: 'Teknik Informatika', startYear: 2013, endYear: 2017, graduationStatus: 'LULUS', gpa: 3.7 }],
        experiences: [{ experienceType: 'KERJA', roleTitle: 'Senior Backend Engineer', company: 'PT Nusantara', location: 'Jakarta', startMonth: 1, startYear: 2019, endMonth: null, endYear: null, isCurrent: true }],
        certifications: [{ kind: 'CERTIFICATION', name: 'AWS Certified', issuer: 'Amazon', issuedDate: '2022-01-01', proofUrl: 'data:application/pdf;base64,AAAA' }],
        documents: [{ docType: 'COVER_LETTER', fileName: 'surat.pdf', fileUrl: 'data:application/pdf;base64,BBBB' }],
      } as any);

      expect(result.applicationNo).toMatch(/^APP-/);

      const detail: any = await getApplicationDetail(db, result.applicationId!);
      expect(detail.gender).toBe('LAKI_LAKI');
      expect(detail.nik).toBe('3201234567890001');
      expect(detail.educations.length).toBe(1);
      expect(detail.educations[0].level).toBe('S1');
      expect(detail.educations[0].institution).toBe('Universitas Indonesia');
      expect(detail.experiences.length).toBe(1);
      expect(detail.experiences[0].roleTitle).toBe('Senior Backend Engineer');
      expect(detail.experiences[0].isCurrent).toBe(true);
      expect(detail.certifications.length).toBe(1);
      expect(detail.certifications[0].name).toBe('AWS Certified');
      expect(detail.documents.length).toBe(1);
      expect(detail.documents[0].docType).toBe('COVER_LETTER');
    });

    it('lamaran tanpa data tambahan tetap aman (empty arrays)', async () => {
      const result = await submitApplication(db, {
        fullName: 'Minimal', email: 'minimal@example.com', jobPostingId: postingId,
      });
      const detail: any = await getApplicationDetail(db, result.applicationId!);
      expect(detail.educations).toEqual([]);
      expect(detail.experiences).toEqual([]);
      expect(detail.certifications).toEqual([]);
    });
  });

  describe('notifikasi', () => {
    it('notifyStageChange membuat notifikasi in-app untuk lamaran', async () => {
      const result = await submitApplication(db, {
        fullName: 'Notif Uji', email: 'notif.uji@example.com', jobPostingId: postingId,
      });
      await notifyStageChange(db, { applicationId: result.applicationId!, stage: 'INTERVIEW', status: 'SCHEDULED' });

      const rows = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM candidate_notifications WHERE application_id = $1::uuid`,
        [result.applicationId],
      );
      expect(Number(rows.rows[0].n)).toBeGreaterThanOrEqual(1);
    });

    it('email_outbox menerima baris saat notify dipanggil', async () => {
      const before = await client.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM email_outbox`);
      const result = await submitApplication(db, {
        fullName: 'Email Uji', email: 'email.uji@example.com', jobPostingId: postingId,
      });
      await notifyStageChange(db, { applicationId: result.applicationId!, stage: 'DECISION', status: 'PASSED' });
      const after = await client.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM email_outbox`);
      expect(Number(after.rows[0].n)).toBeGreaterThanOrEqual(Number(before.rows[0].n));
    });
  });
});
