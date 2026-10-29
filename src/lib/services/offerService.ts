/**
 * Register penawaran kerja (ADR 023).
 *
 * Selama ini alur OFFERED hanya mengubah status lamaran: tidak ada jejak siapa
 * menawarkan, berapa gaji yang ditawarkan, dan sampai kapan kandidat harus
 * merespons. Tabel `job_offers` (migrasi 0059) menjadi sumber kebenaran itu,
 * sekaligus audit trail penawaran.
 *
 * Surat penawaran terdaftar di modul e-Surat (`letters`, OUTGOING) agar masuk
 * tata kelola surat yang sudah ada — bukan sistem surat kedua.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';

export type OfferStatus = 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';

export interface JobOffer {
  id: string;
  applicationId: string;
  offeredByUserId: string | null;
  status: OfferStatus;
  baseSalary: number;
  fixedAllowance: number;
  offeredAt: string;
  responseDeadline: string;
  respondedAt: string | null;
  responseNote: string | null;
  letterAgendaNumber: string | null;
  notes: string | null;
}

export interface OfferAuditEntry {
  action: string;
  actorUserId: string | null;
  detail: string | null;
  at: string;
}

/** Batas respons yang wajar: minimal 1 hari, maksimal 60 hari. */
const MIN_RESPONSE_DAYS = 1;
const MAX_RESPONSE_DAYS = 60;

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: T[] } | null)?.rows;
  return Array.isArray(rows) ? rows : [];
}

/** Nomor agenda surat penawaran; unik per baris penawaran. */
function offerAgendaNumber(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `OFFER-${ymd}-${rand}`;
}

/** Teks surat penawaran — konten formal minimal, bukan dokumen hukum. */
function offerLetterBody(input: {
  candidateName: string;
  positionTitle: string;
  baseSalary: number;
  responseDays: number;
}): string {
  const gaji = input.baseSalary.toLocaleString('id-ID');
  return (
    `Dengan hormat,\n\n` +
    `Berdasarkan hasil seleksi, kami dengan senang hati menawarkan ${input.candidateName} ` +
    `posisi ${input.positionTitle} di perusahaan kami.\n\n` +
    `Gaji pokok: Rp ${gaji} per bulan.\n` +
    `Mohon konfirmasi penerimaan penawaran ini dalam ${input.responseDays} hari kalender ` +
    `sejak tanggal surat ini. Di luar jangka waktu tersebut penawaran dianggap kedaluwarsa.\n\n` +
    `Hormat kami,\nTim Rekrutmen`
  );
}

/** Detail lamaran + kandidat untuk surat penawaran. */
async function applicationInfo(db: Db, applicationId: string) {
  const res = (await db.execute(sql`
    SELECT ja.id AS "applicationId", ja.status::text AS status,
           c.full_name AS "candidateName", jp.posting_title AS "positionTitle",
           jp.manpower_plan_id AS "manpowerPlanId"
      FROM job_applications ja
      JOIN candidates c ON c.id = ja.candidate_id
      JOIN job_postings jp ON jp.id = ja.job_posting_id
     WHERE ja.id = ${applicationId}::uuid
  `)) as unknown as { rows: Array<{ applicationId: string; status: string; candidateName: string; positionTitle: string; manpowerPlanId: string | null }> };
  return res.rows?.[0] ?? null;
}

/**
 * Terbitkan penawaran: buat baris `job_offers`, daftarkan surat OUTGOING,
 * naikkan status lamaran ke OFFERED. Idempoten per lamaran (re-offer memperbarui).
 */
export async function extendOffer(
  db: Db,
  input: {
    applicationId: string;
    offeredByUserId: string | null;
    baseSalary: number;
    fixedAllowance?: number;
    responseDays?: number;
    notes?: string;
  },
): Promise<JobOffer> {
  if (!Number.isFinite(input.baseSalary) || input.baseSalary < 0) {
    throw new BusinessRuleError('Gaji penawaran wajib berupa angka >= 0.');
  }
  const responseDays = input.responseDays ?? 7;
  if (!Number.isInteger(responseDays) || responseDays < MIN_RESPONSE_DAYS || responseDays > MAX_RESPONSE_DAYS) {
    throw new BusinessRuleError(
      `Batas waktu respons wajib ${MIN_RESPONSE_DAYS}-${MAX_RESPONSE_DAYS} hari kalender.`
    );
  }

  const info = await applicationInfo(db, input.applicationId);
  if (!info) throw new BusinessRuleError('Lamaran tidak ditemukan.');
  if (['HIRED', 'REJECTED', 'OFFER_DECLINED'].includes(info.status)) {
    throw new BusinessRuleError(
      `Lamaran berstatus ${info.status} tidak dapat diberi penawaran baru.`
    );
  }

  const agenda = offerAgendaNumber();
  const alreadyOffered = (await db.execute(sql`
    SELECT id FROM job_offers WHERE application_id = ${input.applicationId}::uuid
  `)) as unknown as { rows: unknown[] };

  let offer: JobOffer | null = null;

  await db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;

    // Surat penawaran masuk modul e-Surat (idempoten per agenda number).
    await tdb.execute(sql`
      INSERT INTO letters (agenda_number, direction, classification, subject, sender, recipient,
                           letter_date, status, created_by)
      VALUES (${agenda}, 'OUTGOING', 'BIASA',
              ${`Penawaran Kerja — ${info.positionTitle} — ${info.candidateName}`},
              'Tim Rekrutmen', ${info.candidateName}, CURRENT_DATE, 'OPEN'::letter_status_enum,
              ${input.offeredByUserId})
      ON CONFLICT (agenda_number) DO NOTHING
    `);

    const res = (await tdb.execute(sql`
      INSERT INTO job_offers (application_id, offered_by, status, base_salary, fixed_allowance,
                              response_deadline, letter_agenda_number, notes)
      VALUES (${input.applicationId}::uuid, ${input.offeredByUserId}, 'SENT',
              ${input.baseSalary}, ${input.fixedAllowance ?? 0},
              NOW() + (${responseDays} || ' days')::interval, ${agenda}, ${input.notes ?? null})
      ON CONFLICT (application_id) DO UPDATE SET
        status = 'SENT',
        offered_by = EXCLUDED.offered_by,
        base_salary = EXCLUDED.base_salary,
        fixed_allowance = EXCLUDED.fixed_allowance,
        offered_at = CURRENT_TIMESTAMP,
        response_deadline = EXCLUDED.response_deadline,
        responded_at = NULL,
        response_note = NULL,
        letter_agenda_number = EXCLUDED.letter_agenda_number,
        notes = EXCLUDED.notes
      RETURNING id, application_id AS "applicationId", offered_by AS "offeredByUserId",
                status::text AS status, base_salary::float8 AS "baseSalary",
                fixed_allowance::float8 AS "fixedAllowance",
                offered_at AS "offeredAt", response_deadline AS "responseDeadline",
                responded_at AS "respondedAt", response_note AS "responseNote",
                letter_agenda_number AS "letterAgendaNumber", notes
    `)) as unknown as { rows: any[] };
    offer = rowsOf<any>(res)[0] ?? null;

    // Lamaran naik ke OFFERED (penawaran dikirim) — keputusan ACCEPTED lama
    // sudah memetakan ACCEPTED→OFFERED; di sini jalurnya eksplisit.
    await tdb.execute(sql`
      UPDATE job_applications SET status = 'OFFERED'::application_status_enum
       WHERE id = ${input.applicationId}::uuid
    `);

    // Audit trail penawaran.
    await tdb.execute(sql`
      INSERT INTO audit_logs (user_id, action_type, entity_name, record_id, description)
      VALUES (${input.offeredByUserId}, 'CREATE', 'job_offers',
              ${input.applicationId},
              ${`Penawaran diterbitkan: ${info.positionTitle}, gaji ${input.baseSalary}, batas respons ${responseDays} hari`})
    `);
  });

  if (!offer) throw new BusinessRuleError('Penawaran gagal disimpan.');

  // Notifikasi kandidat: best-effort, tidak membatalkan penawaran.
  try {
    const { notifyApplicationStatus } = await import('./notificationService');
    await notifyApplicationStatus(db, { applicationId: input.applicationId, status: 'OFFERED' });
  } catch { /* best-effort */ }

  return {
    ...(offer as unknown as JobOffer),
    baseSalary: Number((offer as any).baseSalary),
    fixedAllowance: Number((offer as any).fixedAllowance ?? 0),
  };
}

/** Kandidat merespons penawaran. Hanya penawaran SENT yang dapat direspons. */
export async function respondToOffer(
  db: Db,
  input: { applicationId: string; response: 'ACCEPTED' | 'DECLINED'; responseNote?: string },
): Promise<JobOffer> {
  const current = (await db.execute(sql`
    SELECT id, status::text AS status, letter_agenda_number AS "letterAgendaNumber"
      FROM job_offers WHERE application_id = ${input.applicationId}::uuid
  `)) as unknown as { rows: Array<{ id: string; status: string; letterAgendaNumber: string | null }> };
  const row = current.rows?.[0];
  if (!row) throw new BusinessRuleError('Penawaran tidak ditemukan untuk lamaran ini.');
  if (row.status !== 'SENT') {
    throw new BusinessRuleError(
      `Penawaran berstatus ${row.status} tidak dapat direspons.`
    );
  }

  const nextStatus = input.response === 'ACCEPTED' ? 'ACCEPTED' : 'DECLINED';
  const appStatus = input.response === 'ACCEPTED' ? 'HIRED' : 'OFFER_DECLINED';

  await db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;

    await tdb.execute(sql`
      UPDATE job_offers SET status = ${nextStatus}::offer_status_enum,
                            responded_at = CURRENT_TIMESTAMP,
                            response_note = ${input.responseNote ?? null}
       WHERE id = ${row.id}::uuid
    `);

    await tdb.execute(sql`
      UPDATE job_applications SET status = ${appStatus}::application_status_enum
       WHERE id = ${input.applicationId}::uuid
    `);

    // Surat penawaran ditutup setelah ada keputusan.
    if (row.letterAgendaNumber) {
      await tdb.execute(sql`
        UPDATE letters SET status = 'CLOSED'::letter_status_enum
         WHERE agenda_number = ${row.letterAgendaNumber}
      `);
    }

    await tdb.execute(sql`
      INSERT INTO audit_logs (user_id, action_type, entity_name, record_id, description)
      VALUES (NULL, 'UPDATE', 'job_offers', ${input.applicationId},
              ${`Kandidat merespons penawaran: ${nextStatus}${input.responseNote ? ` — ${input.responseNote}` : ''}`})
    `);
  });

  // ACCEPTED memicu konversi kandidat→karyawan (idempoten, best-effort setelah
  // commit). Status lamaran sudah HIRED; konversi gagal ditangani pemanggil.
  if (input.response === 'ACCEPTED') {
    const { convertHiredCandidate } = await import('./candidateConversionService');
    await convertHiredCandidate(db, { applicationId: input.applicationId });
    try {
      const { generateOnboardingProgram, refreshOnboardingStatus } = await import('./onboardingService');
      const emp = (await db.execute(sql`
        SELECT id FROM employees WHERE email = (
          SELECT c.email FROM job_applications ja JOIN candidates c ON c.id = ja.candidate_id
          WHERE ja.id = ${input.applicationId}::uuid)
      `)) as unknown as { rows: Array<{ id: string }> };
      if (emp.rows?.[0]) {
        await generateOnboardingProgram(db, { employeeId: emp.rows[0].id, applicationId: input.applicationId });
        await refreshOnboardingStatus(db, emp.rows[0].id);
      }
    } catch { /* best-effort */ }
  }

  try {
    const { notifyApplicationStatus } = await import('./notificationService');
    await notifyApplicationStatus(db, { applicationId: input.applicationId, status: appStatus });
  } catch { /* best-effort */ }

  const after = (await db.execute(sql`
    SELECT id, application_id AS "applicationId", offered_by AS "offeredByUserId",
           status::text AS status, base_salary::float8 AS "baseSalary",
           fixed_allowance::float8 AS "fixedAllowance", offered_at AS "offeredAt",
           response_deadline AS "responseDeadline", responded_at AS "respondedAt",
           response_note AS "responseNote", letter_agenda_number AS "letterAgendaNumber", notes
      FROM job_offers WHERE application_id = ${input.applicationId}::uuid
  `)) as unknown as { rows: any[] };
  const out = rowsOf<any>(after)[0];
  return { ...out, baseSalary: Number(out.baseSalary), fixedAllowance: Number(out.fixedAllowance ?? 0) };
}

/**
 * Tandai penawaran SENT yang sudah melewati batas waktu sebagai EXPIRED.
 * Idempoten; dipanggil saat daftar penawaran dibuka (atau oleh cron kelak).
 */
export async function expireOverdueOffers(db: Db): Promise<number> {
  const res = (await db.execute(sql`
    UPDATE job_offers SET status = 'EXPIRED'::offer_status_enum, updated_at = CURRENT_TIMESTAMP
     WHERE status = 'SENT' AND response_deadline < NOW()
    RETURNING application_id
  `)) as unknown as { rows: Array<{ application_id: string }> };
  return res.rows?.length ?? 0;
}

/** Penawaran SENT yang mendekati/melewati batas waktu — untuk tindak lanjut HR. */
export async function listExpiringOffers(
  db: Db,
  withinDays = 3
): Promise<Array<{ applicationId: string; status: OfferStatus; responseDeadline: string; candidateName: string; positionTitle: string }>> {
  await expireOverdueOffers(db);
  const res = (await db.execute(sql`
    SELECT o.application_id AS "applicationId", o.status::text AS status,
           o.response_deadline AS "responseDeadline",
           c.full_name AS "candidateName", jp.posting_title AS "positionTitle"
      FROM job_offers o
      JOIN job_applications ja ON ja.id = o.application_id
      JOIN candidates c ON c.id = ja.candidate_id
      JOIN job_postings jp ON jp.id = ja.job_posting_id
     WHERE o.status IN ('SENT', 'EXPIRED')
       AND o.response_deadline < NOW() + (${withinDays} || ' days')::interval
     ORDER BY o.response_deadline ASC
  `)) as unknown as { rows: any[] };
  return (res.rows ?? []).map((r) => ({ ...r, responseDeadline: String(r.responseDeadline) }));
}

/** Audit trail penawaran untuk satu lamaran (urut waktu menaik). */
export async function listOfferAuditTrail(
  db: Db,
  applicationId: string
): Promise<OfferAuditEntry[]> {
  const res = (await db.execute(sql`
    SELECT action_type AS "action", user_id AS "actorUserId", description AS detail, created_at AS at
      FROM audit_logs
       WHERE entity_name = 'job_offers' AND record_id::text = ${applicationId}
     ORDER BY created_at ASC, id ASC
  `)) as unknown as { rows: any[] };
  return (res.rows ?? []).map((r) => ({
    action: r.action === 'CREATE' ? 'OFFER_SENT' : r.action === 'UPDATE' ? 'OFFER_ACCEPTED' : r.action,
    actorUserId: r.actorUserId ?? null,
    detail: r.detail ?? null,
    at: new Date(r.at).toISOString(),
  }));
}