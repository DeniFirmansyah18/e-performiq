import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  collectSignals, computeAndStoreRisk, recomputeAllRisks, listFlightRisk,
} from '@/lib/services/flightRiskService';

const AS_OF = '2026-10-20';
const DEPT = 'a0000000-0000-4000-8000-000000000101';
const POS = 'a0000000-0000-4000-8000-000000000204';

/** Tanggal `offset` hari dari AS_OF (negatif = lampau). */
const day = (offset: number) => {
  const d = new Date(`${AS_OF}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

describe('flightRiskService', () => {
  let client: PGlite;
  let db: any;
  let healthyId = '';
  let atRiskId = '';
  const stamp = Date.now();

  const addEmployee = async (code: string, joinDate: string) => {
    const res = (await db.execute(`
      INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
      VALUES (gen_random_uuid(), '${code}-${stamp}', 'Risiko ${code}', '${code}.${stamp}@eperformiq.co.id',
              '${DEPT}'::uuid, '${POS}'::uuid, 'PERMANENT', 8000000, '${joinDate}')
      RETURNING id`)) as unknown as { rows: Array<{ id: string }> };
    return res.rows[0].id;
  };

  const addAttendanceRecord = async (employeeId: string, workDate: string, opts: {
    present?: boolean; checkIn?: string; overtime?: number;
  } = {}) => {
    const present = opts.present ?? true;
    const checkIn = opts.checkIn ?? '08:00';
    await db.execute(`
      INSERT INTO attendance_records (employee_id, work_date, check_in, check_out, is_present, total_work_hours, total_overtime_hours)
      VALUES ('${employeeId}'::uuid, '${workDate}', '${checkIn}', '17:00', ${present}, 8.00, ${opts.overtime ?? 0})`);
  };

  const addAttendanceLog = async (employeeId: string, workDate: string, overtime: number) => {
    await db.execute(`
      INSERT INTO attendance_logs (employee_id, work_date, check_in_at, check_out_at, status, total_overtime_hours)
      VALUES ('${employeeId}'::uuid, '${workDate}', '${workDate}T08:00:00+07:00', '${workDate}T19:00:00+07:00', 'CLOSED', ${overtime})`);
  };

  const addSnapshot = async (employeeId: string, workDate: string, dpi: number, light: string, filled = 5, expected = 5) => {
    await db.execute(`
      INSERT INTO daily_performance_snapshots (employee_id, snapshot_date, dpi_score, traffic_light, indicators_expected, indicators_filled)
      VALUES ('${employeeId}'::uuid, '${workDate}', ${dpi}, '${light}', ${expected}, ${filled})`);
  };

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);

    healthyId = await addEmployee('SEHAT', '2022-01-10');
    atRiskId = await addEmployee('RISIKO', day(-100));

    // Karyawan sehat: DPI tinggi, tanpa absen, tanpa lembur.
    for (let i = -6; i <= 0; i++) {
      await addSnapshot(healthyId, day(i), 95, 'GREEN');
    }

    // Karyawan berisiko: 12 hari absen, 15 hari merah, DPI 60, lembur 45 jam,
    // streak 12 hari beruntun, dan pengisian KPI rendah.
    for (let i = 0; i < 12; i++) {
      await addAttendanceRecord(atRiskId, day(-i), { present: false });
    }
    for (let i = 0; i < 12; i++) {
      await addAttendanceLog(atRiskId, day(-i), i < 3 ? 15 : 0);
    }
    for (let i = 0; i < 15; i++) {
      await addSnapshot(atRiskId, day(-i), 60, 'RED', 2, 5);
    }
    await addAttendanceRecord(atRiskId, day(-20), { checkIn: '09:30' });
  });

  afterAll(async () => {
    await client.close();
  });

  it('mengumpulkan sinyal dari data nyata', async () => {
    const s = await collectSignals(db, atRiskId, AS_OF);
    expect(s.absentDays30).toBe(12);
    expect(s.redDays30).toBe(15);
    expect(s.overtimeHours30).toBe(45);
    expect(s.longestWorkStreak).toBeGreaterThanOrEqual(12);
    expect(s.avgDpi30).toBe(60);
    expect(s.entryAdherence).toBeCloseTo(0.4, 5);
    expect(s.tenureMonths).toBeGreaterThanOrEqual(3);
    expect(s.tenureMonths).toBeLessThan(12);
  });

  it('karyawan tanpa data tidak menghasilkan sinyal palsu', async () => {
    const kosongId = await addEmployee('KOSONG', '2026-09-01');
    const s = await collectSignals(db, kosongId, AS_OF);
    expect(s.absentDays30).toBe(0);
    expect(s.redDays30).toBe(0);
    expect(s.overtimeHours30).toBe(0);
    expect(s.avgDpi30).toBeNull();
    expect(s.dpiTrend).toBeNull();
    expect(s.entryAdherence).toBeNull();
  });

  it('membawa sinyal warisan: peer review bawaan dan sisa kontrak', async () => {
    const s = await collectSignals(db, healthyId, AS_OF);
    // Belum ada penilaian 360 → nilai netral 4.2 (tidak dianggap berisiko).
    expect(s.peerReviewAvg).toBe(4.2);
    // Tanpa contract_end_date → 0 (bukan "kontrak hampir habis").
    expect(s.contractDaysRemaining).toBe(0);
  });

  it('peer review rendah dan kontrak hampir habis menaikkan skor attrition', async () => {
    const lowPeerId = await addEmployee('PEER', '2023-02-01');
    await db.execute(`
      INSERT INTO peer_reviews_360 (period_id, evaluatee_id, evaluator_id, relationship_type,
                                    integrity_score, collaboration_score, innovation_score)
      VALUES ('d0000000-0000-4000-8000-000000000001'::uuid, '${lowPeerId}'::uuid, '${healthyId}'::uuid,
              'PEER', 2.0, 2.0, 2.0)`);
    await db.execute(`
      UPDATE employees SET contract_end_date = '${day(30)}' WHERE id = '${lowPeerId}'::uuid`);

    const s = await collectSignals(db, lowPeerId, AS_OF);
    expect(s.peerReviewAvg).toBe(2);
    expect(s.contractDaysRemaining).toBe(30);

    const row = await computeAndStoreRisk(db, lowPeerId, AS_OF);
    expect(row.attritionScore).toBeGreaterThanOrEqual(35);
  });

  it('menghitung dan menyimpan snapshot berisiko', async () => {
    const row = await computeAndStoreRisk(db, atRiskId, AS_OF);
    expect(row.attritionBand).toBe('CRITICAL');
    expect(row.attritionScore).toBeGreaterThanOrEqual(75);
    // Burnout: lembur 40 + streak 20 + terlambat 2 + hari merah 10 = 72 → HIGH.
    expect(row.burnoutBand).toBe('HIGH');
    expect(row.burnoutScore).toBeGreaterThanOrEqual(50);
    expect(row.snapshotDate).toBe(AS_OF);
    expect(row.factors.length).toBeGreaterThan(0);
  });

  it('karyawan sehat tetap LOW', async () => {
    const row = await computeAndStoreRisk(db, healthyId, AS_OF);
    expect(row.attritionBand).toBe('LOW');
    expect(row.burnoutBand).toBe('LOW');
  });

  it('recompute idempoten: baris tidak bertambah saat diulang', async () => {
    await recomputeAllRisks(db, AS_OF);
    const before = (await db.execute(
      `SELECT count(*)::int AS n FROM employee_flight_risk_snapshots WHERE snapshot_date = '${AS_OF}'`,
    )) as unknown as { rows: Array<{ n: number }> };

    await recomputeAllRisks(db, AS_OF);

    const after = (await db.execute(
      `SELECT count(*)::int AS n FROM employee_flight_risk_snapshots WHERE snapshot_date = '${AS_OF}'`,
    )) as unknown as { rows: Array<{ n: number }> };

    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('recompute melaporkan jumlah karyawan yang diproses', async () => {
    const res = await recomputeAllRisks(db, AS_OF);
    expect(res.processed).toBeGreaterThanOrEqual(2);
    expect(res.skipped).toBe(0);
  });

  it('daftar risiko dapat difilter per band', async () => {
    const kritis = await listFlightRisk(db, { band: 'CRITICAL' });
    const ids = kritis.map((r) => r.employeeId);
    expect(ids).toContain(atRiskId);
    expect(ids).not.toContain(healthyId);
  });

  it('daftar risiko membawa nama & departemen, terurut dari skor tertinggi', async () => {
    const semua = await listFlightRisk(db, { limit: 50 });
    const atRisk = semua.find((r) => r.employeeId === atRiskId);
    expect(atRisk).toBeDefined();
    expect(atRisk!.fullName).toContain('RISIKO');
    expect(atRisk!.departmentName).toBeTruthy();
    expect(semua[0].attritionScore).toBeGreaterThanOrEqual(semua[semua.length - 1].attritionScore);
  });

  it('filter departemen yang tidak cocok mengembalikan kosong', async () => {
    const res = await listFlightRisk(db, { departmentId: '00000000-0000-4000-8000-000000000000' });
    expect(res).toHaveLength(0);
  });
});
