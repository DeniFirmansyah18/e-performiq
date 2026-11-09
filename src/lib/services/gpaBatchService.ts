/**
 * Batch GPA Service (PRD §6.1) — kalkulasi Composite GPA massal via job queue.
 *
 * Kalkulasi GPA per karyawan × periode berat bila dijalankan inline untuk
 * ribuan karyawan. Service ini memecah pekerjaan menjadi *job* yang diproses
 * bertahap (chunk) sehingga:
 *  - respons API cepat (enqueue → kembalikan jobId),
 *  - proses dapat dilanjutkan/diulang (resumable & idempoten),
 *  - kegagalan satu karyawan tidak menggagalkan seluruh batch.
 *
 * Deterministik & driver-agnostic. Bila worker tidak dijalankan, pemanggil
 * tetap dapat memproses job secara sinkron lewat `processGpaBatch`.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export type GpaBatchStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface GpaBatchJob {
  id: string;
  periodId: string;
  status: GpaBatchStatus;
  totalCount: number;
  processedCount: number;
  failedCount: number;
  lastError: string | null;
  createdAt: string;
}

export interface GpaScoreInput {
  kpiScore: number;
  sopScore: number;
  competencyScore: number;
  coreValuesScore: number;
  potentialScore?: number;
}

export interface EnqueueGpaBatchResult {
  jobId: string;
  periodId: string;
  totalCount: number;
  status: GpaBatchStatus;
}

/**
 * Buat job batch kalkulasi GPA untuk seluruh karyawan yang punya KPI pada
 * periode tsb. `totalCount` = jumlah target. Idempoten (tidak menggandakan
 * job PENDING/RUNNING untuk periode yang sama).
 */
export async function enqueueGpaBatch(
  db: Db,
  input: { periodId: string; createdBy?: string | null }
): Promise<EnqueueGpaBatchResult> {
  const targets = (await db.execute(sql`
    SELECT DISTINCT employee_id AS "employeeId"
      FROM individual_kpis
     WHERE period_id = ${input.periodId}::uuid
  `)) as unknown as { rows: Array<{ employeeId: string }> };
  const totalCount = targets.rows?.length ?? 0;

  // Cegah job ganda yang masih aktif untuk periode sama.
  const active = (await db.execute(sql`
    SELECT id FROM gpa_batch_jobs
     WHERE period_id = ${input.periodId}::uuid
       AND status IN ('PENDING','RUNNING')
     ORDER BY created_at DESC LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  if (active.rows?.[0]) {
    return { jobId: active.rows[0].id, periodId: input.periodId, totalCount, status: 'PENDING' };
  }

  const created = (await db.execute(sql`
    INSERT INTO gpa_batch_jobs (period_id, status, total_count, created_by)
    VALUES (${input.periodId}::uuid, 'PENDING', ${totalCount}, ${input.createdBy ?? null}::uuid)
    RETURNING id, status
  `)) as unknown as { rows: Array<{ id: string; status: GpaBatchStatus }> };

  return {
    jobId: created.rows[0].id,
    periodId: input.periodId,
    totalCount,
    status: created.rows[0].status,
  };
}

/**
 * Daftar karyawan target pada periode (sumber pekerjaan batch).
 * Karyawan yang sudah punya appraisal terkalibrasi dilewati (immutable).
 */
export async function listGpaBatchTargets(
  db: Db,
  periodId: string,
  limit = 500
): Promise<string[]> {
  const res = (await db.execute(sql`
    SELECT DISTINCT ik.employee_id AS "employeeId"
      FROM individual_kpis ik
      LEFT JOIN performance_appraisals pa
        ON pa.employee_id = ik.employee_id AND pa.period_id = ik.period_id
     WHERE ik.period_id = ${periodId}::uuid
       AND pa.id IS NULL
     LIMIT ${limit}
  `)) as unknown as { rows: Array<{ employeeId: string }> };
  return (res.rows ?? []).map((r) => r.employeeId);
}

/**
 * Proses satu potongan (chunk) pekerjaan batch. `resolver` menyuplai skor
 * komponen untuk tiap karyawan; bila mengembalikan null → karyawan dilewati
 * (bukan kegagalan). Mengembalikan ringkasan progres job.
 */
export async function processGpaBatch(
  db: Db,
  jobId: string,
  resolver: (employeeId: string) => Promise<GpaScoreInput | null>,
  options?: { chunkSize?: number }
): Promise<GpaBatchJob> {
  const chunkSize = options?.chunkSize ?? 50;

  const jobRes = (await db.execute(sql`
    SELECT id, period_id AS "periodId", status, total_count AS "totalCount",
           processed_count AS "processedCount", failed_count AS "failedCount"
      FROM gpa_batch_jobs WHERE id = ${jobId}::uuid
  `)) as unknown as { rows: Array<{ id: string; periodId: string; status: GpaBatchStatus; totalCount: number; processedCount: number; failedCount: number }> };
  const job = jobRes.rows?.[0];
  if (!job) throw new Error(`Job batch GPA '${jobId}' tidak ditemukan.`);

  await db.execute(sql`
    UPDATE gpa_batch_jobs SET status = 'RUNNING',
           started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
     WHERE id = ${jobId}::uuid
  `);

  const targets = await listGpaBatchTargets(db, job.periodId, chunkSize);
  let processed = job.processedCount;
  let failed = job.failedCount;
  let lastError: string | null = null;

  for (const employeeId of targets) {
    try {
      const input = await resolver(employeeId);
      if (!input) { processed += 1; continue; }
      const { calculateCompositeGPA } = await import('@/lib/engines/gpa-engine');
      const result = calculateCompositeGPA({
        kpiScore: input.kpiScore,
        sopScore: input.sopScore,
        competencyScore: input.competencyScore,
        coreValuesScore: input.coreValuesScore,
        potentialScore: input.potentialScore ?? 3.5,
      });
      await db.execute(sql`
        INSERT INTO performance_appraisals
          (period_id, employee_id, kpi_composite_score, sop_compliance_score, competency_score,
           core_values_score, total_percentage_score, composite_gpa, performance_rating,
           potential_score, nine_box_quadrant)
        VALUES (${job.periodId}::uuid, ${employeeId}::uuid, ${input.kpiScore}, ${input.sopScore},
                ${input.competencyScore}, ${input.coreValuesScore}, ${result.totalPercentage},
                ${result.compositeGPA}, ${result.rating}, ${input.potentialScore ?? 3.5}, ${result.nineBoxQuadrant})
        ON CONFLICT (period_id, employee_id)
        DO UPDATE SET kpi_composite_score = EXCLUDED.kpi_composite_score,
                      sop_compliance_score = EXCLUDED.sop_compliance_score,
                      competency_score = EXCLUDED.competency_score,
                      core_values_score = EXCLUDED.core_values_score,
                      total_percentage_score = EXCLUDED.total_percentage_score,
                      composite_gpa = EXCLUDED.composite_gpa,
                      performance_rating = EXCLUDED.performance_rating,
                      potential_score = EXCLUDED.potential_score,
                      nine_box_quadrant = EXCLUDED.nine_box_quadrant
        WHERE performance_appraisals.is_calibrated = FALSE
      `);
      processed += 1;
    } catch (err) {
      failed += 1;
      lastError = (err as Error)?.message ?? 'unknown';
      // Karyawan yang gagal tetap "belum tersimpan", namun ditandai terproses
      // agar batch tidak berputar selamanya; gunakan `totalCount` untuk audit.
      processed += 1;
    }
  }

  // Batch dianggap selesai bila potongan ini tidak penuh (antrean terkuras).
  const done = targets.length < chunkSize;
  const status: GpaBatchStatus = done ? 'COMPLETED' : 'RUNNING';

  const updated = (await db.execute(sql`
    UPDATE gpa_batch_jobs SET processed_count = ${processed}, failed_count = ${failed},
           last_error = ${lastError}, status = ${status}::gpa_batch_status_enum,
           completed_at = CASE WHEN ${status} = 'COMPLETED' THEN CURRENT_TIMESTAMP ELSE NULL END
     WHERE id = ${jobId}::uuid
    RETURNING id, period_id AS "periodId", status, total_count AS "totalCount",
              processed_count AS "processedCount", failed_count AS "failedCount",
              last_error AS "lastError", created_at AS "createdAt"
  `)) as unknown as { rows: any[] };
  return normalizeJob(updated.rows[0]);
}

/** Ambil status satu job batch. */
export async function getGpaBatchJob(db: Db, jobId: string): Promise<GpaBatchJob | null> {
  const res = (await db.execute(sql`
    SELECT id, period_id AS "periodId", status, total_count AS "totalCount",
           processed_count AS "processedCount", failed_count AS "failedCount",
           last_error AS "lastError", created_at AS "createdAt"
      FROM gpa_batch_jobs WHERE id = ${jobId}::uuid
  `)) as unknown as { rows: any[] };
  return res.rows?.[0] ? normalizeJob(res.rows[0]) : null;
}

/** Daftar job batch terbaru. */
export async function listGpaBatchJobs(db: Db, limit = 20): Promise<GpaBatchJob[]> {
  const res = (await db.execute(sql`
    SELECT id, period_id AS "periodId", status, total_count AS "totalCount",
           processed_count AS "processedCount", failed_count AS "failedCount",
           last_error AS "lastError", created_at AS "createdAt"
      FROM gpa_batch_jobs ORDER BY created_at DESC LIMIT ${limit}
  `)) as unknown as { rows: any[] };
  return (res.rows ?? []).map(normalizeJob);
}

function normalizeJob(row: any): GpaBatchJob {
  return {
    id: row.id,
    periodId: row.periodId,
    status: row.status,
    totalCount: Number(row.totalCount ?? 0),
    processedCount: Number(row.processedCount ?? 0),
    failedCount: Number(row.failedCount ?? 0),
    lastError: row.lastError ?? null,
    createdAt: row.createdAt,
  };
}
