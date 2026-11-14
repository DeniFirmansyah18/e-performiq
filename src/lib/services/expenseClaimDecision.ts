/**
 * Keputusan klaim reimbursement oleh HR/Finance.
 *
 * Pegawai mengajukan klaim (status `SUBMITTED`); HR memutuskan menyetujui
 * (`APPROVED`, dapat dengan nominal berbeda — klaim sebagian) atau menolak
 * (`REJECTED`, alasan WAJIB). Klaim yang sudah diputuskan tidak boleh
 * diputuskan ulang agar keputusan tetap dapat dipertanggungjawabkan.
 */

export const STATUS_MENUNGGU = 'SUBMITTED';
export const STATUS_DISETUJUI = 'APPROVED';
export const STATUS_DITOLAK = 'REJECTED';
export const STATUS_DIBAYAR = 'PAID';

/** Status yang masih menunggu keputusan HR. */
export function masihMenunggu(status: string): boolean {
  return String(status ?? '').toUpperCase() === STATUS_MENUNGGU;
}

/** Peran yang berwenang memutuskan klaim reimbursement. */
export function bolehPutuskan(peran: string): boolean {
  return ['HR_MANAGER', 'BOD', 'SUPER_ADMIN'].includes(String(peran ?? '').toUpperCase());
}

export interface InputKeputusan {
  /** Status klaim saat ini di basis data. */
  statusSekarang: string;
  /** Keputusan HR: APPROVED atau REJECTED. */
  keputusan: 'APPROVED' | 'REJECTED';
  /** Nominal yang disetujui (untuk APPROVED). */
  disetujui: number;
  /** Nominal yang diajukan pegawai. */
  diajukan: number;
  /** Alasan penolakan / catatan (WAJIB untuk REJECTED, min 5 karakter). */
  catatan?: string;
}

export interface HasilValidasi {
  ok: boolean;
  pesan: string | null;
}

/** Panjang minimal alasan penolakan agar bermakna. */
const MIN_CATATAN = 5;

/**
 * Validasi keputusan sebelum disimpan.
 *
 * Mengembalikan `{ ok, pesan }`; pemanggil menampilkan `pesan` kepada HR bila
 * `ok === false` sehingga kesalahan dapat diperbaiki tanpa menebak.
 */
export function validasiKeputusanKlaim(input: InputKeputusan): HasilValidasi {
  const { statusSekarang, keputusan, disetujui, diajukan, catatan } = input;

  if (!masihMenunggu(statusSekarang)) {
    return {
      ok: false,
      pesan: `Klaim berstatus ${statusSekarang} sudah diputuskan dan tidak dapat diputuskan ulang.`,
    };
  }

  if (keputusan === 'REJECTED') {
    const alasan = String(catatan ?? '').trim();
    if (alasan.length < MIN_CATATAN) {
      return {
        ok: false,
        pesan: `Alasan penolakan wajib diisi (minimal ${MIN_CATATAN} karakter).`,
      };
    }
    return { ok: true, pesan: null };
  }

  // APPROVED
  if (!Number.isFinite(disetujui) || disetujui <= 0) {
    return { ok: false, pesan: 'Nominal yang disetujui harus lebih besar dari 0.' };
  }
  if (Number.isFinite(diajukan) && diajukan > 0 && disetujui > diajukan) {
    return {
      ok: false,
      pesan: `Nominal disetujui (${disetujui}) tidak boleh melebihi yang diajukan (${diajukan}).`,
    };
  }
  return { ok: true, pesan: null };
}
