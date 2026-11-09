/**
 * Notification Service (WS-13) — notifikasi progress lamaran kandidat.
 *
 * Dua kanal:
 *  1. In-app  : tabel `candidate_notifications` (dibaca portal kandidat).
 *  2. Email   : tabel `email_outbox` + adapter provider.
 *     - Bila `RESEND_API_KEY` diset → kirim via Resend (https://resend.com).
 *     - Bila tidak → baris tetap QUEUED (dapat dikirim nanti oleh worker/retry).
 *
 * Semua operasi best-effort: kegagalan notifikasi TIDAK boleh menggagalkan
 * alur utama (lamaran, keputusan, dsb.).
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import type { UserRole } from '@/types';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;      // teks (plain) — dapat diperkaya menjadi HTML kelak
  html?: string;
  applicationId?: string | null;
  /** Kategori semantik untuk aksen/warna (mis. HIRING, OFFBOARDING, PAYROLL). */
  category?: string;
  /** Tingkat kepentingan memengaruhi warna aksen header. */
  severity?: NotificationSeverity;
  /** Tombol aksi opsional (CTA) di dalam email. */
  cta?: { label: string; url: string };
  /** Teks pratinjau (preheader) yang tampil di inbox sebelum dibuka. */
  preheader?: string;
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || 'HR Command Center <onboarding@resend.dev>';
}

/** Provider email aktif berdasarkan env. */
export function activeEmailProvider(): 'resend' | 'webhook' | 'none' {
  const explicit = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  if (explicit === 'resend') return process.env.RESEND_API_KEY ? 'resend' : 'none';
  if (explicit === 'webhook') return process.env.EMAIL_WEBHOOK_URL ? 'webhook' : 'none';
  // Auto-detect bila tidak diset eksplisit.
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.EMAIL_WEBHOOK_URL) return 'webhook';
  return 'none';
}

/** Status konfigurasi email (tanpa membocorkan rahasia) — untuk diagnosa. */
export function emailConfigStatus() {
  return {
    provider: activeEmailProvider(),
    from: fromAddress(),
    resendConfigured: !!process.env.RESEND_API_KEY,
    webhookConfigured: !!process.env.EMAIL_WEBHOOK_URL,
    note: activeEmailProvider() === 'none'
      ? 'Email nonaktif: notifikasi tetap tampil in-app dan tercatat di email_outbox (QUEUED).'
      : 'Email aktif: notifikasi akan dikirim melalui provider di atas.',
  };
}

/** Tingkat kepentingan notifikasi — memengaruhi warna aksen. */
export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

const SEVERITY_ACCENT: Record<NotificationSeverity, { bar: string; badge: string; label: string }> = {
  INFO: { bar: '#2563eb', badge: '#dbeafe', label: 'Informasi' },
  SUCCESS: { bar: '#16a34a', badge: '#dcfce7', label: 'Berhasil' },
  WARNING: { bar: '#d97706', badge: '#fef3c7', label: 'Perhatian' },
  CRITICAL: { bar: '#dc2626', badge: '#fee2e2', label: 'Penting' },
};

/** Bungkus body teks menjadi HTML yang aman, ber-brand, dan responsif. */
export function toEmailHtml(
  subject: string,
  body: string,
  opts: { severity?: NotificationSeverity; cta?: { label: string; url: string }; preheader?: string } = {},
): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const accent = SEVERITY_ACCENT[opts.severity ?? 'INFO'];
  const paragraphs = esc(body).split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px;line-height:1.55">${p.replace(/\n/g, '<br/>')}</p>`).join('');
  const preheader = opts.preheader
    ? `<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</span>`
    : '';
  const cta = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px"><tr><td
         style="border-radius:8px;background:${accent.bar}">
         <a href="${esc(opts.cta.url)}" target="_blank"
            style="display:inline-block;padding:11px 20px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px">${esc(opts.cta.label)}</a>
       </td></tr></table>`
    : '';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:14px">
    ${preheader}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
          <tr><td style="height:5px;background:${accent.bar}"></td></tr>
          <tr><td style="padding:22px 24px 0">
            <span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${accent.bar};background:${accent.badge};border-radius:999px;padding:4px 10px">HR Command Center · ${accent.label}</span>
            <h2 style="font-size:17px;margin:14px 0 14px;color:#0f172a">${esc(subject)}</h2>
          </td></tr>
          <tr><td style="padding:0 24px">
            ${paragraphs}
            ${cta}
          </td></tr>
          <tr><td style="padding:18px 24px 22px">
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0"/>
            <p style="font-size:11px;color:#94a3b8;margin:0">Email otomatis dari HR Command Center — platform penilaian kinerja &amp; human capital. Mohon tidak membalas email ini.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

/**
 * Antre & kirim satu email. Menyimpan ke `email_outbox`, lalu mencoba kirim
 * via Resend bila dikonfigurasi.
 */
export async function sendEmail(db: Db, msg: EmailMessage): Promise<{ id: string | null; status: string }> {
  const provider = activeEmailProvider();
  const html = msg.html ?? toEmailHtml(msg.subject, msg.body, {
    severity: msg.severity ?? 'INFO',
    cta: msg.cta,
    preheader: msg.preheader ?? msg.body.slice(0, 120),
  });

  // 1) Selalu catat ke outbox (audit + fallback antrean).
  let outboxId: string | null = null;
  try {
    const res = (await db.execute(sql`
      INSERT INTO email_outbox (recipient, subject, body, status, provider, related_application_id)
      VALUES (${msg.to}, ${msg.subject}, ${msg.body}, 'QUEUED', ${provider === 'none' ? null : provider.toUpperCase()},
              ${msg.applicationId ?? null}::uuid)
      RETURNING id
    `)) as unknown as { rows: Array<{ id: string }> };
    outboxId = res.rows[0]?.id ?? null;
  } catch {
    return { id: null, status: 'QUEUED' };
  }

  // 2) Kirim bila provider dikonfigurasi.
  if (provider === 'none') return { id: outboxId, status: 'QUEUED' };

  try {
    const resp = provider === 'resend'
      ? await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
          body: JSON.stringify({ from: fromAddress(), to: [msg.to], subject: msg.subject, text: msg.body, html }),
        })
      : await fetch(process.env.EMAIL_WEBHOOK_URL as string, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.EMAIL_WEBHOOK_AUTH ? { Authorization: process.env.EMAIL_WEBHOOK_AUTH } : {}),
          },
          body: JSON.stringify({ from: fromAddress(), to: msg.to, subject: msg.subject, text: msg.body, html }),
        });

    if (resp.ok) {
      await updateOutbox(db, outboxId, 'SENT', null);
      return { id: outboxId, status: 'SENT' };
    }
    const detail = await resp.text().catch(() => '');
    await updateOutbox(db, outboxId, 'FAILED', `${provider} ${resp.status}: ${detail.slice(0, 300)}`);
    return { id: outboxId, status: 'FAILED' };
  } catch (err) {
    await updateOutbox(db, outboxId, 'FAILED', (err as Error)?.message ?? 'network');
    return { id: outboxId, status: 'FAILED' };
  }
}

async function updateOutbox(db: Db, id: string | null, status: string, error: string | null): Promise<void> {
  if (!id) return;
  try {
    await db.execute(sql`
      UPDATE email_outbox SET status = ${status}::email_status_enum, error = ${error},
             sent_at = CASE WHEN ${status} = 'SENT' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = ${id}::uuid
    `);
  } catch { /* abaikan */ }
}

/** Buat notifikasi in-app untuk kandidat. Best-effort. */
export async function createNotification(
  db: Db,
  payload: { candidateId?: string | null; accountId?: string | null; applicationId?: string | null; title: string; body?: string; stage?: string | null },
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO candidate_notifications (candidate_id, account_id, application_id, title, body, stage)
      VALUES (${payload.candidateId ?? null}::uuid, ${payload.accountId ?? null}::uuid,
              ${payload.applicationId ?? null}::uuid, ${payload.title}, ${payload.body ?? null}, ${payload.stage ?? null})
    `);
  } catch { /* abaikan */ }
}

const STAGE_LABEL: Record<string, string> = {
  APPLIED: 'Lamaran Diterima',
  ATS_REVIEW: 'Seleksi Berkas (ATS)',
  PSYCHOMETRIC: 'Tes Psikometri',
  TECHNICAL: 'Tes Teknis',
  INTERVIEW: 'Wawancara',
  HR_REVIEW: 'Review HR',
  DECISION: 'Keputusan Akhir',
};

/** Notifikasi saat lamaran berhasil dikirim. */
export async function notifyApplicationSubmitted(
  db: Db,
  p: { candidateId: string; accountId?: string | null; applicationId?: string | null; email: string; name: string; applicationNo: string; phone?: string | null },
): Promise<{ email: string; whatsapp: string }> {
  const title = 'Lamaran Berhasil Dikirim';
  const body = `Halo ${p.name}, lamaran Anda dengan nomor ${p.applicationNo} telah kami terima. ` +
    `Pantau progres melalui halaman status lamaran. Kami akan mengirimkan notifikasi pada setiap tahap.`;
  await createNotification(db, { candidateId: p.candidateId, accountId: p.accountId, applicationId: p.applicationId, title, body, stage: 'APPLIED' });
  const emailRes = await sendEmail(db, { to: p.email, subject: `[HR Command Center] Lamaran ${p.applicationNo} diterima`, body, applicationId: p.applicationId });
  let whatsapp = 'SKIPPED';
  if (p.phone) {
    try {
      const { sendWhatsApp } = await import('@/lib/services/whatsappService');
      const waRes = await sendWhatsApp(db, { to: p.phone, message: `*HR Command Center*\n${title}\n\n${body}`, applicationId: p.applicationId });
      whatsapp = waRes?.status ?? 'UNKNOWN';
    } catch (err) {
      whatsapp = 'FAILED';
      console.warn('[notificationService] WA gagal:', (err as Error)?.message);
    }
  }
  return { email: emailRes?.status ?? 'UNKNOWN', whatsapp };
}

/**
 * Notifikasi perubahan tahap. `syncApplicationTimeline` akan memanggil helper
 * ini saat tahap berubah (lihat timelineService).
 */
export async function notifyStageChange(
  db: Db,
  p: { applicationId: string; stage: string; status: string; note?: string | null },
): Promise<void> {
  try {
    const info = (await db.execute(sql`
      SELECT c.id AS "candidateId", c.email, c.phone, c.full_name AS "name", c.account_id AS "accountId",
             ja.application_no AS "applicationNo", jp.posting_title AS "postingTitle"
        FROM job_applications ja
        JOIN candidates c ON c.id = ja.candidate_id
        JOIN job_postings jp ON jp.id = ja.job_posting_id
       WHERE ja.id = ${p.applicationId}::uuid
    `)) as unknown as { rows: any[] };
    const row = info.rows?.[0];
    if (!row) return;

    const label = STAGE_LABEL[p.stage] ?? p.stage;
    const statusText = p.status === 'PASSED' ? 'selesai'
      : p.status === 'FAILED' ? 'tidak lolos'
      : p.status === 'SCHEDULED' ? 'dijadwalkan'
      : p.status === 'IN_PROGRESS' ? 'sedang diproses' : p.status.toLowerCase();
    const title = `Update Tahap: ${label}`;
    const body = `Halo ${row.name}, progres lamaran ${row.applicationNo} (${row.postingTitle}) — tahap ${label} kini ${statusText}.` +
      (p.note ? ` Catatan: ${p.note}.` : '');

    await createNotification(db, {
      candidateId: row.candidateId, accountId: row.accountId, applicationId: p.applicationId, title, body, stage: p.stage,
    });
    await sendEmail(db, {
      to: row.email,
      subject: `[HR Command Center] ${title} — ${row.applicationNo}`,
      body,
      applicationId: p.applicationId,
    });
    if (row.phone) {
      try {
        const { sendWhatsApp } = await import('@/lib/services/whatsappService');
        await sendWhatsApp(db, { to: row.phone, message: `*HR Command Center — ${title}*\n\n${body}`, applicationId: p.applicationId });
      } catch { /* WhatsApp opsional */ }
    }
  } catch { /* abaikan */ }
}

const APP_STATUS_COPY: Record<string, { title: string; body: (ctx: { applicationNo: string; postingTitle: string }) => string }> = {
  SCREENING: {
    title: 'Lolos Seleksi Awal',
    body: (c) => `Selamat! Lamaran ${c.applicationNo} (${c.postingTitle}) lolos seleksi awal. Silakan lanjutkan ke tahap asesmen di portal kandidat.`,
  },
  INTERVIEW: {
    title: 'Undangan Wawancara',
    body: (c) => `Lamaran ${c.applicationNo} (${c.postingTitle}) masuk tahap wawancara. Tautan rapat tersedia di portal kandidat Anda.`,
  },
  OFFERED: {
    title: 'Penawaran Kerja',
    body: (c) => `Selamat! Anda menerima penawaran untuk posisi ${c.postingTitle}. HR akan menghubungi Anda untuk detail selanjutnya.`,
  },
    OFFER_DECLINED: {
      title: 'Penawaran Ditutup',
      body: (c) => `Penawaran untuk posisi ${c.postingTitle} telah ditutup sesuai konfirmasi Anda. Terima kasih — data Anda kami simpan untuk peluang berikutnya.`,
    },
  HIRED: {
    title: 'Selamat, Anda Diterima',
    body: (c) => `Selamat! Lamaran ${c.applicationNo} (${c.postingTitle}) dinyatakan DITERIMA. Selamat bergabung!`,
  },
  REJECTED: {
    title: 'Hasil Seleksi Lamaran',
    body: (c) => `Terima kasih telah melamar posisi ${c.postingTitle}. Mohon maaf, lamaran ${c.applicationNo} belum dapat kami lanjutkan saat ini.`,
  },
};

/**
 * Notifikasi berbasis STATUS lamaran (bukan tahap timeline). Dipakai untuk
 * menjamin tiap transisi status HR (mis. OFFERED→HIRED) menghasilkan notifikasi,
 * termasuk saat status turunan timeline tidak berubah. Best-effort.
 */
export async function notifyApplicationStatus(
  db: Db,
  p: { applicationId: string; status: string },
): Promise<void> {
  const copy = APP_STATUS_COPY[p.status];
  if (!copy) return;
  try {
    const info = (await db.execute(sql`
      SELECT c.id AS "candidateId", c.email, c.phone, c.account_id AS "accountId",
             ja.application_no AS "applicationNo", jp.posting_title AS "postingTitle"
        FROM job_applications ja
        JOIN candidates c ON c.id = ja.candidate_id
        JOIN job_postings jp ON jp.id = ja.job_posting_id
       WHERE ja.id = ${p.applicationId}::uuid
    `)) as unknown as { rows: any[] };
    const row = info.rows?.[0];
    if (!row) return;

    const body = copy.body({ applicationNo: row.applicationNo, postingTitle: row.postingTitle });
    await createNotification(db, {
      candidateId: row.candidateId, accountId: row.accountId, applicationId: p.applicationId, title: copy.title, body, stage: 'APPLIED',
    });
    await sendEmail(db, { to: row.email, subject: `[HR Command Center] ${copy.title} — ${row.applicationNo}`, body, applicationId: p.applicationId });
    if (row.phone) {
      try {
        const { sendWhatsApp } = await import('@/lib/services/whatsappService');
        await sendWhatsApp(db, { to: row.phone, message: `*HR Command Center — ${copy.title}*\n\n${body}`, applicationId: p.applicationId });
      } catch { /* WhatsApp opsional */ }
    }
  } catch { /* abaikan */ }
}

/** Daftar notifikasi in-app untuk akun kandidat. */
export async function listNotifications(db: Db, accountId: string, limit = 50) {  const res = (await db.execute(sql`
    SELECT id, title, body, stage, is_read AS "isRead", created_at AS "createdAt"
      FROM candidate_notifications WHERE account_id = ${accountId}::uuid
     ORDER BY created_at DESC LIMIT ${limit}
  `)) as unknown as { rows: any[] };
  return res.rows ?? [];
}

/** Tandai notifikasi terbaca. */
export async function markNotificationsRead(db: Db, accountId: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE candidate_notifications SET is_read = TRUE
       WHERE account_id = ${accountId}::uuid AND is_read = FALSE
    `);
  } catch { /* abaikan */ }
}

/* ------------------------------------------------------------------ *
 * Notifikasi siklus hidup karyawan (bukan kandidat).
 * Tabel `employee_notifications`. Best-effort: kegagalan notifikasi
 * tidak boleh menggagalkan alur (hiring, probation, offboarding).
 * ------------------------------------------------------------------ */

export type EmployeeLifecycleEvent =
  | 'HIRED_ONBOARDING'
  | 'PROBATION_PASSED'
  | 'OFFBOARDING_INITIATED'
  | 'SEVERANCE_PAID'
  | 'APPRAISAL_CALIBRATED'
  | 'KPI_ASSIGNED'
  | 'PAYSLIP_READY'
  | 'TRAINING_ASSIGNED'
  | 'CONTRACT_ENDING'
  // --- Event lintas-role (HR / Atasan / Komite Kalibrasi / Pengawas) ---
  | 'LEAVE_REQUESTED'          // pengajuan cuti masuk → HR/Atasan (persetujuan)
  | 'LEAVE_DECIDED'            // keputusan cuti → karyawan pemohon
  | 'TIMESHEET_SUBMITTED'      // timesheet dikirim → Atasan (persetujuan)
  | 'TIMESHEET_DECIDED'        // keputusan timesheet → karyawan
  | 'PAYROLL_RUN_READY'        // run payroll dibuat → HR/BOD/Auditor
  | 'PAYROLL_ITEM_PAID'        // slip dibayar → karyawan + Auditor
  | 'APPRAISAL_BATCH_READY'    // batch GPA massal selesai → HR
  | 'FINALIZATION_REQUESTED'   // permintaan finalisasi nilai → HR
  | 'CALIBRATION_PENDING'      // hasil siap dikalibrasi → Komite Kalibrasi
  | 'CLEARANCE_PENDING'        // serah terima menunggu verifikasi → Atasan
  | 'CANDIDATE_HIRED';          // kandidat dikonversi → HR + Atasan terkait

/** Metadata bawaan (kategori + severity + label aksi) per event siklus hidup. */
const EMPLOYEE_EVENT_META: Record<EmployeeLifecycleEvent, { category: string; severity: NotificationSeverity; ctaLabel?: string; actionUrl?: string }> = {
  HIRED_ONBOARDING: { category: 'HIRING', severity: 'SUCCESS', ctaLabel: 'Buka Onboarding', actionUrl: '/dashboard/onboarding' },
  PROBATION_PASSED: { category: 'PROBATION', severity: 'SUCCESS', ctaLabel: 'Lihat Profil', actionUrl: '/dashboard/employee' },
  OFFBOARDING_INITIATED: { category: 'OFFBOARDING', severity: 'WARNING', ctaLabel: 'Lihat Status', actionUrl: '/dashboard/offboarding' },
  SEVERANCE_PAID: { category: 'PAYROLL', severity: 'SUCCESS', ctaLabel: 'Lihat Payslip', actionUrl: '/dashboard/payroll' },
  APPRAISAL_CALIBRATED: { category: 'APPRAISAL', severity: 'INFO', ctaLabel: 'Lihat Penilaian', actionUrl: '/dashboard/appraisals' },
  KPI_ASSIGNED: { category: 'KPI', severity: 'INFO', ctaLabel: 'Isi KPI', actionUrl: '/dashboard/kpi' },
  PAYSLIP_READY: { category: 'PAYROLL', severity: 'INFO', ctaLabel: 'Unduh Payslip', actionUrl: '/dashboard/payroll' },
  TRAINING_ASSIGNED: { category: 'LEARNING', severity: 'INFO', ctaLabel: 'Mulai Pelatihan', actionUrl: '/dashboard/learning' },
  CONTRACT_ENDING: { category: 'CONTRACT', severity: 'WARNING', ctaLabel: 'Lihat Kontrak', actionUrl: '/dashboard/employee' },
  LEAVE_REQUESTED: { category: 'ATTENDANCE', severity: 'INFO', ctaLabel: 'Review Cuti', actionUrl: '/dashboard/hr-command' },
  LEAVE_DECIDED: { category: 'ATTENDANCE', severity: 'SUCCESS', ctaLabel: 'Lihat Cuti', actionUrl: '/dashboard/employee-portal' },
  TIMESHEET_SUBMITTED: { category: 'ATTENDANCE', severity: 'INFO', ctaLabel: 'Review Timesheet', actionUrl: '/dashboard/manager-cockpit' },
  TIMESHEET_DECIDED: { category: 'ATTENDANCE', severity: 'SUCCESS', ctaLabel: 'Lihat Timesheet', actionUrl: '/dashboard/employee-portal' },
  PAYROLL_RUN_READY: { category: 'PAYROLL', severity: 'INFO', ctaLabel: 'Buka Payroll', actionUrl: '/dashboard/hr-command' },
  PAYROLL_ITEM_PAID: { category: 'PAYROLL', severity: 'SUCCESS', ctaLabel: 'Lihat Payslip', actionUrl: '/dashboard/employee-portal' },
  APPRAISAL_BATCH_READY: { category: 'APPRAISAL', severity: 'INFO', ctaLabel: 'Lihat Appraisal', actionUrl: '/dashboard/hr-command' },
  FINALIZATION_REQUESTED: { category: 'APPRAISAL', severity: 'WARNING', ctaLabel: 'Proses Finalisasi', actionUrl: '/dashboard/hr-command' },
  CALIBRATION_PENDING: { category: 'APPRAISAL', severity: 'INFO', ctaLabel: 'Kalibrasi', actionUrl: '/dashboard/ninebox-matrix' },
  CLEARANCE_PENDING: { category: 'OFFBOARDING', severity: 'INFO', ctaLabel: 'Verifikasi Serah Terima', actionUrl: '/dashboard/manager-cockpit' },
  CANDIDATE_HIRED: { category: 'HIRING', severity: 'SUCCESS', ctaLabel: 'Lihat Karyawan', actionUrl: '/dashboard/hr-command' },
};

/** Penerima notifikasi: karyawan, user tertentu, dan/atau seluruh peran. */
export interface NotificationRecipients {
  /** Karyawan pemilik data (opsional; memudahkan query "notifikasi saya"). */
  employeeId?: string | null;
  /** User spesifik (mis. atasan langsung) — id tabel `users`. */
  userId?: string | null;
  /** Semua user dengan peran ini akan menerima (mis. HR_MANAGER). */
  role?: UserRole | null;
  /** Alamat email tujuan (opsional; untuk kanal email). */
  email?: string | null;
}

type RecipientRole = UserRole;

/**
 * Buat notifikasi in-app (kaya: kategori, severity, tautan aksi). Best-effort.
 * Penerima boleh berupa karyawan, user spesifik, dan/atau peran — minimal satu.
 */
export async function createEmployeeNotification(
  db: Db,
  payload: {
    employeeId?: string | null;
    userId?: string | null;
    role?: RecipientRole | null;
    eventType: EmployeeLifecycleEvent;
    title: string;
    body?: string;
    category?: string;
    severity?: NotificationSeverity;
    actionUrl?: string | null;
    emailStatus?: string | null;
  },
): Promise<void> {
  const meta = EMPLOYEE_EVENT_META[payload.eventType];
  if (!payload.employeeId && !payload.userId && !payload.role) return;
  try {
    await db.execute(sql`
      INSERT INTO employee_notifications
        (employee_id, recipient_user_id, recipient_role, event_type, title, body,
         category, severity, action_url, email_status)
      VALUES (${payload.employeeId ?? null}::uuid,
              ${payload.userId ?? null}::uuid,
              ${payload.role ?? null}::user_role_enum,
              ${payload.eventType}, ${payload.title}, ${payload.body ?? null},
              ${payload.category ?? meta?.category ?? 'GENERAL'},
              ${payload.severity ?? meta?.severity ?? 'INFO'},
              ${payload.actionUrl ?? meta?.actionUrl ?? null},
              ${payload.emailStatus ?? null})
    `);
  } catch { /* abaikan */ }
}

/**
 * Kirim notifikasi: catat in-app (kaya) + antre email ber-brand (dengan tombol
 * aksi) bila alamat tersedia. Penerima boleh karyawan / user / peran.
 * Best-effort (tidak melempar).
 */
export async function notifyEmployeeLifecycle(
  db: Db,
  p: {
    employeeId?: string | null;
    userId?: string | null;
    role?: RecipientRole | null;
    eventType: EmployeeLifecycleEvent;
    title: string;
    body: string;
    email?: string | null;
    severity?: NotificationSeverity;
    cta?: { label: string; url: string };
  },
): Promise<void> {
  const meta = EMPLOYEE_EVENT_META[p.eventType];
  const actionUrl = p.cta?.url ?? meta?.actionUrl ?? null;
  const severity = p.severity ?? meta?.severity ?? 'INFO';

  // Email hanya masuk akal bila ada satu tujuan jelas (karyawan atau email eksplisit).
  let email = p.email ?? null;
  if (!email && p.employeeId) {
    try {
      const res = (await db.execute(sql`
        SELECT email FROM employees WHERE id = ${p.employeeId}::uuid
      `)) as unknown as { rows: Array<{ email: string }> };
      email = res.rows[0]?.email ?? null;
    } catch { /* abaikan */ }
  }

  let emailStatus: string | null = null;
  if (email) {
    const sent = await sendEmail(db, {
      to: email,
      subject: `[HR Command Center] ${p.title}`,
      body: p.body,
      severity,
      category: meta?.category,
      cta: p.cta ?? (meta?.actionUrl && meta?.ctaLabel ? { label: meta.ctaLabel, url: meta.actionUrl } : undefined),
      preheader: p.body.split('\n')[0].slice(0, 120),
    });
    emailStatus = sent.status;
  }

  // Catat in-app setelah email agar status kirim ikut tersimpan.
  await createEmployeeNotification(db, {
    employeeId: p.employeeId,
    userId: p.userId,
    role: p.role,
    eventType: p.eventType,
    title: p.title,
    body: p.body,
    category: meta?.category,
    severity,
    actionUrl,
    emailStatus,
  });
}

export interface NotifQuery {
  employeeId?: string | null;
  userId?: string | null;
  role?: RecipientRole | null;
}

/** Filter SQL bersama: baris untuk karyawan ini ATAU user ini ATAU perannya. */
function recipientFilter(q: NotifQuery) {
  const clauses = [];
  if (q.employeeId) clauses.push(sql`employee_id = ${q.employeeId}::uuid`);
  if (q.userId) clauses.push(sql`recipient_user_id = ${q.userId}::uuid`);
  if (q.role) clauses.push(sql`recipient_role = ${q.role}::user_role_enum`);
  // Tanpa penerima cocok → tak ada baris (hindari kebocoran lintas-role).
  if (clauses.length === 0) return sql`FALSE`;
  return sql`(${sql.join(clauses, sql` OR `)})`;
}

/** Daftar notifikasi in-app milik penerima (kaya). */
export async function listEmployeeNotifications(db: Db, q: NotifQuery, limit = 50) {
  const res = (await db.execute(sql`
    SELECT id, event_type AS "eventType", title, body,
           category, severity, action_url AS "actionUrl", email_status AS "emailStatus",
           is_read AS "isRead", created_at AS "createdAt"
      FROM employee_notifications WHERE ${recipientFilter(q)}
     ORDER BY created_at DESC LIMIT ${limit}
  `)) as unknown as { rows: any[] };
  return res.rows ?? [];
}

/** Jumlah notifikasi belum dibaca untuk penerima (badge). */
export async function unreadEmployeeNotificationCount(db: Db, q: NotifQuery): Promise<number> {
  try {
    const res = (await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM employee_notifications
       WHERE is_read = FALSE AND ${recipientFilter(q)}
    `)) as unknown as { rows: Array<{ count: number }> };
    return Number(res.rows[0]?.count ?? 0);
  } catch { return 0; }
}

/** Tandai notifikasi penerima terbaca (semua atau satu id). */
export async function markEmployeeNotificationsRead(db: Db, q: NotifQuery, notificationId?: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE employee_notifications SET is_read = TRUE
       WHERE is_read = FALSE AND ${recipientFilter(q)}
       ${notificationId ? sql`AND id = ${notificationId}::uuid` : sql``}
    `);
  } catch { /* abaikan */ }
}

/**
 * Notifikasi peran: catat untuk SETIAP peran target. Berguna saat 1 event
 * harus sampai ke beberapa tim (mis. FINALIZATION → HR + Komite Kalibrasi).
 */
export async function notifyRoles(
  db: Db,
  roles: Array<RecipientRole>,
  p: { eventType: EmployeeLifecycleEvent; title: string; body: string; severity?: NotificationSeverity; cta?: { label: string; url: string } },
): Promise<void> {
  await Promise.all(roles.map((role) => notifyEmployeeLifecycle(db, { ...p, role })));
}
