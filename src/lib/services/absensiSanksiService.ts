/**
 * Rekomendasi sanksi absensi otomatis.
 *
 * Menjembatani dua bagian yang selama ini terpisah:
 *   - data kehadiran nyata di `attendance_records` (is_present / is_weekend / is_sick_leave),
 *   - aturan poin & jenis sanksi di `disciplinaryPoints.sanksiAbsensiYangDisarankan`.
 *
 * HR dapat memuat daftar pegawai yang layak disanksi karena alpa (tidak hadir
 * tanpa keterangan) dalam satu bulan, lalu menerbitkan sanksinya lewat
 * jalur disciplinary yang sudah ada.
 */

import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { sanksiAbsensiYangDisarankan, KATEGORI_PELANGGARAN } from '@/lib/services/disciplinaryPoints';

/** Satu fakta kehadiran harian (sesuai kolom attendance_records). */
export interface FaktaKehadiran {
  workDate: string; // 'YYYY-MM-DD'
  isPresent: boolean;
  isWeekend: boolean;
  isSickLeave: boolean;
}

/**
 * Berapa kali alpa (tidak hadir tanpa keterangan) dari daftar fakta kehadiran.
 * Akhir pekan dan cuti sakit resmi diabaikan — hanya hari kerja dengan
 * is_present = FALSE yang dihitung.
 */
export function hitungAlpaDariFakta(fakta: FaktaKehadiran[]): number {
  return fakta.filter((f) => !f.isPresent && !f.isWeekend && !f.isSickLeave).length;
}

/** Jenis sanksi + poin + alasan yang disarankan untuk sejumlah alpa (null bila wajar). */
export function rekomendasiAbsensi(jumlahAlpa: number) {
  return sanksiAbsensiYangDisarankan(jumlahAlpa);
}

export interface KandidatSanksiAbsensi {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  positionTitle: string | null;
  departmentName: string | null;
  jumlahAlpa: number;
  rekomendasi: { actionType: string; poin: number; alasan: string } | null;
}

/**
 * Daftar pegawai beserta jumlah alpa-nya pada bulan tertentu, berikut
 * sanksi yang disarankan. `month` berformat 'YYYY-MM'. Abnormal (alpa >= 3)
 * diurutkan paling atas.
 */
export async function daftarRekomendasiSanksiAbsensi(
  db: Db,
  month: string // 'YYYY-MM'
): Promise<KandidatSanksiAbsensi[]> {
  const from = `${month}-01`;
  const res = (await db.execute(sql`
    SELECT
      e.id::text AS "employeeId",
      e.employee_code AS "employeeCode",
      e.full_name AS "fullName",
      jp.position_title AS "positionTitle",
      d.department_name AS "departmentName",
      COUNT(*) FILTER (
        WHERE ar.is_present = FALSE AND ar.is_weekend = FALSE AND ar.is_sick_leave = FALSE
      )::int AS "jumlahAlpa"
      FROM employees e
      JOIN attendance_records ar ON ar.employee_id = e.id
      LEFT JOIN job_positions jp ON jp.id = e.position_id
      LEFT JOIN departments d ON d.id = e.department_id
     WHERE ar.work_date >= ${from}::date
       AND ar.work_date < (${from}::date + INTERVAL '1 month')
     GROUP BY e.id, e.employee_code, e.full_name, jp.position_title, d.department_name
    ORDER BY "jumlahAlpa" DESC, e.full_name ASC
  `)) as unknown as { rows: Array<{
    employeeId: string; employeeCode: string; fullName: string;
    positionTitle: string | null; departmentName: string | null; jumlahAlpa: number;
  }> };

  const kategori = KATEGORI_PELANGGARAN.find((k) => k.kode === 'ABSENSI')?.label ?? 'Absensi & Kehadiran';

  return (res.rows ?? []).map((r) => {
    const rekom = rekomendasiAbsensi(r.jumlahAlpa);
    return {
      employeeId: r.employeeId,
      employeeCode: r.employeeCode,
      fullName: r.fullName,
      positionTitle: r.positionTitle,
      departmentName: r.departmentName,
      jumlahAlpa: r.jumlahAlpa,
      rekomendasi: rekom
        ? { ...rekom, alasan: `${rekom.alasan} Kategori: ${kategori}.` }
        : null,
    };
  });
}
