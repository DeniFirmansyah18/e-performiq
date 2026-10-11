import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import {
  enqueueGpaBatch,
  processGpaBatch,
  getGpaBatchJob,
  listGpaBatchTargets,
  listGpaBatchJobs,
} from '@/lib/services/gpaBatchService';

const PERIOD_Q3 = 'd0000000-0000-4000-8000-000000000001'; // 2026-Q3 (ACTIVE)
const PERIOD_Q4 = 'd0000000-0000-4000-8000-000000000002'; // 2026-Q4 (ACTIVE, tanpa KPI)
const BUDI = 'b0000000-0000-4000-8000-000000000004';
const RIAN = 'b0000000-0000-4000-8000-000000000009';

/** Tambah KPI (bobot 100) agar karyawan menjadi target batch pada periode. */
async function addKpi(db: Db, periodId: string, employeeId: string, title: string) {
  await db.execute(
    `INSERT INTO individual_kpis (period_id, employee_id, strategic_pillar_id, kpi_title, target_value, unit_of_measure, kpi_weight, status)
     SELECT '${periodId}'::uuid, '${employeeId}'::uuid, id, '${title}', 100, '%', 100, 'APPROVED'
       FROM strategic_pillars LIMIT 1`
  );
}

const scoreOf = () => ({
  kpiScore: 92, sopScore: 96, competencyScore: 85, coreValuesScore: 90, potentialScore: 4.2,
});

describe('Stage R1 — batch/queue kalkulasi GPA massal', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    await runSeed(client);
  });
  afterAll(async () => { await client.close(); });

  it('enqueue membuat job PENDING dengan total target karyawan ber-KPI', async () => {
    await addKpi(db, PERIOD_Q3, RIAN, 'Batch Q3 KPI');
    const res = await enqueueGpaBatch(db, { periodId: PERIOD_Q3, createdBy: null });
    expect(res.jobId).toBeTruthy();
    expect(res.status).toBe('PENDING');
    expect(res.totalCount).toBeGreaterThan(0);
  });

  it('enqueue idempoten: tidak menggandakan job aktif untuk periode sama', async () => {
    const first = await enqueueGpaBatch(db, { periodId: PERIOD_Q4, createdBy: null });
    const second = await enqueueGpaBatch(db, { periodId: PERIOD_Q4, createdBy: null });
    expect(second.jobId).toBe(first.jobId);
  });

  it('listGpaBatchTargets mengembalikan karyawan ber-KPI non-kalibrasi', async () => {
    await addKpi(db, PERIOD_Q4, RIAN, 'Batch Q4 KPI');
    const targets = await listGpaBatchTargets(db, PERIOD_Q4);
    expect(targets).toContain(RIAN);
  });

  it('listGpaBatchTargets melewati appraisal yang sudah dikalibrasi (immutable)', async () => {
    // Budi pada Q3 sudah punya appraisal is_calibrated=TRUE → harus dilewati.
    const targets = await listGpaBatchTargets(db, PERIOD_Q3);
    expect(targets).not.toContain(BUDI);
  });

  it('processGpaBatch menghitung GPA & menyimpan appraisal, lalu COMPLETED', async () => {
    const { jobId } = await enqueueGpaBatch(db, { periodId: PERIOD_Q4, createdBy: null });
    const job = await processGpaBatch(db, jobId, async () => scoreOf(), { chunkSize: 500 });
    expect(job.status).toBe('COMPLETED');
    expect(job.processedCount).toBeGreaterThan(0);
    expect(job.failedCount).toBe(0);

    const saved = await db.execute<any>(
      `SELECT composite_gpa AS "gpa", nine_box_quadrant AS "quad"
         FROM performance_appraisals
        WHERE period_id = '${PERIOD_Q4}'::uuid AND employee_id = '${RIAN}'::uuid`
    );
    const row = (saved as unknown as { rows: any[] }).rows[0];
    expect(row).toBeTruthy();
    expect(Number(row.gpa)).toBeGreaterThan(0);
    expect(row.quad).toBeTruthy();
  });

  it('kegagalan satu karyawan tidak menggagalkan batch (failed_count tercatat)', async () => {
    await addKpi(db, PERIOD_Q4, BUDI, 'Batch Q4 Failing KPI');
    const { jobId } = await enqueueGpaBatch(db, { periodId: PERIOD_Q4, createdBy: null });
    const job = await processGpaBatch(db, jobId, async () => {
      throw new Error('resolver meledak');
    }, { chunkSize: 500 });
    // Target gagal dilaporkan, namun batch tetap selesai (tidak berputar selamanya).
    expect(job.failedCount).toBeGreaterThan(0);
    expect(job.status).toBe('COMPLETED');
    expect(job.lastError).toContain('resolver meledak');
  });

  it('getGpaBatchJob & listGpaBatchJobs mengembalikan data job', async () => {
    const jobs = await listGpaBatchJobs(db);
    expect(jobs.length).toBeGreaterThan(0);
    const one = await getGpaBatchJob(db, jobs[0].id);
    expect(one?.id).toBe(jobs[0].id);
  });

  it('getGpaBatchJob mengembalikan null untuk id tak dikenal', async () => {
    const none = await getGpaBatchJob(db, '00000000-0000-4000-8000-999999999999');
    expect(none).toBeNull();
  });
});
