/**
 * Keterangan tambahan di samping status lamaran pada panel Rekrutmen Kandidat.
 *
 * Tujuannya: HR bisa membedakan "sudah ditawar tetapi belum dijawab" dari
 * "sudah ditawar dan kandidat menerima/menolak" tanpa perlu membuka detail.
 * Status lamaran sendiri tetap OFFERED selama kandidat belum diterima menjadi
 * karyawan (HIRED), karena penerimaan penawaran baru mengubah tahap, bukan
 * status kepegawaian.
 */
export type StatusPenawaran = 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN' | string | null;

export function keteranganStatus(statusLamaran: string, statusPenawaran: StatusPenawaran): string | null {
  if (statusLamaran === 'OFFERED') {
    if (statusPenawaran === 'ACCEPTED') return 'Ditawar — Diterima';
    if (statusPenawaran === 'DECLINED') return 'Ditawar — Ditolak';
    if (statusPenawaran === 'EXPIRED') return 'Penawaran kedaluwarsa';
    return 'Menunggu respons';
  }
  if (statusLamaran === 'HIRED') return 'Diterima menjadi karyawan';
  if (statusLamaran === 'REJECTED') return 'Tidak lolos seleksi';
  if (statusLamaran === 'OFFER_DECLINED') return 'Kandidat menolak penawaran';
  // Tahap awal: tidak perlu keterangan tambahan.
  return null;
}
