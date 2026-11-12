import { createHash, randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

/**
 * Token respons penawaran kerja.
 *
 * Kandidat menerima tautan berisi token lewat email/WhatsApp, lalu memilih
 * Terima atau Tolak tanpa perlu akun. Yang disimpan di database hanya hash
 * SHA-256 token, sehingga bocornya isi database tidak membuka tautan orang
 * lain.
 */

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface TokenDibaca {
  valid: boolean;
  alasan?: string;
  offerId?: string;
  applicationId?: string;
  statusPenawaran?: string;
}

/**
 * Menerbitkan token baru untuk sebuah lamaran dan menyimpannya (hash saja).
 * `masaBerlakuHari` boleh negatif untuk membuat token kedaluwarsa (uji).
 */
export async function terbitkanTokenRespons(
  db: Db,
  applicationId: string,
  masaBerlakuHari = 7
): Promise<{ token: string; kedaluwarsa: string }> {
  const token = randomBytes(32).toString('base64url');
  const res = (await db.execute(sql`
    UPDATE job_offers
       SET response_token_hash = ${hashToken(token)},
           response_token_expires_at = NOW() + (${masaBerlakuHari} || ' days')::interval,
           updated_at = CURRENT_TIMESTAMP
     WHERE application_id = ${applicationId}::uuid
    RETURNING response_token_expires_at::text AS "kedaluwarsa"
  `)) as unknown as { rows: Array<{ kedaluwarsa: string }> };
  return { token, kedaluwarsa: res.rows[0]?.kedaluwarsa ?? '' };
}

/** Membaca token: memeriksa keberadaan, masa berlaku, dan status penawaran. */
export async function bacaTokenRespons(db: Db, token: string): Promise<TokenDibaca> {
  if (!token || token.length < 20) return { valid: false, alasan: 'Token tidak valid.' };

  const res = (await db.execute(sql`
    SELECT id::text AS "offerId", application_id::text AS "applicationId",
           status::text AS status, response_token_expires_at AS "expiresAt",
           responded_at AS "respondedAt"
      FROM job_offers
     WHERE response_token_hash = ${hashToken(token)}
     LIMIT 1
  `)) as unknown as { rows: any[] };
  const r = res.rows?.[0];
  if (!r) return { valid: false, alasan: 'Tautan tidak dikenali.' };

  const dasar = { offerId: r.offerId, applicationId: r.applicationId, statusPenawaran: r.status };

  if (r.respondedAt) {
    return { valid: false, alasan: 'Penawaran ini sudah Anda jawab.', ...dasar };
  }
  if (r.status !== 'SENT') {
    return { valid: false, alasan: 'Penawaran ini sudah tidak aktif.', ...dasar };
  }
  const kedaluwarsa = r.expiresAt ? new Date(r.expiresAt) : null;
  if (!kedaluwarsa || kedaluwarsa.getTime() < Date.now()) {
    return { valid: false, alasan: 'Tautan penawaran sudah kedaluwarsa.', ...dasar };
  }
  return { valid: true, ...dasar };
}

export interface HasilRespons {
  berhasil: boolean;
  alasan?: string;
  applicationId?: string;
  namaKandidat?: string;
  posisi?: string;
}

/**
 * Mencatat respons kandidat (ACCEPTED/DECLINED) dari tautan bertoken.
 *
 * Penolakan juga memindahkan status lamaran ke OFFER_DECLINED agar statistik
 * seleksi tidak terkontaminasi REJECTED (kandidat lolos seleksi tetapi
 * menolak tawaran). Penerimaan tidak mengubah status lamaran: HR yang
 * menaikkannya ke HIRED setelah konversi menjadi karyawan.
 */
export async function catatResponsKandidat(
  db: Db,
  token: string,
  keputusan: 'ACCEPTED' | 'DECLINED'
): Promise<HasilRespons> {
  const info = await bacaTokenRespons(db, token);
  if (!info.valid || !info.applicationId) {
    return { berhasil: false, alasan: info.alasan ?? 'Token tidak valid.' };
  }

  const res = (await db.execute(sql`
    UPDATE job_offers
       SET status = ${keputusan}::offer_status_enum,
           responded_at = CURRENT_TIMESTAMP,
           -- Token sekali pakai: hapus setelah dipakai.
           response_token_hash = NULL,
           updated_at = CURRENT_TIMESTAMP
     WHERE application_id = ${info.applicationId}::uuid
       AND responded_at IS NULL
       AND status = 'SENT'
    RETURNING id::text AS id
  `)) as unknown as { rows: any[] };
  if (!res.rows?.length) {
    return { berhasil: false, alasan: 'Penawaran sudah dijawab sebelumnya.' };
  }

  if (keputusan === 'DECLINED') {
    await db.execute(sql`
      UPDATE job_applications SET status = 'OFFER_DECLINED'::application_status_enum
       WHERE id = ${info.applicationId}::uuid
    `);
  }

  const detail = (await db.execute(sql`
    SELECT c.full_name AS "namaKandidat", jp.posting_title AS "posisi"
      FROM job_applications ja
      JOIN candidates c ON c.id = ja.candidate_id
      JOIN job_postings jp ON jp.id = ja.job_posting_id
     WHERE ja.id = ${info.applicationId}::uuid
  `)) as unknown as { rows: any[] };

  return {
    berhasil: true,
    applicationId: info.applicationId,
    namaKandidat: detail.rows[0]?.namaKandidat ?? 'Kandidat',
    posisi: detail.rows[0]?.posisi ?? '',
  };
}
