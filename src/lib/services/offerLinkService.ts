/**
 * Mengirim tautan respons penawaran kerja ke kandidat lewat email dan WhatsApp.
 *
 * Dipakai setelah HR menerbitkan penawaran. Pengiriman bersifat best-effort:
 * kegagalan salah satu kanal tidak membatalkan penawaran yang sudah terbit —
 * pesan tetap tercatat di outbox (QUEUED) dan bisa dikirim ulang.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export interface HasilKirim {
  email: 'TERKIRIM' | 'GAGAL' | 'TANPA_ALAMAT';
  whatsapp: 'TERKIRIM' | 'GAGAL' | 'TANPA_NOMOR';
  tautan: string;
}

function basisUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (env) return env.replace(/\/$/, '');
  // Default pengembangan lokal.
  return 'http://localhost:3000';
}

export function buatTautanRespons(token: string): string {
  return `${basisUrl()}/offers/respond?t=${encodeURIComponent(token)}`;
}

export async function kirimTautanPenawaran(
  db: Db,
  applicationId: string,
  token: string
): Promise<HasilKirim> {
  const tautan = buatTautanRespons(token);

  const info = (await db.execute(sql`
    SELECT c.full_name AS "nama", c.email AS email, c.phone AS "telepon",
           jp.posting_title AS "posisi"
      FROM job_applications ja
      JOIN candidates c ON c.id = ja.candidate_id
      JOIN job_postings jp ON jp.id = ja.job_posting_id
     WHERE ja.id = ${applicationId}::uuid
  `)) as unknown as { rows: any[] };
  const r = info.rows?.[0];
  const hasil: HasilKirim = {
    email: 'TANPA_ALAMAT',
    whatsapp: 'TANPA_NOMOR',
    tautan,
  };
  if (!r) return hasil;

  const nama = r.nama ?? 'Kandidat';
  const posisi = r.posisi ?? 'posisi yang Anda lamar';

  // --- Email ---
  if (r.email) {
    try {
      const { sendEmail } = await import('./notificationService');
      await sendEmail(db, {
        to: r.email,
        subject: `Penawaran Kerja — ${posisi}`,
        body:
          `Halo ${nama},\n\n` +
          `Dengan senang hati kami menyampaikan penawaran kerja untuk posisi ${posisi}.\n` +
          `Silakan buka tautan berikut untuk menerima atau menolak penawaran:\n\n${tautan}\n\n` +
          `Tautan ini bersifat pribadi dan hanya dapat dipakai satu kali.\n\n` +
          `Terima kasih.`,
        html:
          `<p>Halo <strong>${nama}</strong>,</p>` +
          `<p>Dengan senang hati kami menyampaikan penawaran kerja untuk posisi <strong>${posisi}</strong>.</p>` +
          `<p>Silakan buka tautan berikut untuk menerima atau menolak penawaran:</p>` +
          `<p><a href="${tautan}">Buka Penawaran Kerja</a></p>` +
          `<p style="color:#64748b;font-size:12px">Tautan ini bersifat pribadi dan hanya dapat dipakai satu kali.</p>`,
        category: 'HIRING',
        severity: 'INFO',
        cta: { label: 'Buka Penawaran Kerja', url: tautan },
        applicationId,
      });
      hasil.email = 'TERKIRIM';
    } catch {
      hasil.email = 'GAGAL';
    }
  }

  // --- WhatsApp ---
  if (r.telepon) {
    try {
      const { sendWhatsApp } = await import('./whatsappService');
      const pesan =
        `Halo ${nama}, kami mengirim penawaran kerja untuk posisi ${posisi}. ` +
        `Buka tautan berikut untuk menerima atau menolak: ${tautan}`;
      await sendWhatsApp(db, { to: r.telepon, message: pesan, applicationId });
      hasil.whatsapp = 'TERKIRIM';
    } catch {
      hasil.whatsapp = 'GAGAL';
    }
  }

  return hasil;
}
