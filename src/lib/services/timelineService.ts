/**
 * Timeline Service — melacak progres tahap lamaran kandidat.
 *
 * Tahap (sesuai enum `timeline_stage_enum`):
 *   APPLIED → ATS_REVIEW → PSYCHOMETRIC → TECHNICAL → INTERVIEW → HR_REVIEW → DECISION
 *
 * Tanggung jawab:
 *  - Membuat/memperbarui catatan tahap (`application_timeline`) secara idempoten.
 *  - Menyinkronkan tahap dari status lamaran (`job_applications.status`) dan
 *    hasil yang sudah ada (mis. `resume_parses` → ATS_REVIEW PASSED).
 *  - Menyusun "progress view" untuk kandidat: tiap tahap punya state
 *    (done / current / upcoming / failed / skipped) untuk ditampilkan sebagai stepper.
 *
 * Deterministik & tidak crash (semua akses DB best-effort).
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export type TimelineStage =
  | 'APPLIED'
  | 'ATS_REVIEW'
  | 'PSYCHOMETRIC'
  | 'TECHNICAL'
  | 'INTERVIEW'
  | 'HR_REVIEW'
  | 'DECISION';

export type TimelineStatus = 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'SCHEDULED' | 'SKIPPED';

/** Urutan tahap + label manusiawi (Bahasa Indonesia). */
export const STAGE_ORDER: TimelineStage[] = [
  'APPLIED', 'ATS_REVIEW', 'PSYCHOMETRIC', 'TECHNICAL', 'INTERVIEW', 'HR_REVIEW', 'DECISION',
];

export const STAGE_LABEL: Record<TimelineStage, string> = {
  APPLIED: 'Lamaran Diterima',
  ATS_REVIEW: 'Seleksi Berkas (ATS)',
  PSYCHOMETRIC: 'Tes Psikometri',
  TECHNICAL: 'Tes Teknis',
  INTERVIEW: 'Wawancara',
  HR_REVIEW: 'Review HR',
  DECISION: 'Keputusan Akhir',
};

/** Front-end state tiap tahap. */
export type StageState = 'DONE' | 'CURRENT' | 'UPCOMING' | 'FAILED' | 'SKIPPED';

export interface TimelineEntry {
  stage: TimelineStage;
  label: string;
  status: TimelineStatus;
  state: StageState;
  note?: string | null;
  at?: string | null;
}

export interface ApplicationTimelineView {
  applicationNo: string;
  applicationStatus: string;
  postingTitle: string;
  candidateName: string;
  overallState: 'IN_PROGRESS' | 'ACCEPTED' | 'REJECTED' | 'TALENT_POOL';
  currentStage: TimelineStage;
  entries: TimelineEntry[];
}

// ---------------------------------------------------------------------------
// Pemetaan status lamaran → tahap & status
// ---------------------------------------------------------------------------

/**
 * Status lamaran `application_status_enum` → (tahap yang ditandai, status).
 * `SUBMITTED` → APPLIED/PASSED; `SCREENING` → ATS_REVIEW/IN_PROGRESS;
 * `INTERVIEW` → INTERVIEW/IN_PROGRESS; `OFFERED`/`HIRED` → DECISION/PASSED;
 * `REJECTED` → tahap terakhir FAILED.
 */
function statusToStage(status: string): { stage: TimelineStage; state: TimelineStatus } {
  switch (status) {
    case 'SUBMITTED':
      return { stage: 'APPLIED', state: 'PASSED' };
    case 'SCREENING':
      return { stage: 'ATS_REVIEW', state: 'IN_PROGRESS' };
    case 'INTERVIEW':
      return { stage: 'INTERVIEW', state: 'IN_PROGRESS' };
    case 'OFFERED':
      return { stage: 'DECISION', state: 'IN_PROGRESS' };
    case 'HIRED':
      return { stage: 'DECISION', state: 'PASSED' };
    case 'REJECTED':
      return { stage: 'DECISION', state: 'FAILED' };
    default:
      return { stage: 'APPLIED', state: 'IN_PROGRESS' };
  }
}

/** Indeks tahap (untuk menentukan done/current/upcoming). */
function stageIndex(s: TimelineStage): number {
  return STAGE_ORDER.indexOf(s);
}

// ---------------------------------------------------------------------------
// Tulis: upsert satu tahap
// ---------------------------------------------------------------------------

export interface UpsertStageInput {
  applicationId: string;
  stage: TimelineStage;
  status: TimelineStatus;
  note?: string | null;
  actorUserId?: string | null;
}

/**
 * Buat atau perbarui catatan satu tahap. Idempoten lewat UNIQUE
 * (application_id, stage): baris yang ada hanya di-update bila status berubah.
 */
export async function upsertStage(db: Db, input: UpsertStageInput): Promise<void> {
  let changed = false;
  try {
    // Deteksi perubahan status agar notifikasi tidak dikirim berulang.
    const prev = (await db.execute(sql`
      SELECT status::text AS status FROM application_timeline
       WHERE application_id = ${input.applicationId}::uuid AND stage = ${input.stage}::timeline_stage_enum
    `)) as unknown as { rows: Array<{ status: string }> };
    const prevStatus = prev.rows?.[0]?.status ?? null;
    changed = prevStatus !== input.status;

    await db.execute(sql`
      INSERT INTO application_timeline (application_id, stage, status, note, actor_user_id)
      VALUES (${input.applicationId}::uuid, ${input.stage}::timeline_stage_enum,
              ${input.status}::timeline_status_enum, ${input.note ?? null}, ${input.actorUserId ?? null}::uuid)
      ON CONFLICT (application_id, stage)
      DO UPDATE SET status = EXCLUDED.status,
                    note = COALESCE(EXCLUDED.note, application_timeline.note),
                    actor_user_id = COALESCE(EXCLUDED.actor_user_id, application_timeline.actor_user_id)
    `);
  } catch (err) {
    console.warn('[timelineService] upsertStage gagal:', (err as Error)?.message);
  }

  // Notifikasi in-app + email saat tahap berubah (best-effort; tidak memblokir).
  if (changed && input.status !== 'PENDING') {
    try {
      const { notifyStageChange } = await import('@/lib/services/notificationService');
      await notifyStageChange(db, { applicationId: input.applicationId, stage: input.stage, status: input.status, note: input.note });
    } catch { /* notifikasi opsional */ }
  }
}

/**
 * Tandai semua tahap yang SECARA URUTAN berada sebelum `stage` sebagai PASSED
 * (bila belum ada catatan). Dipakai agar timeline tidak "bolong" saat status
 * melompat (mis. langsung INTERVIEW).
 */
async function backfillPreviousStages(
  db: Db,
  applicationId: string,
  stage: TimelineStage,
): Promise<void> {
  const idx = stageIndex(stage);
  for (let i = 0; i < idx; i++) {
    const s = STAGE_ORDER[i];
    try {
      await db.execute(sql`
        INSERT INTO application_timeline (application_id, stage, status)
        VALUES (${applicationId}::uuid, ${s}::timeline_stage_enum, 'PASSED'::timeline_status_enum)
        ON CONFLICT (application_id, stage) DO NOTHING
      `);
    } catch {
      /* best-effort */
    }
  }
}

// ---------------------------------------------------------------------------
// Sinkronisasi dari sumber data yang ada
// ---------------------------------------------------------------------------

/**
 * Sinkronkan timeline sebuah lamaran dari:
 *  - status lamaran `job_applications.status`
 *  - keberadaan `resume_parses` (→ ATS_REVIEW PASSED)
 *  - jadwal wawancara `interview_schedules` (→ INTERVIEW SCHEDULED / PASSED)
 *  - keputusan `candidate_decisions` (→ DECISION PASSED/FAILED)
 * Mengembalikan id lamaran + isPublic info (untuk validasi).
 */
export async function syncApplicationTimeline(db: Db, applicationId: string): Promise<void> {
  let appStatus = 'SUBMITTED';
  try {
    const r = (await db.execute(sql`
      SELECT status FROM job_applications WHERE id = ${applicationId}::uuid
    `)) as unknown as { rows: Array<{ status: string }> };
    appStatus = r.rows?.[0]?.status ?? 'SUBMITTED';
  } catch {
    return;
  }

  // 1) APPLIED selalu ada begitu lamaran masuk.
  await backfillPreviousStages(db, applicationId, statusToStage(appStatus).stage);
  const mapped = statusToStage(appStatus);
  await upsertStage(db, { applicationId, stage: 'APPLIED', status: 'PASSED' });

  // 2) ATS_REVIEW dari resume_parses.
  try {
    const rp = (await db.execute(sql`
      SELECT ats_score FROM resume_parses WHERE application_id = ${applicationId}::uuid
       ORDER BY created_at DESC LIMIT 1
    `)) as unknown as { rows: Array<{ ats_score: string | null }> };
    if (rp.rows.length > 0) {
      const score = rp.rows[0].ats_score != null ? Number(rp.rows[0].ats_score) : null;
      await upsertStage(db, {
        applicationId,
        stage: 'ATS_REVIEW',
        status: 'PASSED',
        note: score != null ? `Skor ATS: ${score.toFixed(0)}/100` : 'Berkas telah dianalisis.',
      });
    }
  } catch {
    /* abaikan */
  }

  // 3) INTERVIEW dari interview_schedules.
  try {
    const iv = (await db.execute(sql`
      SELECT status, scheduled_at, score FROM interview_schedules
       WHERE application_id = ${applicationId}::uuid ORDER BY scheduled_at DESC LIMIT 1
    `)) as unknown as { rows: Array<{ status: string; scheduled_at: string; score: string | null }> };
    if (iv.rows.length > 0) {
      const row = iv.rows[0];
      const status: TimelineStatus = row.status === 'DONE' ? 'PASSED' : row.status === 'CANCELED' ? 'SKIPPED' : 'SCHEDULED';
      await upsertStage(db, {
        applicationId,
        stage: 'INTERVIEW',
        status,
        note: row.scheduled_at ? `Dijadwalkan: ${new Date(row.scheduled_at).toISOString().slice(0, 10)}` : null,
      });
    }
  } catch {
    /* abaikan */
  }

  // 4) DECISION dari candidate_decisions.
  try {
    const dec = (await db.execute(sql`
      SELECT decision, final_score FROM candidate_decisions WHERE application_id = ${applicationId}::uuid
    `)) as unknown as { rows: Array<{ decision: string; final_score: string | null }> };
    if (dec.rows.length > 0) {
      const d = dec.rows[0].decision;
      const status: TimelineStatus = d === 'ACCEPTED' ? 'PASSED' : d === 'REJECTED' ? 'FAILED' : 'IN_PROGRESS';
      await upsertStage(db, { applicationId, stage: 'DECISION', status });
    }
  } catch {
    /* abaikan */
  }

  // 5) Status turunan terakhir (mis. HIRED/REJECTED tanpa keputusan eksplisit).
  await upsertStage(db, { applicationId, stage: mapped.stage, status: mapped.state });
}

// ---------------------------------------------------------------------------
// Baca: progress view
// ---------------------------------------------------------------------------

interface RawEntry {
  stage: TimelineStage;
  status: TimelineStatus;
  note: string | null;
  created_at: string | null;
}

/**
 * Susun view timeline untuk ditampilkan (stepper). Menghitung state tiap tahap:
 *  - FAILED bila ada entry berstatus FAILED (dan tahap terakhir).
 *  - DONE bila entry PASSED, atau bila tahap berada sebelum tahap "aktif".
 *  - CURRENT bila ini tahap aktif (tertinggi yang IN_PROGRESS/SCHEDULED, atau
 *    tahap PASSED terakhir bila semua di bawahnya selesai).
 *  - UPCOMING bila setelah tahap aktif.
 */
export function buildTimelineView(
  applicationNo: string,
  applicationStatus: string,
  postingTitle: string,
  candidateName: string,
  raw: RawEntry[],
): ApplicationTimelineView {
  const byStage = new Map<string, RawEntry>();
  for (const e of raw) byStage.set(e.stage, e);

  const failed = raw.some((e) => e.status === 'FAILED');
  // Tahap tertinggi yang punya progres.
  let highest = 0;
  raw.forEach((e) => {
    const i = stageIndex(e.stage);
    if (i > highest) highest = i;
  });

  const entries: TimelineEntry[] = STAGE_ORDER.map((stage, i) => {
    const e = byStage.get(stage);
    const status: TimelineStatus = e?.status ?? 'PENDING';
    let state: StageState;
    if (status === 'FAILED') state = 'FAILED';
    else if (status === 'SKIPPED') state = 'SKIPPED';
    else if (status === 'PASSED') state = i === highest && !failed ? 'CURRENT' : 'DONE';
    else if (status === 'IN_PROGRESS' || status === 'SCHEDULED') state = 'CURRENT';
    else state = i < highest ? 'DONE' : 'UPCOMING';
    return {
      stage,
      label: STAGE_LABEL[stage],
      status,
      state,
      note: e?.note ?? null,
      at: e?.created_at ?? null,
    };
  });

  const overallState: ApplicationTimelineView['overallState'] =
    applicationStatus === 'HIRED' ? 'ACCEPTED'
    : applicationStatus === 'REJECTED' ? 'REJECTED'
    : 'IN_PROGRESS';

  const currentStage = entries.find((en) => en.state === 'CURRENT')?.stage
    ?? (failed ? 'DECISION' : STAGE_ORDER[Math.min(highest, STAGE_ORDER.length - 1)]);

  return {
    applicationNo,
    applicationStatus,
    postingTitle,
    candidateName,
    overallState,
    currentStage,
    entries,
  };
}

/**
 * Ambil & sinkronkan timeline sebuah lamaran berdasarkan nomor lamaran.
 * Mengembalikan null bila nomor tidak ditemukan.
 */
export async function getTimelineByApplicationNo(
  db: Db,
  applicationNo: string,
): Promise<ApplicationTimelineView | null> {
  const app = (await db.execute(sql`
    SELECT ja.id, ja.application_no AS "applicationNo", ja.status,
           jp.posting_title AS "postingTitle", c.full_name AS "candidateName"
      FROM job_applications ja
      JOIN job_postings jp ON jp.id = ja.job_posting_id
      JOIN candidates c ON c.id = ja.candidate_id
     WHERE ja.application_no = ${applicationNo}
  `)) as unknown as { rows: Array<{ id: string; applicationNo: string; status: string; postingTitle: string; candidateName: string }> };

  const row = app.rows?.[0];
  if (!row) return null;

  // Sinkronkan agar timeline selalu segar, lalu baca.
  await syncApplicationTimeline(db, row.id);

  const entries = (await db.execute(sql`
    SELECT stage, status, note, created_at AS "created_at"
      FROM application_timeline WHERE application_id = ${row.id}::uuid
  `)) as unknown as { rows: RawEntry[] };

  return buildTimelineView(
    row.applicationNo,
    row.status,
    row.postingTitle,
    row.candidateName,
    entries.rows ?? [],
  );
}
