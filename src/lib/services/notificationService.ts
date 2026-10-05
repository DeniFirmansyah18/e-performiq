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

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;      // teks (plain) — dapat diperkaya menjadi HTML kelak
  html?: string;
  applicationId?: string | null;
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || 'E-PerformIQ <onboarding@resend.dev>';
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

/** Bungkus body teks menjadi HTML sederhana yang aman. */
export function toEmailHtml(subject: string, body: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paragraphs = esc(body).split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, '<br/>')}</p>`).join('');
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;background:#f8fafc;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
      <h2 style="font-size:16px;margin:0 0 16px;color:#0f172a">${esc(subject)}</h2>
      ${paragraphs}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
      <p style="font-size:11px;color:#94a3b8;margin:0">Email otomatis dari E-PerformIQ. Mohon tidak membalas.</p>
    </div>
  </body></html>`;
}

/**
 * Antre & kirim satu email. Menyimpan ke `email_outbox`, lalu mencoba kirim
 * via Resend bila dikonfigurasi.
 */
export async function sendEmail(db: Db, msg: EmailMessage): Promise<{ id: string | null; status: string }> {
  const provider = activeEmailProvider();
  const html = msg.html ?? toEmailHtml(msg.subject, msg.body);

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
  const emailRes = await sendEmail(db, { to: p.email, subject: `[E-PerformIQ] Lamaran ${p.applicationNo} diterima`, body, applicationId: p.applicationId });
  let whatsapp = 'SKIPPED';
  if (p.phone) {
    try {
      const { sendWhatsApp } = await import('@/lib/services/whatsappService');
      const waRes = await sendWhatsApp(db, { to: p.phone, message: `*E-PerformIQ*\n${title}\n\n${body}`, applicationId: p.applicationId });
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
      subject: `[E-PerformIQ] ${title} — ${row.applicationNo}`,
      body,
      applicationId: p.applicationId,
    });
    if (row.phone) {
      try {
        const { sendWhatsApp } = await import('@/lib/services/whatsappService');
        await sendWhatsApp(db, { to: row.phone, message: `*E-PerformIQ — ${title}*\n\n${body}`, applicationId: p.applicationId });
      } catch { /* WhatsApp opsional */ }
    }
  } catch { /* abaikan */ }
}

/** Daftar notifikasi in-app untuk akun kandidat. */
export async function listNotifications(db: Db, accountId: string, limit = 50) {
  const res = (await db.execute(sql`
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
