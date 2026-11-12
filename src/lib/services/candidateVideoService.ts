import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { deleteObject } from '@/lib/storage/fileStorage';

/** Status lamaran yang menandakan proses seleksi selesai. */
export const STATUS_FINAL = ['HIRED', 'REJECTED'] as const;
export type StatusFinal = (typeof STATUS_FINAL)[number];

export interface VideoKandidat {
  id: string;
  candidateId: string;
  applicationId: string | null;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  uploadedAt: string;
  /** URL untuk memutar video lewat endpoint media. */
  fileUrl: string;
}

function keBaris(r: any): VideoKandidat {
  return {
    id: r.id,
    candidateId: r.candidateId,
    applicationId: r.applicationId ?? null,
    storageKey: r.storageKey,
    fileName: r.fileName,
    mimeType: r.mimeType,
    sizeBytes: Number(r.sizeBytes ?? 0),
    durationSeconds: r.durationSeconds === null || r.durationSeconds === undefined ? null : Number(r.durationSeconds),
    uploadedAt: r.uploadedAt,
    fileUrl: `/api/v1/careers/media/${encodeURIComponent(r.storageKey)}`,
  };
}

const SELECT = sql`
  id::text AS id, candidate_id::text AS "candidateId",
  application_id::text AS "applicationId", storage_key AS "storageKey",
  file_name AS "fileName", mime_type AS "mimeType",
  size_bytes::float8 AS "sizeBytes", duration_seconds::float8 AS "durationSeconds",
  uploaded_at::text AS "uploadedAt"
`;

/**
 * Menyimpan metadata video perkenalan kandidat.
 * Biner video sudah berada di penyimpanan; di sini hanya lokasinya.
 */
export async function simpanVideoKandidat(
  db: Db,
  input: {
    candidateId: string;
    applicationId?: string | null;
    storageKey: string;
    fileName: string;
    mimeType?: string;
    sizeBytes: number;
    durationSeconds?: number | null;
  }
): Promise<VideoKandidat> {
  const res = (await db.execute(sql`
    INSERT INTO candidate_videos
      (candidate_id, application_id, storage_key, file_name, mime_type, size_bytes, duration_seconds)
    VALUES (
      ${input.candidateId}::uuid,
      ${input.applicationId ?? null}${input.applicationId ? sql`::uuid` : sql``},
      ${input.storageKey}, ${input.fileName}, ${input.mimeType ?? 'video/mp4'},
      ${input.sizeBytes}, ${input.durationSeconds ?? null}
    )
    RETURNING ${SELECT}
  `)) as unknown as { rows: any[] };
  return keBaris(res.rows[0]);
}

/** Semua video milik seorang kandidat, terbaru lebih dulu. */
export async function ambilVideoKandidat(db: Db, candidateId: string): Promise<VideoKandidat[]> {
  const res = (await db.execute(sql`
    SELECT ${SELECT} FROM candidate_videos
     WHERE candidate_id = ${candidateId}::uuid
     ORDER BY uploaded_at DESC
  `)) as unknown as { rows: any[] };
  return (res.rows ?? []).map(keBaris);
}

/** Video yang terhubung ke satu lamaran. */
export async function ambilVideoLamaran(db: Db, applicationId: string): Promise<VideoKandidat[]> {
  const res = (await db.execute(sql`
    SELECT ${SELECT} FROM candidate_videos
     WHERE application_id = ${applicationId}::uuid
     ORDER BY uploaded_at DESC
  `)) as unknown as { rows: any[] };
  return (res.rows ?? []).map(keBaris);
}

/**
 * Menghapus video beserta berkasnya bila status lamaran sudah final.
 *
 * Dipanggil setiap kali status lamaran berubah. Aman dipanggil berulang:
 * bila tidak ada video, hasilnya nol tanpa error.
 *
 * Berkas dihapus lebih dulu; baris database hanya dihapus bila berkasnya
 * berhasil dihapus atau memang sudah tidak ada, supaya tidak ada baris yang
 * menunjuk berkas yatim.
 */
export async function hapusVideoJikaStatusFinal(
  db: Db,
  applicationId: string,
  status?: string
): Promise<{ dihapus: number; storageKeys: string[] }> {
  let statusPakai = status;
  if (!statusPakai) {
    const r = (await db.execute(sql`
      SELECT status::text AS status FROM job_applications WHERE id = ${applicationId}::uuid
    `)) as unknown as { rows: Array<{ status: string }> };
    statusPakai = r.rows[0]?.status;
  }
  if (!statusPakai || !(STATUS_FINAL as readonly string[]).includes(statusPakai)) {
    return { dihapus: 0, storageKeys: [] };
  }

  const vid = (await db.execute(sql`
    SELECT id::text AS id, storage_key AS "storageKey"
      FROM candidate_videos WHERE application_id = ${applicationId}::uuid
  `)) as unknown as { rows: Array<{ id: string; storageKey: string }> };

  if ((vid.rows ?? []).length === 0) return { dihapus: 0, storageKeys: [] };

  const terhapus: string[] = [];
  const idTerhapus: string[] = [];

  for (const v of vid.rows) {
    try {
      await deleteObject(v.storageKey);
      terhapus.push(v.storageKey);
      idTerhapus.push(v.id);
    } catch {
      // Berkas gagal dihapus: pertahankan baris agar bisa dicoba lagi nanti.
    }
  }

  if (idTerhapus.length > 0) {
    for (const id of idTerhapus) {
      await db.execute(sql`DELETE FROM candidate_videos WHERE id = ${id}::uuid`);
    }
  }

  return { dihapus: idTerhapus.length, storageKeys: terhapus };
}
