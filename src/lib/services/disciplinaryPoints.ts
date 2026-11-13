/**
 * Poin pelanggaran pada sanksi disiplin.
 *
 * Besaran poin baku per jenis sanksi mengikuti praktik umum HR Indonesia:
 * makin berat sanksinya, makin besar poinnya. Poin hanya dihitung selama
 * sanksi masih berlaku (belum melewati `expiry_date`), sehingga pegawai yang
 * sudah menyelesaikan masa sanksinya kembali bersih.
 */

export type JenisSanksi = 'TEGURAN' | 'SP1' | 'SP2' | 'SP3';

/** Poin bawaan per jenis sanksi. */
export const POIN_BAKU: Record<JenisSanksi, number> = {
  TEGURAN: 1,
  SP1: 5,
  SP2: 10,
  SP3: 20,
};

export const LABEL_SANKSI: Record<JenisSanksi, string> = {
  TEGURAN: 'Teguran Lisan',
  SP1: 'Surat Peringatan I',
  SP2: 'Surat Peringatan II',
  SP3: 'Surat Peringatan III',
};

/**
 * Kategori pelanggaran. Dipakai untuk rekap dan untuk penelusuran sumber
 * pelanggaran (mis. otomatis dari absensi).
 */
export const KATEGORI_PELANGGARAN = [
  { kode: 'ABSENSI', label: 'Absensi & Kehadiran' },
  { kode: 'KODE_ETIK', label: 'Kode Etik & Perilaku' },
  { kode: 'KINERJA', label: 'Kinerja & Target' },
  { kode: 'KEPATUHAN', label: 'Kepatuhan Prosedur' },
  { kode: 'LAINNYA', label: 'Lainnya' },
] as const;

export type KategoriPelanggaran = (typeof KATEGORI_PELANGGARAN)[number]['kode'];

/**
 * Ambang poin yang memicu peringatan.
 *
 *   - 5 poin  → perhatian atasan (belum sanksi formal)
 *   - 10 poin → HR meninjau untuk menerbitkan SP
 *   - 20 poin → eskalasi ke BOD / pertimbangan PHK
 */
export const AMBANG_POIN = [
  { poin: 5, label: 'Perhatian atasan' },
  { poin: 10, label: 'Tinjauan HR untuk SP' },
  { poin: 20, label: 'Eskalasi ke BOD' },
] as const;

export interface SanksiTercatat {
  actionType: string;
  violationPoints?: number | null;
  violationCategory?: string | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
}

export interface RingkasanPoin {
  /** Total poin sanksi yang masih berlaku. */
  totalPoinAktif: number;
  /** Total poin seluruh sanksi (termasuk yang sudah berakhir). */
  totalPoinKeseluruhan: number;
  jumlahSanksiAktif: number;
  /** Ambang terakhir yang terlampaui (null bila di bawah 5 poin). */
  ambangTerlampaui: { poin: number; label: string } | null;
  /** Rekap poin aktif per kategori pelanggaran. */
  perKategori: Array<{ kategori: string; label: string; poin: number }>;
  /** Sanksi aktif yang terdekat kedaluwarsa. */
  berlakuSampai: string | null;
}

/** Poin sebuah sanksi: pakai nilai tersimpan, atau bobot baku menurut jenis. */
export function poinSanksi(s: SanksiTercatat): number {
  const tersimpan = Number(s.violationPoints ?? 0);
  if (Number.isFinite(tersimpan) && tersimpan > 0) return tersimpan;
  return POIN_BAKU[(String(s.actionType ?? '').toUpperCase() as JenisSanksi)] ?? 0;
}

/** Apakah sanksi masih berlaku pada tanggal acuan. */
export function masihBerlaku(s: SanksiTercatat, hariIni: Date): boolean {
  if (!s.expiryDate) return true; // tanpa masa berlaku = masih berlaku
  const tgl = new Date(s.expiryDate);
  if (Number.isNaN(tgl.getTime())) return true;
  return tgl.getTime() >= hariIni.getTime();
}

/**
 * Hitung ringkasan poin pelanggaran seorang pegawai.
 */
export function hitungPoinPelanggaran(
  daftar: SanksiTercatat[],
  opts: { hariIni?: Date } = {}
): RingkasanPoin {
  const hariIni = opts.hariIni ?? new Date();
  const aktif = daftar.filter((s) => masihBerlaku(s, hariIni));

  const totalPoinAktif = aktif.reduce((a, s) => a + poinSanksi(s), 0);
  const totalPoinKeseluruhan = daftar.reduce((a, s) => a + poinSanksi(s), 0);

  const perKategoriMap = new Map<string, number>();
  for (const s of aktif) {
    const kode = (s.violationCategory ?? 'LAINNYA').toUpperCase();
    perKategoriMap.set(kode, (perKategoriMap.get(kode) ?? 0) + poinSanksi(s));
  }
  const perKategori = Array.from(perKategoriMap.entries()).map(([kode, poin]) => ({
    kategori: kode,
    label: KATEGORI_PELANGGARAN.find((k) => k.kode === kode)?.label ?? 'Lainnya',
    poin,
  }));

  const ambang = [...AMBANG_POIN].reverse().find((a) => totalPoinAktif >= a.poin) ?? null;

  const tanggalBerlaku = aktif
    .map((s) => s.expiryDate)
    .filter((x): x is string => Boolean(x))
    .sort();

  return {
    totalPoinAktif,
    totalPoinKeseluruhan,
    jumlahSanksiAktif: aktif.length,
    ambangTerlampaui: ambang ? { poin: ambang.poin, label: ambang.label } : null,
    perKategori,
    berlakuSampai: tanggalBerlaku[0] ?? null,
  };
}

/**
 * Pelanggaran absensi otomatis dari jumlah ketidakhadiran tanpa keterangan.
 *
 * Ambang mengikuti praktik HR: 3 kali alpa dalam sebulan → teguran,
 * 5 kali → SP1. Mengembalikan jenis sanksi yang disarankan (null bila wajar).
 */
export function sanksiAbsensiYangDisarankan(
  jumlahAlpaBulanIni: number
): { actionType: JenisSanksi; poin: number; alasan: string } | null {
  if (jumlahAlpaBulanIni >= 6) {
    return {
      actionType: 'SP2',
      poin: POIN_BAKU.SP2,
      alasan: `${jumlahAlpaBulanIni} kali tidak hadir tanpa keterangan dalam sebulan.`,
    };
  }
  if (jumlahAlpaBulanIni >= 5) {
    return {
      actionType: 'SP1',
      poin: POIN_BAKU.SP1,
      alasan: `${jumlahAlpaBulanIni} kali tidak hadir tanpa keterangan dalam sebulan.`,
    };
  }
  if (jumlahAlpaBulanIni >= 3) {
    return {
      actionType: 'TEGURAN',
      poin: POIN_BAKU.TEGURAN,
      alasan: `${jumlahAlpaBulanIni} kali tidak hadir tanpa keterangan dalam sebulan.`,
    };
  }
  return null;
}
