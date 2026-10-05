import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export interface PublicPosting {
  id: string;
  postingTitle: string;
  description: string;
  requiredSkills: unknown;
  department: string;
  position: string;
  minEducation: string | null;
  minExperienceYears: number | null;
  workLocation: string | null;
  employmentType: string | null;
  quota: number;
  hired: number;
  remaining: number;
  availability: 'AVAILABLE' | 'FILLED' | 'CLOSED';
  postedAt: string | null;
}

export interface EducationInput {
  level?: string | null;          // SD|SMP|SMA/SMK|D3|D4|S1|S2
  institution?: string | null;
  institutionCode?: string | null;
  degree?: string | null;
  major?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  graduationStatus?: string | null;
  gpa?: number | null;
}

export interface ExperienceInput {
  experienceType?: string | null; // MAGANG|KERJA
  roleTitle?: string | null;
  company?: string | null;
  location?: string | null;
  startMonth?: number | null;
  startYear?: number | null;
  endMonth?: number | null;
  endYear?: number | null;
  isCurrent?: boolean | null;
  description?: string | null;
}

export interface CertificationInput {
  kind?: string | null;           // CERTIFICATION|AWARD
  name: string;
  issuer?: string | null;
  issuedDate?: string | null;
  expiryDate?: string | null;
  credentialId?: string | null;
  proofUrl?: string | null;
}

export interface DocumentInput {
  docType: string;                // CV|COVER_LETTER|CERTIFICATE|OTHER
  fileName?: string | null;
  mimeType?: string | null;
  fileUrl: string;                // data URL / tautan
}

export interface ApplicationInput {
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  birthDate?: string;
  gender?: string;
  nik?: string;
  education?: string;
  resumeUrl?: string;
  coverLetter?: string;
  jobPostingId: string;
  /** Akun kandidat yang login (bila ada) — dihubungkan ke baris `candidates`. */
  accountId?: string | null;
  educations?: EducationInput[];
  experiences?: ExperienceInput[];
  /** Penanda khusus: kandidat menyatakan tidak punya pengalaman kerja. */
  noExperience?: boolean;
  certifications?: CertificationInput[];
  documents?: DocumentInput[];
}

function applicationNo(email: string, postingId: string): string {
  let h = 0;
  const seed = `${email}-${postingId}`;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const short = Math.abs(h).toString(36).toUpperCase().padStart(5, '0').slice(0, 5);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `APP-${date}-${short}`;
}

/** Lowongan publik (tampil tanpa login) — lengkap dengan kualifikasi & kuota. */
export async function listPublicPostings(db: Db): Promise<PublicPosting[]> {
  const res = (await db.execute(sql`
    SELECT jp.id, jp.posting_title AS "postingTitle", jp.description,
           jp.required_skills AS "requiredSkills", jp.status, jp.posted_at AS "postedAt",
           jp.min_education AS "minEducation", jp.min_experience_years::float8 AS "minExperienceYears",
           jp.work_location AS "workLocation", jp.employment_type AS "employmentType",
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
     ORDER BY (jp.status = 'OPEN') DESC, jp.posted_at DESC
  `)) as unknown as { rows: any[] };

  return (res.rows ?? []).map((r) => {
    const quota = Number(r.quota) || 0;
    const hired = Number(r.hired) || 0;
    const remaining = Math.max(0, quota - hired);
    let availability: PublicPosting['availability'] = 'AVAILABLE';
    if (r.status === 'CLOSED') availability = 'CLOSED';
    else if (r.status === 'FILLED' || (quota > 0 && remaining <= 0)) availability = 'FILLED';
    return {
      id: r.id,
      postingTitle: r.postingTitle,
      description: r.description,
      requiredSkills: r.requiredSkills,
      department: r.department,
      position: r.position,
      minEducation: r.minEducation ?? null,
      minExperienceYears: r.minExperienceYears != null ? Number(r.minExperienceYears) : null,
      workLocation: r.workLocation ?? null,
      employmentType: r.employmentType ?? null,
      quota, hired, remaining, availability,
      postedAt: r.postedAt ?? null,
    };
  });
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

/** Menerima lamaran kandidat eksternal (publik): buat kandidat + lamaran + data terkait. */
export async function submitApplication(db: Db, input: ApplicationInput) {
  const cand = (await db.execute(sql`
    INSERT INTO candidates (full_name, email, phone, address, birth_date, gender, nik, education, resume_url, account_id, source)
    VALUES (${input.fullName}, ${input.email}, ${input.phone ?? null}, ${input.address ?? null},
            ${input.birthDate ?? null}::date, ${input.gender ?? null}, ${input.nik ?? null},
            ${input.education ?? null}, ${input.resumeUrl ?? null},
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

  // Data terkait: pendidikan, pengalaman kerja, sertifikasi, berkas.
  await saveRelatedData(db, candidateId, applicationId, input);

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

/** Simpan data terkait lamaran: pendidikan, pengalaman, sertifikasi, berkas. */
async function saveRelatedData(
  db: Db,
  candidateId: string,
  applicationId: string | null,
  input: ApplicationInput,
): Promise<void> {
  // Pendidikan
  for (const e of input.educations ?? []) {
    if (!e.institution && !e.major && !e.level) continue;
    try {
      await db.execute(sql`
        INSERT INTO candidate_educations
          (candidate_id, level, institution, institution_code, degree, major, start_year, end_year, graduation_status, gpa)
        VALUES (${candidateId}::uuid, ${e.level ?? null}, ${e.institution ?? null}, ${e.institutionCode ?? null},
                ${e.degree ?? null}, ${e.major ?? null}, ${e.startYear ?? null}, ${e.endYear ?? null},
                ${e.graduationStatus ?? 'LULUS'}, ${e.gpa ?? null})
      `);
    } catch { /* lanjut */ }
  }

  // Pengalaman kerja / magang (kecuali ditandai "tidak punya pengalaman")
  if (!input.noExperience) {
    for (const x of input.experiences ?? []) {
      if (!x.roleTitle && !x.company) continue;
      try {
        await db.execute(sql`
          INSERT INTO candidate_experiences
            (candidate_id, experience_type, role_title, company, location,
             start_month, start_year, end_month, end_year, is_current, description)
          VALUES (${candidateId}::uuid, ${x.experienceType ?? 'KERJA'}, ${x.roleTitle ?? null}, ${x.company ?? null},
                  ${x.location ?? null}, ${x.startMonth ?? null}, ${x.startYear ?? null},
                  ${x.endMonth ?? null}, ${x.endYear ?? null}, ${x.isCurrent ?? false}, ${x.description ?? null})
        `);
      } catch { /* lanjut */ }
    }
  }

  // Sertifikasi / penghargaan
  for (const c of input.certifications ?? []) {
    if (!c.name) continue;
    try {
      await db.execute(sql`
        INSERT INTO candidate_certifications
          (candidate_id, kind, name, issuer, issued_date, expiry_date, credential_id, proof_url)
        VALUES (${candidateId}::uuid, ${c.kind ?? 'CERTIFICATION'}, ${c.name}, ${c.issuer ?? null},
                ${c.issuedDate ?? null}::date, ${c.expiryDate ?? null}::date, ${c.credentialId ?? null}, ${c.proofUrl ?? null})
      `);
    } catch { /* lanjut */ }
  }

  // Berkas lamaran (CV, surat lamaran, dsb.)
  for (const d of input.documents ?? []) {
    if (!d.fileUrl) continue;
    try {
      await db.execute(sql`
        INSERT INTO candidate_documents (candidate_id, application_id, doc_type, file_name, mime_type, file_url)
        VALUES (${candidateId}::uuid, ${applicationId ?? null}::uuid, ${d.docType},
                ${d.fileName ?? null}, ${d.mimeType ?? null}, ${d.fileUrl})
      `);
    } catch { /* lanjut */ }
  }
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

/** Detail lengkap pelamar untuk HR (profil + pendidikan + pengalaman + sertifikasi + berkas). */
export async function getApplicationDetail(db: Db, applicationId: string) {
  const app = (await db.execute(sql`
    SELECT ja.id AS "applicationId", ja.application_no AS "applicationNo", ja.status AS "applicationStatus",
           ja.applied_at AS "appliedAt", ja.candidate_id AS "candidateId",
           c.full_name AS "fullName", c.email, c.phone, c.address, c.birth_date::text AS "birthDate",
           c.gender, c.nik, c.education, c.summary, c.linkedin_url AS "linkedinUrl", c.resume_url AS "resumeUrl",
           jp.posting_title AS "postingTitle"
      FROM job_applications ja
      JOIN candidates c ON c.id = ja.candidate_id
      JOIN job_postings jp ON jp.id = ja.job_posting_id
     WHERE ja.id = ${applicationId}::uuid
  `)) as unknown as { rows: any[] };
  const row = app.rows?.[0];
  if (!row) return null;
  const candidateId = row.candidateId;

  const educations = (await db.execute(sql`
    SELECT id, level, institution, institution_code AS "institutionCode", degree, major,
           start_year AS "startYear", end_year AS "endYear", graduation_status AS "graduationStatus", gpa::float8 AS gpa
      FROM candidate_educations WHERE candidate_id = ${candidateId}::uuid ORDER BY end_year DESC NULLS LAST
  `)) as unknown as { rows: any[] };

  const experiences = (await db.execute(sql`
    SELECT id, experience_type AS "experienceType", role_title AS "roleTitle", company, location,
           start_month AS "startMonth", start_year AS "startYear", end_month AS "endMonth",
           end_year AS "endYear", is_current AS "isCurrent", description
      FROM candidate_experiences WHERE candidate_id = ${candidateId}::uuid ORDER BY start_year DESC NULLS LAST
  `)) as unknown as { rows: any[] };

  const certifications = (await db.execute(sql`
    SELECT id, kind, name, issuer, issued_date::text AS "issuedDate", expiry_date::text AS "expiryDate",
           credential_id AS "credentialId", proof_url AS "proofUrl"
      FROM candidate_certifications WHERE candidate_id = ${candidateId}::uuid ORDER BY issued_date DESC NULLS LAST
  `)) as unknown as { rows: any[] };

  const documents = (await db.execute(sql`
    SELECT id, doc_type AS "docType", file_name AS "fileName", mime_type AS "mimeType", file_url AS "fileUrl", created_at AS "createdAt"
      FROM candidate_documents WHERE candidate_id = ${candidateId}::uuid ORDER BY created_at
  `)) as unknown as { rows: any[] };

  const skills = (await db.execute(sql`
    SELECT skill_name AS "skillName" FROM candidate_skills WHERE candidate_id = ${candidateId}::uuid LIMIT 40
  `)) as unknown as { rows: any[] };

  return {
    ...row,
    educations: educations.rows ?? [],
    experiences: experiences.rows ?? [],
    certifications: certifications.rows ?? [],
    documents: documents.rows ?? [],
    skills: (skills.rows ?? []).map((s) => s.skillName),
  };
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
  // Status sebelumnya untuk deteksi notifikasi (bila tahap timeline tak berubah).
  const prevRes = (await db.execute(sql`
    SELECT status::text AS status FROM job_applications WHERE id = ${applicationId}::uuid
  `)) as unknown as { rows: Array<{ status: string }> };
  const prevStatus = prevRes.rows?.[0]?.status ?? null;

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

    // `syncApplicationTimeline`→`upsertStage` hanya mengirim notifikasi saat
    // (stage,state) timeline berubah. Bila status berubah tetapi pemetaannya sama,
    // kirim notifikasi eksplisit agar tiap transisi tetap memberitahu kandidat.
    if (prevStatus && prevStatus !== status && sameTimelineMapping(prevStatus, status)) {
      try {
        const { notifyApplicationStatus } = await import('@/lib/services/notificationService');
        await notifyApplicationStatus(db, { applicationId, status });
      } catch { /* notifikasi best-effort */ }
    }
  }
  return row;
}

/** (stage,state) timeline untuk sebuah status lamaran (selaras timelineService). */
function statusToStageMapping(status: string): string {
  switch (status) {
    case 'SUBMITTED': return 'APPLIED:PASSED';
    case 'SCREENING': return 'ATS_REVIEW:IN_PROGRESS';
    case 'INTERVIEW': return 'INTERVIEW:IN_PROGRESS';
    case 'OFFERED': return 'DECISION:IN_PROGRESS';
    case 'HIRED': return 'DECISION:PASSED';
    case 'REJECTED': return 'DECISION:FAILED';
    default: return 'APPLIED:IN_PROGRESS';
  }
}

function sameTimelineMapping(a: string, b: string): boolean {
  return statusToStageMapping(a) === statusToStageMapping(b);
}
