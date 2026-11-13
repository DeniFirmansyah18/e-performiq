import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { DOKUMEN_BY_KODE } from './documentCatalog';

/**
 * Mengisi berkas kepegawaian OTOMATIS dari data yang sudah diisi kandidat
 * saat melamar.
 *
 * Yang bisa terisi otomatis (karena datanya memang sudah ada):
 *   - CV/resume  → `candidate_documents` bertipe CV
 *   - Ijazah     → dokumen bertipe CERTIFICATE/IJAZAH bila diunggah kandidat
 *   - KTP        → dokumen bertipe KTP bila diunggah kandidat
 *
 * Yang TIDAK bisa terisi otomatis dan tetap perlu diunggah: KK, NPWP, PKWT,
 * SK Pengangkatan, BPJS, Rekening, SKCK — berkas ini baru terbit setelah
 * kandidat menjadi pegawai.
 *
 * Fungsi idempoten: jenis yang sudah ada tidak ditimpa.
 */

/** Pemetaan jenis dokumen kandidat → kode katalog pegawai. */
const PETA_JENIS: Record<string, string> = {
  CV: 'CV',
  RESUME: 'CV',
  KTP: 'KTP',
  KK: 'KK',
  NPWP: 'NPWP',
  IJAZAH: 'IJAZAH',
  TRANSKRIP: 'TRANSKRIP',
  SERTIFIKAT: 'SERTIFIKAT',
  CERTIFICATE: 'SERTIFIKAT',
  SKCK: 'SKCK',
  BPJS: 'BPJS',
  PKWT: 'PKWT',
  PKWTT: 'PKWT',
};

export interface HasilIsiOtomatis {
  /** Jumlah berkas yang berhasil dipindahkan. */
  dipindahkan: number;
  /** Jenis katalog yang ikut terisi. */
  jenis: string[];
}

/**
 * Salin berkas kandidat ke berkas kepegawaian pegawai hasil konversi.
 *
 * Hanya memindahkan berkas yang JENISNYA dikenali katalog, agar daftar baku
 * tetap konsisten.
 */
export async function isiOtotomatisBerkasDariKandidat(
  db: Db,
  input: { employeeId: string; candidateId: string }
): Promise<HasilIsiOtomatis> {
  const hasil: HasilIsiOtomatis = { dipindahkan: 0, jenis: [] };

  const dok = (await db.execute(sql`
    SELECT doc_type AS "docType", file_url AS "fileUrl"
      FROM candidate_documents
     WHERE candidate_id = ${input.candidateId}::uuid
       AND file_url IS NOT NULL
  `)) as unknown as { rows: Array<{ docType: string; fileUrl: string }> };
  if (!dok.rows?.length) return hasil;

  for (const d of dok.rows) {
    const kode = PETA_JENIS[String(d.docType ?? '').toUpperCase()];
    if (!kode || !(kode in DOKUMEN_BY_KODE)) continue;

    // Jangan timpa berkas yang sudah ada untuk jenis yang sama.
    const ada = (await db.execute(sql`
      SELECT 1 FROM employee_documents
       WHERE employee_id = ${input.employeeId}::uuid
         AND UPPER(document_type) = ${kode}
       LIMIT 1
    `)) as unknown as { rows: unknown[] };
    if (ada.rows?.length) continue;

    await db.execute(sql`
      INSERT INTO employee_documents (employee_id, document_type, file_url, verification_status)
      VALUES (${input.employeeId}::uuid, ${kode}, ${d.fileUrl}, 'PENDING')
    `);
    hasil.dipindahkan++;
    hasil.jenis.push(kode);
  }

  return hasil;
}

/**
 * Ringkasan data pribadi yang terisi otomatis dari lamaran kandidat.
 *
 * Ditampilkan pada panel berkas agar pegawai tahu data mana yang sudah
 * terisi tanpa perlu mengisi ulang.
 */
export async function dataTerisiDariKandidat(
  db: Db,
  input: { employeeEmail: string }
): Promise<{
  nama: boolean;
  email: boolean;
  telepon: boolean;
  alamat: boolean;
  tanggalLahir: boolean;
  nik: boolean;
  pendidikan: boolean;
  berkas: string[];
}> {
  const r = (await db.execute(sql`
    SELECT c.full_name AS "fullName", c.email, c.phone, c.address,
           c.birth_date AS "birthDate", c.nik, c.education,
           (SELECT array_agg(d.doc_type) FROM candidate_documents d WHERE d.candidate_id = c.id) AS "berkas"
      FROM candidates c
     WHERE LOWER(c.email) = LOWER(${input.employeeEmail})
     ORDER BY c.created_at DESC
     LIMIT 1
  `)) as unknown as { rows: any[] };
  const c = r.rows?.[0];
  if (!c) {
    return {
      nama: false, email: false, telepon: false, alamat: false,
      tanggalLahir: false, nik: false, pendidikan: false, berkas: [],
    };
  }
  return {
    nama: Boolean(c.fullName),
    email: Boolean(c.email),
    telepon: Boolean(c.phone),
    alamat: Boolean(c.address),
    tanggalLahir: Boolean(c.birthDate),
    nik: Boolean(c.nik),
    pendidikan: Boolean(c.education),
    berkas: Array.isArray(c.berkas) ? c.berkas.map((x: string) => String(x)) : [],
  };
}
