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

/** Menerima lamaran kandidat eksternal (publik): buat kandidat + lamaran. */
export async function submitApplication(db: Db, input: ApplicationInput) {
  const cand = (await db.execute(sql`
    INSERT INTO candidates (full_name, email, phone, address, birth_date, education, resume_url)
    VALUES (${input.fullName}, ${input.email}, ${input.phone ?? null}, ${input.address ?? null},
            ${input.birthDate ?? null}::date, ${input.education ?? null}, ${input.resumeUrl ?? null})
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  const candidateId = cand.rows[0].id;
  const appNo = applicationNo(input.email, input.jobPostingId);

  await db.execute(sql`
    INSERT INTO job_applications (application_no, candidate_id, job_posting_id, cover_letter, status)
    VALUES (${appNo}, ${candidateId}::uuid, ${input.jobPostingId}::uuid, ${input.coverLetter ?? null}, 'SUBMITTED')
    ON CONFLICT (application_no) DO NOTHING
  `);
  return { applicationNo: appNo, status: 'SUBMITTED' as const };
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

/** Ubah status lamaran (HR). */
export async function updateApplicationStatus(db: Db, applicationId: string, status: string) {
  const res = (await db.execute(sql`
    UPDATE job_applications SET status = ${status}::application_status_enum
     WHERE id = ${applicationId}::uuid
     RETURNING id, application_no AS "applicationNo", status
  `)) as unknown as { rows: any[] };
  return res.rows[0] ?? null;
}
