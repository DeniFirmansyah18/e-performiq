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
    await db.execute(sql`
      INSERT INTO employee_documents (employee_id, document_type, file_url, verification_status, created_at)
      VALUES (${BUDI}::uuid, 'KTP', 'https://files.example.com/ktp.pdf', 'PENDING', NOW() - INTERVAL '5 days')
    `);

    const recommendations = await getActionRecommendations(db);
    const doc = recommendations.find((r) => r.type === 'DOCUMENT_PENDING');
    expect(doc).toBeDefined();
    expect(doc?.targetEmployeeId).toBe(BUDI);
  });

  it('posisi puncak tanpa target lanjutan menghasilkan daftar kosong, bukan error', async () => {
    // CEO tidak punya baris career_path_levels sebagai posisi asal.
    const guidance = await getCareerGuidanceForEmployee(db, CEO);
    expect(guidance.nextCareerPaths).toEqual([]);
  });
});
