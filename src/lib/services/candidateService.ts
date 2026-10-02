import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export interface PublicPosting {
  id: string;
  postingTitle: string;
  description: string;
  requiredSkills: unknown;
  department: string;
  position: string;
}

export interface ApplicationInput {
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  birthDate?: string;
  education?: string;
  resumeUrl?: string;
  coverLetter?: string;
  jobPostingId: string;
  /** Akun kandidat yang login (bila ada) — dihubungkan ke baris `candidates`. */
  accountId?: string | null;
}

function applicationNo(email: string, postingId: string): string {
  let h = 0;
  const seed = `${email}-${postingId}`;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const short = Math.abs(h).toString(36).toUpperCase().padStart(5, '0').slice(0, 5);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `APP-${date}-${short}`;
}

/** Lowongan publik (tampil tanpa login). */
export async function listPublicPostings(db: Db): Promise<PublicPosting[]> {
  const res = (await db.execute(sql`
    SELECT jp.id, jp.posting_title AS "postingTitle", jp.description,
           jp.required_skills AS "requiredSkills",
           d.department_name AS "department", p.position_title AS "position"
      FROM job_postings jp
      JOIN departments d ON d.id = jp.department_id
      JOIN job_positions p ON p.id = jp.position_id
     WHERE jp.is_public = TRUE AND jp.status = 'OPEN'
     ORDER BY jp.posted_at DESC
  `)) as unknown as { rows: PublicPosting[] };
  return res.rows ?? [];
}

/** Lowongan untuk portal kandidat: kualifikasi + kuota (MPP − terisi) + status real-time. */
export interface CandidatePosting {
  id: string;
  postingTitle: string;
  description: string;
  requiredSkills: unknown;
  department: string;
  position: string;
  status: string;            // OPEN | FILLED | CLOSED | DRAFT
  quota: number;             // approved_quota
  hired: number;             // jumlah diterima (hired_count + lamaran ACCEPTED/HIRED)
  remaining: number;         // kuota − terisi (>=0)
  availability: 'AVAILABLE' | 'FILLED' | 'CLOSED';
  postedAt: string | null;
}

export async function listCandidatePostings(db: Db, opts: { search?: string; department?: string } = {}): Promise<CandidatePosting[]> {
  const res = (await db.execute(sql`
    SELECT jp.id, jp.posting_title AS "postingTitle", jp.description,
           jp.required_skills AS "requiredSkills",
           jp.status, jp.posted_at AS "postedAt",
           d.department_name AS "department", p.position_title AS "position",
           COALESCE(mp.approved_quota, 0) AS "quota",
           COALESCE(mp.hired_count, 0) + COALESCE(hired.accepted, 0) AS "hired"
      FROM job_postings jp
      JOIN departments d ON d.id = jp.department_id
      JOIN job_positions p ON p.id = jp.position_id
      LEFT JOIN manpower_plans mp ON mp.id = jp.manpower_plan_id
      LEFT JOIN (
        SELECT job_posting_id, COUNT(*) FILTER (WHERE status IN ('HIRED','OFFERED')) AS accepted
          FROM job_applications GROUP BY job_posting_id
      ) hired ON hired.job_posting_id = jp.id
     WHERE jp.is_public = TRUE
       AND (${opts.department ?? null}::text IS NULL OR d.department_name = ${opts.department ?? null})
       AND (${opts.search ?? null}::text IS NULL
            OR jp.posting_title ILIKE '%' || ${opts.search ?? null} || '%'
            OR d.department_name ILIKE '%' || ${opts.search ?? null} || '%')
     ORDER BY (jp.status = 'OPEN') DESC, jp.posted_at DESC
  `)) as unknown as { rows: any[] };

  return (res.rows ?? []).map((r) => {
    const quota = Number(r.quota) || 0;
    const hired = Number(r.hired) || 0;
    const remaining = Math.max(0, quota - hired);
    let availability: CandidatePosting['availability'] = 'AVAILABLE';
    if (r.status === 'CLOSED') availability = 'CLOSED';
    else if (r.status === 'FILLED' || (quota > 0 && remaining <= 0)) availability = 'FILLED';
    return {
      id: r.id,
      postingTitle: r.postingTitle,
      description: r.description,
      requiredSkills: r.requiredSkills,
      department: r.department,
      position: r.position,
      status: r.status,
      quota,
      hired,
      remaining,
      availability,
      postedAt: r.postedAt ?? null,
    };
  });
}

/** Menerima lamaran kandidat eksternal (publik): buat kandidat + lamaran. */
export async function submitApplication(db: Db, input: ApplicationInput) {
  const cand = (await db.execute(sql`
    INSERT INTO candidates (full_name, email, phone, address, birth_date, education, resume_url, account_id, source)
    VALUES (${input.fullName}, ${input.email}, ${input.phone ?? null}, ${input.address ?? null},
            ${input.birthDate ?? null}::date, ${input.education ?? null}, ${input.resumeUrl ?? null},
            ${input.accountId ?? null}::uuid, 'PUBLIC_PORTAL')
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  const candidateId = cand.rows[0].id;
  const appNo = applicationNo(input.email, input.jobPostingId);

  const app = (await db.execute(sql`
    INSERT INTO job_applications (application_no, candidate_id, job_posting_id, cover_letter, status)
    VALUES (${appNo}, ${candidateId}::uuid, ${input.jobPostingId}::uuid, ${input.coverLetter ?? null}, 'SUBMITTED')
    ON CONFLICT (application_no) DO UPDATE SET cover_letter = EXCLUDED.cover_letter
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  const applicationId = app.rows[0]?.id ?? null;

  // Timeline: tandai tahap APPLIED (idempoten) agar progres kandidat tercatat.
  if (applicationId) {
    try {
      const { upsertStage } = await import('@/lib/services/timelineService');
      await upsertStage(db, { applicationId, stage: 'APPLIED', status: 'PASSED' });
    } catch {
      /* timeline opsional; jangan gagalkan pengiriman lamaran */
    }
  }

  return {
    applicationNo: appNo,
    applicationId,
    candidateId,
    status: 'SUBMITTED' as const,
  };
}

/** Status lamaran berdasarkan nomor (publik). */
export async function getApplicationStatus(db: Db, appNo: string) {
  const res = (await db.execute(sql`
    SELECT ja.application_no AS "applicationNo", ja.status, jp.posting_title AS "postingTitle",
           ja.applied_at AS "appliedAt"
      FROM job_applications ja JOIN job_postings jp ON jp.id = ja.job_posting_id
     WHERE ja.application_no = ${appNo}
  `)) as unknown as { rows: any[] };
  return res.rows[0] ?? null;
}

/** Daftar lamaran untuk HR. */
export async function listCandidates(db: Db) {
  const res = (await db.execute(sql`
    SELECT ja.id, ja.application_no AS "applicationNo", ja.status, ja.applied_at AS "appliedAt",
           c.full_name AS "fullName", c.email, c.education, c.resume_url AS "resumeUrl",
           jp.posting_title AS "postingTitle"
      FROM job_applications ja
      JOIN candidates c ON c.id = ja.candidate_id
      JOIN job_postings jp ON jp.id = ja.job_posting_id
     ORDER BY ja.applied_at DESC
  `)) as unknown as { rows: any[] };
  return res.rows ?? [];
}

/** Ubah status lamaran (HR) + sinkronkan timeline. */
export async function updateApplicationStatus(db: Db, applicationId: string, status: string) {
  const res = (await db.execute(sql`
    UPDATE job_applications SET status = ${status}::application_status_enum
     WHERE id = ${applicationId}::uuid
     RETURNING id, application_no AS "applicationNo", status
  `)) as unknown as { rows: any[] };
  const row = res.rows[0] ?? null;
  if (row) {
    try {
      const { syncApplicationTimeline } = await import('@/lib/services/timelineService');
      await syncApplicationTimeline(db, applicationId);
    } catch {
      /* timeline opsional */
    }
  }
  return row;
}
