import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { ok, fail, problem } from '@/lib/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MESSAGE: Record<string, string> = {
  ACCEPTED: 'Selamat! Anda lolos seleksi. Tim rekrutmen akan menghubungi Anda untuk proses selanjutnya.',
  REJECTED: 'Terima kasih telah melamar. Saat ini Anda belum dapat kami lanjutkan, namun kami menyimpan data Anda untuk peluang berikutnya.',
  TALENT_POOL: 'Anda masuk ke dalam talent pool kami. Kami akan menghubungi Anda bila ada kesempatan yang cocok.',
  PENDING: 'Lamaran Anda masih dalam proses penilaian.',
};

// GET /api/v1/careers/result/:applicationNo  (PUBLIK - tanpa login)
// Notifikasi hasil untuk kandidat berdasarkan nomor lamaran.
export async function GET(_req: NextRequest, ctx: { params: { applicationNo: string } }) {
  try {
    const res = (await db.execute(sql`
      SELECT ja.application_no AS "applicationNo", ja.status AS "applicationStatus",
             jp.posting_title AS "postingTitle", c.full_name AS "candidateName",
             cd.decision::text AS decision, cd.notes, cd.decided_at AS "decidedAt"
        FROM job_applications ja
        JOIN candidates c ON c.id = ja.candidate_id
        JOIN job_postings jp ON jp.id = ja.job_posting_id
        LEFT JOIN candidate_decisions cd ON cd.application_id = ja.id
       WHERE ja.application_no = ${ctx.params.applicationNo}
    `)) as unknown as { rows: any[] };
    const row = res.rows?.[0];
    if (!row) return fail('NOT_FOUND', 'Nomor lamaran tidak ditemukan.', 404);

    // Turunkan keputusan dari status bila belum ada catatan eksplisit.
    const decision = row.decision
      ?? (row.applicationStatus === 'HIRED' || row.applicationStatus === 'OFFERED' ? 'ACCEPTED'
        : row.applicationStatus === 'REJECTED' ? 'REJECTED' : 'PENDING');

    return ok({
      applicationNo: row.applicationNo,
      postingTitle: row.postingTitle,
      candidateName: row.candidateName,
      applicationStatus: row.applicationStatus,
      decision,
      decidedAt: row.decidedAt ?? null,
      message: MESSAGE[decision] ?? MESSAGE.PENDING,
    });
  } catch (err) {
    return problem(err, '/api/v1/careers/result/[applicationNo]');
  }
}
