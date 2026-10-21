import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { listLadder, readiness } from '@/lib/services/careerLadderService';

describe('careerLadderService', () => {
  let client: PGlite;
  let db: any;
  let employeeId = '';

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);

    const stamp = Date.now();
    const emp = (await db.execute(`
      INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
      VALUES (gen_random_uuid(), 'CARR-${stamp}', 'Karir Uji', 'carr.${stamp}@eperformiq.co.id',
              'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
              'PERMANENT', 8000000, CURRENT_DATE - INTERVAL '2 years')
      RETURNING id`)) as unknown as { rows: Array<{ id: string }> };
    employeeId = emp.rows[0].id;

    const pos = (await db.execute(`
      SELECT e.position_id AS current, p.id AS other
        FROM employees e
        JOIN job_positions p ON p.id <> e.position_id
       WHERE e.id = '${employeeId}'
       ORDER BY p.id LIMIT 1`)) as unknown as { rows: Array<{ current: string; other: string }> };
    const { current, other } = pos.rows[0];

    await db.execute(`
      INSERT INTO career_ladder_steps
        (from_position_id, to_position_id, step_order, step_name, requirement_type, threshold_value)
      VALUES ('${current}', '${other}', 1, 'Masa kerja 1 tahun', 'TENURE', 12),
             ('${current}', '${other}', 2, 'Sertifikasi wajib', 'CERTIFICATION', 1),
             ('${current}', '${other}', 3, 'Pelatihan 24 jam', 'TRAINING_HOURS', 24)`);
  });
  afterAll(async () => { await client.close(); });

  it('tahapan tanpa data sumber dianggap belum terpenuhi', async () => {
    const steps = await listLadder(db, employeeId);
    const cert = steps.find((s) => s.requirementType === 'CERTIFICATION');
    expect(cert?.met).toBe(false);
    expect(cert?.actual).toBe(0);
  });

  it('TENURE dihitung dari join_date dan terpenuhi', async () => {
    const steps = await listLadder(db, employeeId);
    const tenure = steps.find((s) => s.requirementType === 'TENURE');
    expect(tenure?.actual).toBeGreaterThanOrEqual(24);
    expect(tenure?.met).toBe(true);
  });

  it('readiness = tahapan terpenuhi / total, dibulatkan', async () => {
    const res = await readiness(db, employeeId);
    expect(res.total).toBe(3);
    expect(res.met).toBe(1);
    expect(res.percent).toBe(33);
    expect(res.targetPositionId).toBeTruthy();
  });

  it('karyawan tanpa tangga karir → persen 0, tidak membagi nol', async () => {
    const res = await readiness(db, 'b0000000-0000-4000-8000-000000000002');
    expect(res.percent).toBe(0);
    expect(res.total).toBe(0);
  });
});
