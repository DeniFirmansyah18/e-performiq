import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError, NotFoundError } from '@/lib/auth/errors';

/**
 * Kotak 3 — Job Board & Mobilitas Internal (P1).
 *
 * Screening CV deterministik: pencocokan eksak tanpa bobot,
 * sehingga tidak ada false positive kemiripan teks ('Java' != 'JavaScript').
 */
export function screenCvAgainstPosting(
  cvSkills: string[],
  requiredSkills: string[]
): { score: number; summary: string } {
  if (requiredSkills.length === 0) {
    return { score: 0, summary: 'Kriteria kompetensi lowongan belum ditetapkan.' };
  }
  const cv = new Set(cvSkills.map((s) => s.trim().toLowerCase()));
  const matched = requiredSkills.filter((s) => cv.has(s.trim().toLowerCase()));
  const score = Math.round((matched.length / requiredSkills.length) * 100);
  const missing = requiredSkills.filter((s) => !cv.has(s.trim().toLowerCase()));
  const summary =
    missing.length === 0
      ? `Seluruh ${requiredSkills.length} kompetensi wajib terpenuhi.`
      : `Kecocokan ${matched.length}/${requiredSkills.length}. Kekurangan: ${missing.join(', ')}.`;
  return { score, summary };
}

export interface JobPostingItem {
  id: string;
  postingTitle: string;
  description: string;
  requiredSkills: string[];
  status: string;
  postedAt: string;
  positionTitle: string;
  departmentName: string;
  approvedQuota: number;
  hiredCount: number;
}

export async function listOpenPostings(db: Db): Promise<JobPostingItem[]> {
  const res = await db.execute(sql`
    SELECT jp.id,
           jp.posting_title AS "postingTitle",
           jp.description,
           jp.required_skills AS "requiredSkills",
           jp.status,
           jp.posted_at AS "postedAt",
           pos.position_title AS "positionTitle",
           d.department_name AS "departmentName",
           COALESCE(jp.quota, mp.approved_quota) AS "approvedQuota",
           COALESCE(mp.hired_count, 0) AS "hiredCount"
      FROM job_postings jp
      JOIN job_positions pos ON pos.id = jp.position_id
      JOIN departments d ON d.id = jp.department_id
      JOIN manpower_plans mp ON mp.id = jp.manpower_plan_id
     WHERE jp.status = 'OPEN'
     ORDER BY jp.posted_at DESC
  `);
  return (res.rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    postingTitle: String(r.postingTitle),
    description: String(r.description),
    requiredSkills: Array.isArray(r.requiredSkills)
      ? (r.requiredSkills as unknown[]).map(String)
      : [],
    status: String(r.status),
    postedAt: String(r.postedAt),
    positionTitle: String(r.positionTitle),
    departmentName: String(r.departmentName),
    approvedQuota: Number(r.approvedQuota),
    hiredCount: Number(r.hiredCount),
  }));
}

export interface ApplicationResult {
  id: string;
  jobPostingId: string;
  applicantEmployeeId: string;
  coverLetter: string;
  cvUrl: string;
  screeningScore: number;
  screeningSummary: string;
  status: string;
  createdAt: string;
}

/** Karyawan melamar lowongan internal; skor screening dihitung saat submit. */
export async function applyToPosting(
  db: Db,
  employeeId: string,
  jobPostingId: string,
  coverLetter: string,
  cvUrl: string
): Promise<ApplicationResult> {
  const posting = await db.execute(sql`
    SELECT id, status, required_skills AS "requiredSkills"
      FROM job_postings
     WHERE id = ${jobPostingId}::uuid
  `);
  if (posting.rows.length === 0) {
    throw new NotFoundError('Lowongan tidak ditemukan.');
  }
  const p = posting.rows[0] as { status: string; requiredSkills: unknown };

  if (p.status !== 'OPEN') {
    throw new BusinessRuleError('Lowongan sudah tidak menerima lamaran.');
  }

  const dup = await db.execute(sql`
    SELECT id FROM internal_applications
     WHERE job_posting_id = ${jobPostingId}::uuid
       AND applicant_employee_id = ${employeeId}::uuid
  `);
  if (dup.rows.length > 0) {
    throw new BusinessRuleError('Anda sudah melamar lowongan ini.');
  }

  const skills = await db.execute(sql`
    SELECT DISTINCT skill_name AS "skillName"
      FROM competency_scores
     WHERE employee_id = ${employeeId}::uuid
  `);
  const cvSkills = (skills.rows as Array<{ skillName: string }>).map(
    (r) => r.skillName
  );
  const requiredSkills = Array.isArray(p.requiredSkills)
    ? (p.requiredSkills as unknown[]).map(String)
    : [];
  const { score, summary } = screenCvAgainstPosting(cvSkills, requiredSkills);

  const ins = await db.execute(sql`
    INSERT INTO internal_applications
      (job_posting_id, applicant_employee_id, cover_letter, cv_url,
       screening_score, screening_summary, status)
    VALUES
      (${jobPostingId}::uuid, ${employeeId}::uuid, ${coverLetter}, ${cvUrl},
       ${score}, ${summary}, 'SUBMITTED')
    RETURNING id,
              job_posting_id AS "jobPostingId",
              applicant_employee_id AS "applicantEmployeeId",
              cover_letter AS "coverLetter",
              cv_url AS "cvUrl",
              screening_score AS "screeningScore",
              screening_summary AS "screeningSummary",
              status,
              created_at AS "createdAt"
  `);
  const row = ins.rows[0] as Record<string, unknown>;
  return {
    id: String(row.id),
    jobPostingId: String(row.jobPostingId),
    applicantEmployeeId: String(row.applicantEmployeeId),
    coverLetter: String(row.coverLetter),
    cvUrl: String(row.cvUrl),
    screeningScore: Number(row.screeningScore),
    screeningSummary: String(row.screeningSummary),
    status: String(row.status),
    createdAt: String(row.createdAt),
  };
}

async function getApplicationWithQuota(db: Db, applicationId: string) {
  const res = await db.execute(sql`
    SELECT ia.id,
           ia.status,
           mp.id AS "manpowerPlanId",
           COALESCE(jp.quota, mp.approved_quota) AS "approvedQuota",
           COALESCE(mp.hired_count, 0) AS "hiredCount"
      FROM internal_applications ia
      JOIN job_postings jp ON jp.id = ia.job_posting_id
      JOIN manpower_plans mp ON mp.id = jp.manpower_plan_id
     WHERE ia.id = ${applicationId}::uuid
  `);
  if (res.rows.length === 0) {
    throw new NotFoundError('Lamaran tidak ditemukan.');
  }
  return res.rows[0] as {
    id: string;
    status: string;
    manpowerPlanId: string;
    approvedQuota: number;
    hiredCount: number;
  };
}

const APPROVABLE = ['SUBMITTED', 'SHORTLISTED', 'INTERVIEW'];

async function stampReview(
  db: Db,
  applicationId: string,
  status: string,
  reviewerUserId: string | null
): Promise<void> {
  if (reviewerUserId) {
    await db.execute(sql`
      UPDATE internal_applications
         SET status = ${status},
             reviewed_by = ${reviewerUserId}::uuid,
             reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ${applicationId}::uuid
    `);
  } else {
    await db.execute(sql`
      UPDATE internal_applications
         SET status = ${status},
             reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ${applicationId}::uuid
    `);
  }
}

/**
 * Menyetujui lamaran. Menolak dengan BusinessRuleError bila
 * hired_count >= approved_quota (pesan ditampilkan apa adanya oleh UI).
 */
export async function approveApplication(
  db: Db,
  applicationId: string,
  reviewerUserId: string | null = null
): Promise<{ applicationId: string; status: string }> {
  const app = await getApplicationWithQuota(db, applicationId);

  if (!APPROVABLE.includes(app.status)) {
    throw new BusinessRuleError(
      `Lamaran berstatus ${app.status} tidak dapat disetujui.`
    );
  }
  if (Number(app.hiredCount) >= Number(app.approvedQuota)) {
    throw new BusinessRuleError(
      'Kuota formasi telah tercapai. Pengesahan ditolak sesuai rencana Manpower Planning.'
    );
  }

  await stampReview(db, applicationId, 'OFFERED', reviewerUserId);
  await db.execute(sql`
    UPDATE manpower_plans
       SET hired_count = hired_count + 1
     WHERE id = ${app.manpowerPlanId}::uuid
  `);
  return { applicationId, status: 'OFFERED' };
}

/** Menolak lamaran; tidak menyentuh kuota manpower plan. */
export async function rejectApplication(
  db: Db,
  applicationId: string,
  reviewerUserId: string | null = null
): Promise<{ applicationId: string; status: string }> {
  const app = await getApplicationWithQuota(db, applicationId);

  if (!APPROVABLE.includes(app.status)) {
    throw new BusinessRuleError(
      `Lamaran berstatus ${app.status} tidak dapat ditolak.`
    );
  }

  await stampReview(db, applicationId, 'REJECTED', reviewerUserId);
  return { applicationId, status: 'REJECTED' };
}

export interface ReviewItem {
  id: string;
  status: string;
  screeningScore: number;
  screeningSummary: string;
  coverLetter: string;
  createdAt: string;
  applicantName: string;
  postingTitle: string;
}

/** Daftar lamaran menunggu peninjauan untuk Manager Cockpit. */
export async function listApplicationsForReview(db: Db): Promise<ReviewItem[]> {
  const res = await db.execute(sql`
    SELECT ia.id,
           ia.status,
           ia.screening_score AS "screeningScore",
           ia.screening_summary AS "screeningSummary",
           ia.cover_letter AS "coverLetter",
           ia.created_at AS "createdAt",
           e.full_name AS "applicantName",
           jp.posting_title AS "postingTitle"
      FROM internal_applications ia
      JOIN employees e ON e.id = ia.applicant_employee_id
      JOIN job_postings jp ON jp.id = ia.job_posting_id
     WHERE ia.status IN ('SUBMITTED', 'SHORTLISTED', 'INTERVIEW')
     ORDER BY ia.created_at DESC
  `);
  return (res.rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    status: String(r.status),
    screeningScore: Number(r.screeningScore),
    screeningSummary: String(r.screeningSummary),
    coverLetter: String(r.coverLetter),
    createdAt: String(r.createdAt),
    applicantName: String(r.applicantName),
    postingTitle: String(r.postingTitle),
  }));
}

export interface InterviewSlotItem {
  id: string;
  jobPostingId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  isAvailable: boolean;
}

export async function listInterviewSlots(
  db: Db,
  jobPostingId: string
): Promise<InterviewSlotItem[]> {
  const res = await db.execute(sql`
    SELECT id,
           job_posting_id AS "jobPostingId",
           scheduled_date AS "scheduledDate",
           start_time AS "startTime",
           end_time AS "endTime",
           capacity,
           booked_count AS "bookedCount",
           is_available AS "isAvailable"
      FROM interview_slots
     WHERE job_posting_id = ${jobPostingId}::uuid
     ORDER BY scheduled_date, start_time
  `);
  return (res.rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    jobPostingId: String(r.jobPostingId),
    scheduledDate: String(r.scheduledDate),
    startTime: String(r.startTime),
    endTime: String(r.endTime),
    capacity: Number(r.capacity),
    bookedCount: Number(r.bookedCount),
    isAvailable: Boolean(r.isAvailable),
  }));
}

/** Memesan slot wawancara; menolak bila booked_count >= capacity. */
export async function bookInterviewSlot(
  db: Db,
  slotId: string
): Promise<{ id: string; bookedCount: number; capacity: number; isAvailable: boolean }> {
  const cur = await db.execute(sql`
    SELECT id, capacity, booked_count AS "bookedCount"
      FROM interview_slots
     WHERE id = ${slotId}::uuid
  `);
  if (cur.rows.length === 0) {
    throw new NotFoundError('Slot wawancara tidak ditemukan.');
  }
  const row = cur.rows[0] as { capacity: number; bookedCount: number };
  if (Number(row.bookedCount) >= Number(row.capacity)) {
    throw new BusinessRuleError('Slot wawancara sudah penuh.');
  }

  const upd = await db.execute(sql`
    UPDATE interview_slots
       SET booked_count = booked_count + 1,
           is_available = (booked_count + 1 < capacity)
     WHERE id = ${slotId}::uuid
    RETURNING id,
              booked_count AS "bookedCount",
              capacity,
              is_available AS "isAvailable"
  `);
  const u = upd.rows[0] as Record<string, unknown>;
  return {
    id: String(u.id),
    bookedCount: Number(u.bookedCount),
    capacity: Number(u.capacity),
    isAvailable: Boolean(u.isAvailable),
  };
}
