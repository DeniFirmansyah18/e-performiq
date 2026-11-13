/**
 * Alur KPI berjenjang (cascading) BOD → HR → People Manager → Pegawai.
 *
 * Rantai yang ADA di basis data:
 *   strategic_pillars (pilar strategis / visi-misi)
 *     └── corporate_kpis   ← ditetapkan BOD untuk perusahaan
 *           └── division_kpis  ← diturunkan HR per DEPARTEMEN
 *                 └── individual_kpis  ← per pegawai (divalidasi HR & disetujui atasan)
 *                       └── kpi_indicators  ← indikator harian
 *
 * Yang BELUM ada: penurunan division_kpis ke PEOPLE MANAGER secara eksplisit
 * (tabel kini hanya terhubung ke departemen) dan penurunan ke per-POSISI.
 * Modul ini mendefinisikan rantai itu secara eksplisit dan memeriksa apakah
 * sebuah KPI masih tersambung sampai ke pilar strategis — sehingga dapat
 * dipastikan seluruh target karyawan benar-benar mendukung visi & misi.
 */

export type TingkatKpi = 'PERUSAHAAN' | 'DEPARTEMEN' | 'MANAJER' | 'POSISI' | 'INDIVIDU';

export const LABEL_TINGKAT: Record<TingkatKpi, string> = {
  PERUSAHAAN: 'Perusahaan (BOD)',
  DEPARTEMEN: 'Departemen (HR)',
  MANAJER: 'People Manager',
  POSISI: 'Posisi',
  INDIVIDU: 'Individu (Pegawai)',
};

/** Siapa yang berwenang menetapkan KPI pada tiap tingkat. */
export const PENETAP_TINGKAT: Record<TingkatKpi, string[]> = {
  PERUSAHAAN: ['BOD', 'SUPER_ADMIN'],
  DEPARTEMEN: ['HR_MANAGER', 'SUPER_ADMIN'],
  MANAJER: ['HR_MANAGER', 'PEOPLE_MANAGER', 'SUPER_ADMIN'],
  POSISI: ['HR_MANAGER', 'PEOPLE_MANAGER', 'SUPER_ADMIN'],
  INDIVIDU: ['EMPLOYEE', 'PEOPLE_MANAGER', 'HR_MANAGER', 'SUPER_ADMIN'],
};

/**
 * Apakah peran boleh menurunkan KPI dari tingkat `dari` ke tingkat `ke`.
 *
 * Alur jabatan yang dianut: BOD → HR → People Manager → Pegawai.
 */
export function bolehTurunkan(peran: string, dari: TingkatKpi, ke: TingkatKpi): boolean {
  const urutan: TingkatKpi[] = ['PERUSAHAAN', 'DEPARTEMEN', 'MANAJER', 'POSISI', 'INDIVIDU'];
  const iDari = urutan.indexOf(dari);
  const iKe = urutan.indexOf(ke);
  // Hanya boleh menurunkan satu langkah ke bawah.
  if (iKe !== iDari + 1) return false;

  const pengecualian: Record<string, [TingkatKpi, TingkatKpi][]> = {
    BOD: [['PERUSAHAAN', 'DEPARTEMEN']],
    HR_MANAGER: [
      ['DEPARTEMEN', 'MANAJER'],
      ['MANAJER', 'POSISI'],
      ['POSISI', 'INDIVIDU'],
    ],
    PEOPLE_MANAGER: [
      ['MANAJER', 'POSISI'],
      ['POSISI', 'INDIVIDU'],
    ],
    SUPER_ADMIN: [
      ['PERUSAHAAN', 'DEPARTEMEN'],
      ['DEPARTEMEN', 'MANAJER'],
      ['MANAJER', 'POSISI'],
      ['POSISI', 'INDIVIDU'],
    ],
  };
  return (pengecualian[peran] ?? []).some(([a, b]) => a === dari && b === ke);
}

export interface MataRantai {
  /** Kode KPI pada tingkat tersebut. */
  kode: string;
  judul: string;
  tingkat: TingkatKpi;
  target?: number | null;
  satuan?: string | null;
  /** Kode KPI induk (tingkat di atasnya). */
  induk?: string | null;
  /** Pegawai/departemen pemilik, bila relevan. */
  pemilik?: string | null;
}

export interface HasilTelaahRantai {
  /** KPI yang rantainya tersambung sampai pilar strategis. */
  tersambung: MataRantai[];
  /** KPI yang rantainya PUTUS — tidak mendukung visi/misi. */
  putus: Array<{ kode: string; judul: string; tingkat: TingkatKpi; alasan: string }>;
  /** Jumlah langkah terlama dari pilar ke KPI. */
  kedalamanMaksimal: number;
  /** Ringkasan siap tampil. */
  kesimpulan: string;
}

/**
 * Telusuri apakah setiap KPI individu tersambung ke pilar strategis.
 *
 * `rantai` berisi KPI dari semua tingkat yang sudah dihubungkan lewat `induk`.
 * KPI tanpa induk pada tingkat selain PERUSAHAAN dianggap putus.
 */
export function telaahRantai(rantai: MataRantai[]): HasilTelaahRantai {
  const perKode = new Map(rantai.map((k) => [k.kode, k]));
  const tersambung: MataRantai[] = [];
  const putus: HasilTelaahRantai['putus'] = [];
  let kedalamanMaksimal = 0;

  for (const k of rantai) {
    // Telusuri ke atas sampai akar.
    let langkah = 0;
    let kini: MataRantai | undefined = k;
    const terlihat = new Set<string>();

    while (kini) {
      if (terlihat.has(kini.kode)) {
        // Rantai melingkar: dua KPI saling menjadi induk. Ini kesalahan data
        // dan HARUS dilaporkan putus, bukan dianggap selesai.
        putus.push({
          kode: k.kode,
          judul: k.judul,
          tingkat: k.tingkat,
          alasan: 'Rantai KPI melingkar (induk saling menunjuk) — periksa penetapan induk.',
        });
        break;
      }
      terlihat.add(kini.kode);
      langkah++;

      if (!kini.induk) {
        if (kini.tingkat === 'PERUSAHAAN') {
          tersambung.push(k);
          kedalamanMaksimal = Math.max(kedalamanMaksimal, langkah);
        } else {
          putus.push({
            kode: k.kode,
            judul: k.judul,
            tingkat: k.tingkat,
            alasan: `Tidak tersambung ke pilar strategis (berhenti di tingkat ${LABEL_TINGKAT[kini.tingkat]}).`,
          });
        }
        break;
      }

      const induk = perKode.get(kini.induk);
      if (!induk) {
        putus.push({
          kode: k.kode,
          judul: k.judul,
          tingkat: k.tingkat,
          alasan: `KPI induk '${kini.induk}' tidak ditemukan.`,
        });
        break;
      }
      kini = induk;
    }
  }

  const kesimpulan =
    putus.length === 0
      ? `Seluruh ${tersambung.length} KPI tersambung ke pilar strategis (kedalaman maksimal ${kedalamanMaksimal} tingkat).`
      : `${putus.length} dari ${rantai.length} KPI belum tersambung ke visi & misi perusahaan.`;

  return { tersambung, putus, kedalamanMaksimal, kesimpulan };
}

/**
 * Saran jumlah KPI per tingkat agar rantai tidak terlalu panjang.
 *
 * Pedoman praktis: BOD 3-5 KPI korporat, HR 2-4 per departemen, People Manager
 * 2-4 per posisi, pegawai 3-5 KPI individu.
 */
export const SARAN_JUMLAH_KPI: Record<TingkatKpi, { min: number; maks: number }> = {
  PERUSAHAAN: { min: 3, maks: 5 },
  DEPARTEMEN: { min: 2, maks: 4 },
  MANAJER: { min: 2, maks: 4 },
  POSISI: { min: 2, maks: 4 },
  INDIVIDU: { min: 3, maks: 5 },
};

/** Apakah jumlah KPI pada tingkat tertentu wajar. */
export function jumlahWajar(tingkat: TingkatKpi, jumlah: number): boolean {
  const s = SARAN_JUMLAH_KPI[tingkat];
  return jumlah >= s.min && jumlah <= s.maks;
}
