import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import {
  getActionRecommendations,
  getCareerGuidanceForEmployee,
} from '@/lib/services/hrActionRecommendationService';
import { sql } from 'drizzle-orm';

describe('HR Action Recommendation & Career Guidance (TDD)', () => {
  let client: PGlite;
  let db: Db;

  // Seed: Budi (Staff IT) -> MGR posisi, CEO tanpa jenjang lanjutan.
  const BUDI = 'b0000000-0000-4000-8000-000000000004';
  const CEO = 'b0000000-0000-4000-8000-000000000001';
  const MGR_POSITION = 'a0000000-0000-4000-8000-000000000203';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  it('menghasilkan rekomendasi tindakan HRD berbasis data sistem', async () => {
    const recommendations = await getActionRecommendations(db);
    expect(Array.isArray(recommendations)).toBe(true);
  });

  it('memberikan panduan jenjang karir untuk posisi karyawan', async () => {
    const empRes = await db.execute(sql`SELECT id FROM employees LIMIT 1`);
    const empId = (empRes.rows[0] as { id: string }).id;

    const guidance = await getCareerGuidanceForEmployee(db, empId);
    expect(guidance).toBeDefined();
    expect(guidance.employeeId).toBe(empId);
    expect(Array.isArray(guidance.nextCareerPaths)).toBe(true);
  });

  it('GPA panduan karir berasal dari performance_appraisals, bukan angka hardcoded', async () => {
    // Budi punya appraisal composite_gpa = 3.67 di seed.
    const guidance = await getCareerGuidanceForEmployee(db, BUDI);
    expect(guidance.currentGpa).toBe(3.67);

    // Syarat GPA menuju posisi manajerial adalah 3.25 -> terpenuhi oleh 3.67.
    const path = guidance.nextCareerPaths.find((p) => p.targetPositionId === MGR_POSITION);
    expect(path).toBeDefined();
    expect(path?.minGpa).toBe(3.25);
    expect(path?.isGpaMet).toBe(true);
  });

  it('menghasilkan rekomendasi PROMOTION_READINESS untuk talenta yang memenuhi syarat', async () => {
    const recommendations = await getActionRecommendations(db);
    const promo = recommendations.find(
      (r) => r.type === 'PROMOTION_READINESS' && r.targetEmployeeId === BUDI
    );
    expect(promo).toBeDefined();
    expect(promo?.priority).toBe('LOW');
    expect(promo?.actionUrl).toContain('tab=career-actions');
  });

  it('menghasilkan rekomendasi DOCUMENT_PENDING untuk berkas menunggu verifikasi', async () => {
    // Seed sudah memuat berkas PENDING untuk pegawai lain, jadi uji ini harus
    // memeriksa rekomendasi milik Budi secara spesifik — bukan yang pertama.
    await db.execute(sql`
      INSERT INTO employee_documents (employee_id, document_type, file_url, verification_status, created_at)
      VALUES (${BUDI}::uuid, 'KTP', 'https://files.example.com/ktp.pdf', 'PENDING', NOW() - INTERVAL '5 days')
    `);

    const recommendations = await getActionRecommendations(db);
    const doc = recommendations.find(
      (r) => r.type === 'DOCUMENT_PENDING' && r.targetEmployeeId === BUDI
    );
    expect(doc).toBeDefined();
  });

  it('posisi puncak tanpa target lanjutan menghasilkan daftar kosong, bukan error', async () => {
    // CEO tidak punya baris career_path_levels sebagai posisi asal.
    const guidance = await getCareerGuidanceForEmployee(db, CEO);
    expect(guidance.nextCareerPaths).toEqual([]);
  });

  it('skill gap dihitung dari competency_scores, bukan disamakan dengan skill wajib', async () => {
    // Seed menilai penuh Budi untuk ketiga skill wajib (TypeScript, PostgreSQL,
    // System Design), jadi seluruhnya harus terverifikasi dan tanpa gap.
    const guidance = await getCareerGuidanceForEmployee(db, BUDI);
    const path = guidance.nextCareerPaths.find((p) => p.targetPositionId === MGR_POSITION);
    expect(path).toBeDefined();
    expect(path?.assessedSkills).toEqual(
      expect.arrayContaining([
        { skillName: 'TypeScript', actualLevel: 5, requiredLevel: 4 },
      ])
    );
    expect(path?.missingSkills).toEqual([]);
    expect(path?.unverifiedSkills).toEqual([]);
    expect(path?.verifiedSkills).toEqual(
      expect.arrayContaining(['TypeScript', 'PostgreSQL', 'System Design'])
    );
  });

  it('skill wajib tanpa bukti asesmen dilaporkan sebagai belum terverifikasi, bukan kurang', async () => {
    // Pegawai b...0007 hanya punya asesmen TypeScript; dua skill wajib lain
    // belum pernah dinilai sehingga tidak boleh diklaim "kurang", namun juga
    // tidak boleh dianggap memenuhi syarat.
    const PARTIAL = 'b0000000-0000-4000-8000-000000000007';
    const guidance = await getCareerGuidanceForEmployee(db, PARTIAL);
    const path = guidance.nextCareerPaths.find((p) => p.targetPositionId === MGR_POSITION);
    expect(path).toBeDefined();
    expect(path?.verifiedSkills).toContain('TypeScript');
    expect(path?.missingSkills).toEqual([]);
    expect(path?.unverifiedSkills).toEqual(
      expect.arrayContaining(['PostgreSQL', 'System Design'])
    );
    expect(path?.isSkillsMet).toBe(false);
    expect(path?.isEligibleForPromotion).toBe(false);
  });

  it('skill yang sudah terpenuhi tidak masuk missingSkills', async () => {
    // Tambah asesmen level memadai untuk TypeScript pada Budi.
    await db.execute(sql`
      INSERT INTO competency_scores
        (period_id, employee_id, skill_name, skill_category, required_level, actual_level, score)
      VALUES ('d0000000-0000-4000-8000-000000000001'::uuid, ${BUDI}::uuid,
              'TypeScript', 'HARD', 4, 4, 88.00)
    `);

    const guidance = await getCareerGuidanceForEmployee(db, BUDI);
    const path = guidance.nextCareerPaths.find((p) => p.targetPositionId === MGR_POSITION);
    expect(path?.missingSkills).not.toContain('TypeScript');
    expect(path?.unverifiedSkills).not.toContain('TypeScript');
    expect(path?.verifiedSkills).toContain('TypeScript');
  });
});
