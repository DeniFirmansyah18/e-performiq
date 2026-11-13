/**
 * Daftar baku jenis berkas kepegawaian.
 *
 * Sebelumnya `employee_documents.document_type` berupa teks bebas, sehingga
 * penamaan tidak konsisten ("KTP", "ktp", "Kartu Tanda Penduduk") dan tidak
 * mungkin dihitung kelengkapannya. Modul ini menjadi sumber tunggal:
 *
 *   - jenis baku + label Indonesia
 *   - wajib / opsional (per jenis, dengan pengecualian menurut status kerja)
 *   - pihak yang memverifikasi (HR untuk berkas hukum, atasan untuk berkas kerja)
 *
 * Dipakai oleh portal pegawai (Profil Saya), direktori pegawai HR, dan
 * pengingat kedaluwarsa.
 */

export type KelompokDokumen =
  | 'IDENTITAS'
  | 'PENDIDIKAN'
  | 'HUBUNGAN_KERJA'
  | 'JAMINAN'
  | 'ADMINISTRASI';

export const LABEL_KELOMPOK: Record<KelompokDokumen, string> = {
  IDENTITAS: 'Identitas Pribadi',
  PENDIDIKAN: 'Pendidikan & Kompetensi',
  HUBUNGAN_KERJA: 'Hubungan Kerja',
  JAMINAN: 'Jaminan Sosial & Payroll',
  ADMINISTRASI: 'Administrasi & Catatan',
};

/** Siapa yang berwenang memverifikasi berkas ini. */
export type VerifikatorDokumen = 'HR' | 'ATASAN';

export interface JenisDokumen {
  /** Kode baku yang disimpan pada `employee_documents.document_type`. */
  kode: string;
  label: string;
  kelompok: KelompokDokumen;
  /** Wajib disimpan untuk setiap pegawai, kecuali `pengecualian` terpenuhi. */
  wajib: boolean;
  /**
   * Pengecualian kewajiban menurut jenis/status kerja tertentu.
   * Contoh: PKWT tidak wajib untuk pegawai tetap karena mereka memakai PKWTT.
   */
  wajibUntuk?: Array<'PKWT' | 'PKWTT' | 'MAGANG'>;
  /** Memiliki masa berlaku sehingga perlu pengingat kedaluwarsa. */
  berkedaluwarsa: boolean;
  verifikator: VerifikatorDokumen;
  /** Keterangan singkat untuk membantu pegawai. */
  ket?: string;
}

/**
 * Daftar baku 15 jenis berkas kepegawaian.
 *
 * Urutan pada array = urutan tampil di antarmuka.
 */
export const KATALOG_DOKUMEN: JenisDokumen[] = [
  // ===== Identitas =====
  { kode: 'KTP', label: 'KTP', kelompok: 'IDENTITAS', wajib: true, berkedaluwarsa: false, verifikator: 'HR', ket: 'Kartu Tanda Penduduk (e-KTP).' },
  { kode: 'KK', label: 'Kartu Keluarga', kelompok: 'IDENTITAS', wajib: true, berkedaluwarsa: false, verifikator: 'HR' },
  { kode: 'NPWP', label: 'NPWP', kelompok: 'IDENTITAS', wajib: true, berkedaluwarsa: false, verifikator: 'HR', ket: 'Dipakai untuk pemotongan pajak penghasilan.' },
  { kode: 'FOTO', label: 'Pas Foto', kelompok: 'IDENTITAS', wajib: false, berkedaluwarsa: false, verifikator: 'HR' },

  // ===== Pendidikan =====
  { kode: 'IJAZAH', label: 'Ijazah', kelompok: 'PENDIDIKAN', wajib: true, berkedaluwarsa: false, verifikator: 'HR' },
  { kode: 'TRANSKRIP', label: 'Transkrip Nilai', kelompok: 'PENDIDIKAN', wajib: false, berkedaluwarsa: false, verifikator: 'HR' },
  { kode: 'SERTIFIKAT', label: 'Sertifikat Keahlian', kelompok: 'PENDIDIKAN', wajib: false, berkedaluwarsa: true, verifikator: 'HR', ket: 'Sertifikat pelatihan/keahlian; ada yang berbatas waktu.' },
  { kode: 'STR_SIP', label: 'STR / SIP', kelompok: 'PENDIDIKAN', wajib: false, berkedaluwarsa: true, verifikator: 'HR', ket: 'Surat izin praktik untuk tenaga kesehatan.' },

  // ===== Hubungan kerja =====
  { kode: 'PKWT', label: 'Perjanjian Kerja (PKWT/PKWTT)', kelompok: 'HUBUNGAN_KERJA', wajib: true, berkedaluwarsa: true, verifikator: 'HR', ket: 'PKWT berbatas waktu; PWKTT tidak.' },
  { kode: 'SK_PENGANGKATAN', label: 'SK Pengangkatan', kelompok: 'HUBUNGAN_KERJA', wajib: true, berkedaluwarsa: false, verifikator: 'HR' },
  { kode: 'SP', label: 'Surat Peringatan', kelompok: 'HUBUNGAN_KERJA', wajib: false, berkedaluwarsa: true, verifikator: 'ATASAN', ket: 'SP1–SP3; berakhir setelah masa berlaku.' },
  { kode: 'PAKLARING', label: 'Surat Keterangan Kerja', kelompok: 'HUBUNGAN_KERJA', wajib: false, berkedaluwarsa: false, verifikator: 'HR', ket: 'Diterbitkan saat pegawai berhenti.' },

  // ===== Jaminan & payroll =====
  { kode: 'BPJS', label: 'Kartu BPJS', kelompok: 'JAMINAN', wajib: true, berkedaluwarsa: false, verifikator: 'HR', ket: 'BPJS Kesehatan & Ketenagakerjaan.' },
  { kode: 'REKENING', label: 'Buku Rekening Bank', kelompok: 'JAMINAN', wajib: true, berkedaluwarsa: false, verifikator: 'HR', ket: 'Rekening untuk penggajian.' },

  // ===== Administrasi =====
  { kode: 'SKCK', label: 'SKCK', kelompok: 'ADMINISTRASI', wajib: true, berkedaluwarsa: true, verifikator: 'HR', ket: 'Surat Keterangan Catatan Kepolisian; berlaku ~6 bulan.' },
  // CV/riwayat hidup ikut dari lamaran kandidat (terisi otomatis).
  { kode: 'CV', label: 'CV / Riwayat Hidup', kelompok: 'ADMINISTRASI', wajib: false, berkedaluwarsa: false, verifikator: 'HR', ket: 'Terisi otomatis dari lamaran kandidat.' },
];

/** Peta kode → jenis untuk pencarian cepat. */
export const DOKUMEN_BY_KODE: Record<string, JenisDokumen> = Object.fromEntries(
  KATALOG_DOKUMEN.map((d) => [d.kode, d])
);

/**
 * Jenis dokumen wajib untuk pegawai tertentu.
 *
 * `jenisKerja` menentukan pengecualian (mis. PKWT hanya untuk kontrak).
 */
export function dokumenWajib(jenisKerja?: 'PKWT' | 'PKWTT' | 'MAGANG'): JenisDokumen[] {
  return KATALOG_DOKUMEN.filter((d) => {
    if (!d.wajib) return false;
    if (d.wajibUntuk && jenisKerja && !d.wajibUntuk.includes(jenisKerja)) return false;
    return true;
  });
}

export interface BerkasTersimpan {
  documentType: string;
  expiryDate?: string | null;
  verificationStatus?: string | null;
}

export interface RingkasanKelengkapan {
  /** Teks siap tampil, mis. "Berkas wajib: 6 dari 9 lengkap". */
  teksKelengkapan: string;
  jumlahWajib: number;
  jumlahLengkap: number;
  persen: number;
  /** Kode dokumen wajib yang belum diunggah. */
  belumAda: JenisDokumen[];
  /** Dokumen berkedaluwarsa per tanggal acuan. */
  kedaluwarsa: Array<{ kode: string; label: string; tanggal: string }>;
  /** Dokumen yang akan kedaluwarsa dalam 60 hari. */
  segeraKedaluwarsa: Array<{ kode: string; label: string; tanggal: string }>;
}

/** Selisih hari antara dua tanggal (b - a). */
function selisihHari(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Hitung kelengkapan berkas wajib + dokumen kedaluwarsa.
 *
 * `documents` boleh berisi kode baku MAUPUN teks bebas lama; yang tidak
 * dikenali diabaikan agar tidak membuat hitungan keliru.
 */
export function hitungKelengkapan(
  documents: BerkasTersimpan[],
  opts: { jenisKerja?: 'PKWT' | 'PKWTT' | 'MAGANG'; hariIni?: Date; ambangHari?: number } = {}
): RingkasanKelengkapan {
  const hariIni = opts.hariIni ?? new Date();
  const ambang = opts.ambangHari ?? 60;

  const wajib = dokumenWajib(opts.jenisKerja);
  const kodeAda = new Set(
    documents
      .map((d) => String(d.documentType ?? '').trim().toUpperCase())
      .filter((k) => k in DOKUMEN_BY_KODE)
  );

  const lengkap = wajib.filter((d) => kodeAda.has(d.kode));
  const belumAda = wajib.filter((d) => !kodeAda.has(d.kode));

  const kedaluwarsa: RingkasanKelengkapan['kedaluwarsa'] = [];
  const segeraKedaluwarsa: RingkasanKelengkapan['segeraKedaluwarsa'] = [];
  for (const d of documents) {
    if (!d.expiryDate) continue;
    const kode = String(d.documentType ?? '').trim().toUpperCase();
    const jenis = DOKUMEN_BY_KODE[kode];
    if (!jenis) continue;
    const tgl = new Date(d.expiryDate);
    if (Number.isNaN(tgl.getTime())) continue;
    const sisa = selisihHari(hariIni, tgl);
    const item = { kode, label: jenis.label, tanggal: d.expiryDate };
    if (sisa < 0) kedaluwarsa.push(item);
    else if (sisa <= ambang) segeraKedaluwarsa.push(item);
  }

  const jumlahWajib = wajib.length;
  const jumlahLengkap = lengkap.length;
  return {
    teksKelengkapan: `Berkas wajib: ${jumlahLengkap} dari ${jumlahWajib} lengkap`,
    jumlahWajib,
    jumlahLengkap,
    persen: jumlahWajib === 0 ? 100 : Math.round((jumlahLengkap / jumlahWajib) * 100),
    belumAda,
    kedaluwarsa,
    segeraKedaluwarsa,
  };
}
