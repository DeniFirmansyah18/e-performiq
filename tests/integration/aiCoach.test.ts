import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { buildCoachContext, buildCoachPrompt } from '@/lib/services/aiCoachService';

const BPJS_NUMBER = '8101234567890123';

describe('AI performance coach — batas data', () => {
  let client: PGlite;
  let db: any;
  let employeeId = '';

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);

    const stamp = Date.now();
    const emp = (await db.execute(`
      INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
      VALUES (gen_random_uuid(), 'COACH-${stamp}', 'Coach Uji', 'coach.${stamp}@eperformiq.co.id',
              'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
              'PERMANENT', 15000000, CURRENT_DATE - INTERVAL '3 years')
      RETURNING id`)) as unknown as { rows: Array<{ id: string }> };
    employeeId = emp.rows[0].id;

    await db.execute(`
      INSERT INTO employee_social_security (employee_id, bpjs_tk_number, bpjs_kes_number)
      VALUES ('${employeeId}', '${BPJS_NUMBER}', '0001234567890')
      ON CONFLICT DO NOTHING`);

    await db.execute(`
      INSERT INTO daily_performance_snapshots
        (employee_id, snapshot_date, dpi_score, traffic_light, indicators_expected, indicators_filled)
      VALUES ('${employeeId}', '2026-10-20', 64.5, 'RED', 3, 2)
      ON CONFLICT DO NOTHING`);

    await db.execute(`
      INSERT INTO disciplinary_actions (employee_id, action_type, reason, effective_date, appeal_deadline)
      VALUES ('${employeeId}', 'SP1', 'Terlambat berulang', '2026-10-01', '2026-10-06')`);
  });
  afterAll(async () => { await client.close(); });

  it('konteks memuat performa nyata', async () => {
    const ctx = await buildCoachContext(db, employeeId);
    expect(ctx.employeeName).toBe('Coach Uji');
    expect(ctx.recentSnapshots.length).toBeGreaterThanOrEqual(1);
    expect(ctx.recentSnapshots[0].trafficLight).toBe('RED');
    expect(ctx.activeSanctions).toBe(1);
  });

  it('konteks tidak memuat gaji, BPJS, atau data medis', async () => {
    const ctx = await buildCoachContext(db, employeeId);
    const serialized = JSON.stringify(ctx);
    expect(serialized).not.toContain(BPJS_NUMBER);
    expect(serialized.toLowerCase()).not.toContain('bpjs');
    expect(serialized.toLowerCase()).not.toContain('salary');
    expect(serialized.toLowerCase()).not.toContain('base_salary');
    expect(serialized.toLowerCase()).not.toContain('medical');
  });

  it('konteks hanya memakai kunci yang diizinkan', async () => {
    const ctx = await buildCoachContext(db, employeeId);
    expect(Object.keys(ctx).sort()).toEqual([
      'activeSanctions',
      'attendance',
      'careerReadinessPercent',
      'employeeName',
      'employmentStatus',
      'leaveBalanceDays',
      'recentSnapshots',
      'trainingsCompleted',
      'weakestIndicators',
    ].sort());
  });

  it('prompt menyatakan batas data dan memuat sumber', () => {
    const prompt = buildCoachPrompt(
      {
        employeeName: 'Budi', employmentStatus: 'TETAP',
        recentSnapshots: [{ date: '2026-10-20', score: 64.5, trafficLight: 'RED' }],
        weakestIndicators: [{ name: 'Tiket selesai', actual: 4, target: 10 }],
        attendance: { present: 18, absent: 2 },
        leaveBalanceDays: 8,
        trainingsCompleted: 3,
        activeSanctions: 0,
        careerReadinessPercent: 50,
      },
      'Kenapa status saya merah?',
    );
    expect(prompt).toContain('tidak memuat gaji');
    expect(prompt).toContain('2026-10-20');
    expect(prompt).toContain('Tiket selesai');
    expect(prompt).toContain('jangan mengarang');
  });

  it('sanksi muncul sebagai ringkasan, bukan alasan/bukti', async () => {
    const ctx = await buildCoachContext(db, employeeId);
    const serialized = JSON.stringify(ctx);
    // Konteks hanya memuat jumlah sanksi aktif, bukan isi pemeriksaan.
    expect(serialized).not.toContain('Terlambat berulang');
    expect(ctx.activeSanctions).toBe(1);
  });
});
