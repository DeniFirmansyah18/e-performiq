/**
 * Resolver konteks lamaran kandidat (dipakai route asesmen kandidat).
 *
 * Kandidat hanya boleh mengakses asesmen milik lamarannya sendiri: kita
 * memverifikasi bahwa lamaran tersebut milik `candidates.account_id` dari sesi.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { CandidateSessionPayload } from '@/lib/auth/candidateSession';

export interface CandidateContext {
  applicationId: string;
  candidateId: string;
  applicationNo: string;
  postingTitle: string;
}

/**
 * Ambil konteks lamaran kandidat dari sesi.
 *  - Bila `applicationId` diberikan → verifikasi kepemilikan.
 *  - Bila tidak → ambil lamaran terbaru milik akun ini.
 * Mengembalikan null bila tidak ada / tidak berhak.
 */
export async function resolveCandidateContext(
  db: Db,
  session: CandidateSessionPayload,
  applicationId?: string,
): Promise<CandidateContext | null> {
  const res = (await db.execute(sql`
    SELECT ja.id AS "applicationId", ja.candidate_id AS "candidateId",
           ja.application_no AS "applicationNo", jp.posting_title AS "postingTitle"
      FROM job_applications ja
      JOIN candidates c ON c.id = ja.candidate_id
      JOIN job_postings jp ON jp.id = ja.job_posting_id
     WHERE c.account_id = ${session.accountId}::uuid
       AND (${applicationId ?? null}::uuid IS NULL OR ja.id = ${applicationId ?? null}::uuid)
     ORDER BY ja.applied_at DESC
     LIMIT 1
  `)) as unknown as { rows: CandidateContext[] };
  return res.rows?.[0] ?? null;
}
