/**
 * Offboarding self-service (sisi karyawan) — fase "Setelah Kerja".
 *
 * Read & write, dibatasi ke karyawan pemilik sesi (`session.employeeId`):
 *  - baca status offboarding + checklist serah terima + ringkasan pesangon;
 *  - ajukan resign sendiri (employee_id DIPAKSA dari sesi — anti-spoof);
 *  - tandai item serah terima miliknya (verifikasi resmi tetap HR);
 *  - kirim exit interview.
 *
 * Best-effort & driver-agnostic (`db.execute(sql...)`).
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { SessionPayload } from '@/lib/auth/session';
import { BusinessRuleError, ForbiddenError } from '@/lib/auth/errors';

export async function getMyOffboarding(db: Db, employeeId: string | null) {
  if (!employeeId) return { request: null as any, handovers: [] as any[], handoverProgress: 0, severance: null, exitInterview: null };

  const res = (await db.execute(sql`
    SELECT id, reason_for_leaving AS "reasonForLeaving", resignation_notice_date AS "resignationNoticeDate",
           last_working_day AS "lastWorkingDay", status::text AS status, created_at AS "createdAt"
      FROM offboarding_requests WHERE employee_id = ${employeeId}::uuid
     ORDER BY created_at DESC LIMIT 1
  `)) as unknown as { rows: any[] };
  const request = res.rows?.[0] ?? null;
  if (!request) return { request: null, handovers: [], handoverProgress: 0, severance: null, exitInterview: null };

  const hv = (await db.execute(sql`
    SELECT id, handover_item_name AS "itemName", category, is_verified AS "isVerified",
           verified_at AS "verifiedAt", notes
      FROM knowledge_handovers WHERE offboarding_request_id = ${request.id}::uuid
     ORDER BY handover_item_name
  `)) as unknown as { rows: any[] };
  const handovers = hv.rows ?? [];
  const verified = handovers.filter((h) => h.isVerified).length;
  const handoverProgress = handovers.length ? Math.round((verified / handovers.length) * 100) : 100;

  const sev = (await db.execute(sql`
    SELECT service_years AS "serviceYears", base_salary::float8 AS "baseSalary",
           total_disbursement::float8 AS "totalDisbursement", is_paid AS "isPaid"
      FROM severance_calculations WHERE offboarding_request_id = ${request.id}::uuid LIMIT 1
  `)) as unknown as { rows: any[] };

  const iv = (await db.execute(sql`
    SELECT feedback, overall_rating AS "overallRating", would_recommend AS "wouldRecommend", created_at AS "createdAt"
      FROM exit_interviews WHERE employee_id = ${employeeId}::uuid
     ORDER BY created_at DESC LIMIT 1
  `)) as unknown as { rows: any[] };

  return { request, handovers, handoverProgress, severance: sev.rows?.[0] ?? null, exitInterview: iv.rows?.[0] ?? null };
}

export async function initiateMyOffboarding(
  db: Db,
  session: SessionPayload,
  data: { reasonForLeaving: string; resignationNoticeDate: string; lastWorkingDay: string },
) {
  if (!session.employeeId) throw new BusinessRuleError('Akun Anda tidak tertaut ke karyawan.');

  // Cegah duplikasi: bila sudah ada request aktif, tolak.
  const existing = (await db.execute(sql`
    SELECT id FROM offboarding_requests WHERE employee_id = ${session.employeeId}::uuid
       AND status <> 'COMPLETED'::offboarding_status_enum LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  if (existing.rows[0]) throw new BusinessRuleError('Anda sudah memiliki proses offboarding aktif.');

  const res = (await db.execute(sql`
    INSERT INTO offboarding_requests (employee_id, reason_for_leaving, resignation_notice_date, last_working_day)
    VALUES (${session.employeeId}::uuid, ${data.reasonForLeaving}, ${data.resignationNoticeDate}::date, ${data.lastWorkingDay}::date)
    RETURNING id, status::text AS status
  `)) as unknown as { rows: any[] };
  return res.rows[0];
}

export async function markMyHandover(db: Db, session: SessionPayload, handoverId: string) {
  if (!session.employeeId) throw new BusinessRuleError('Akun Anda tidak tertaut ke karyawan.');
  const res = (await db.execute(sql`
    UPDATE knowledge_handovers SET notes = COALESCE(NULLIF(notes, ''), 'Ditandai siap oleh karyawan')
     WHERE id = ${handoverId}::uuid
       AND offboarding_request_id IN (SELECT id FROM offboarding_requests WHERE employee_id = ${session.employeeId}::uuid)
    RETURNING id, notes
  `)) as unknown as { rows: any[] };
  if (!res.rows?.[0]) throw new ForbiddenError('Item serah terima tidak ditemukan atau bukan milik Anda.');
  return res.rows[0];
}

export async function saveMyExitInterview(
  db: Db,
  session: SessionPayload,
  data: { feedback: string; overallRating?: number; wouldRecommend?: boolean },
) {
  if (!session.employeeId) throw new BusinessRuleError('Akun Anda tidak tertaut ke karyawan.');
  const reqRow = (await db.execute(sql`
    SELECT id FROM offboarding_requests WHERE employee_id = ${session.employeeId}::uuid ORDER BY created_at DESC LIMIT 1
  `)) as unknown as { rows: Array<{ id: string }> };
  const reqId = reqRow.rows[0]?.id ?? null;

  const res = (await db.execute(sql`
    INSERT INTO exit_interviews (employee_id, offboarding_request_id, feedback, overall_rating, would_recommend)
    VALUES (${session.employeeId}::uuid, ${reqId}::uuid, ${data.feedback}, ${data.overallRating ?? null}, ${data.wouldRecommend ?? null})
    ON CONFLICT (employee_id, offboarding_request_id)
    DO UPDATE SET feedback = EXCLUDED.feedback, overall_rating = EXCLUDED.overall_rating, would_recommend = EXCLUDED.would_recommend
    RETURNING id
  `)) as unknown as { rows: any[] };
  return res.rows[0];
}
