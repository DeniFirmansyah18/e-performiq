/**
 * Asisten AI Direksi (#4).
 *
 * Tiga pertanyaan BOD: persentase visi-misi tercapai, cari pegawai + kinerja
 * (mis. "Tono"), dan rekomendasi MPP/rekrut/KPI.
 *
 * Aturan penting (sesuai arahan user): ANGKA selalu dihitung deterministik di
 * sini dari basis data. Model AI hanya diberi angka itu untuk ditafsirkan
 * menjadi kalimat dan saran — dengan larangan mengarang angka di prompt.
 * Bila tidak ada provider AI / semua gagal, field `rekomendasi` bernilai null
 * dan UI menampilkan angka apa adanya (tidak ada narasi palsu).
 */

export interface KpiUntukHitung {
  bobot: number;
  target: number | null;
  realisasi: number | null;
}

export interface PersentaseVisiMisi {
  persentase: number;
  jumlahKpiTersambung: number;
  jumlahIndikator: number;
  jumlahBerbobot: number;
  catatan: string | null;
}

/**
 * Persentase pencapaian visi & misi dari BOBOT KPI yang tercapai.
 *
 * Rumus: SUM(bobot x rasioCapaian) / SUM(bobot) x 100, dengan rasio dibatasi
 * 0-1 dan hasil dibatasi 0-100. Sasaran tanpa target/realisasi dihitung 0
 * (bukan dilewati) agar persentase tidak terlihat lebih tinggi dari kenyataan.
 */
export function hitungPersentaseVisiMisi(kpis: KpiUntukHitung[]): PersentaseVisiMisi {
  if (!Array.isArray(kpis) || kpis.length === 0) {
    return {
      persentase: 0,
      jumlahKpiTersambung: 0,
      jumlahIndikator: 0,
      jumlahBerbobot: 0,
      catatan: 'Belum ada sasaran KPI, persentase belum dapat dihitung.',
    };
  }

  let bobotTotal = 0;
  let capaianTerbobot = 0;
  let berbobot = 0;
  let tersambung = 0;
  let tanpaUkuran = 0;

  for (const k of kpis) {
    const bobot = Number.isFinite(k.bobot) && k.bobot > 0 ? k.bobot : 0;
    bobotTotal += bobot;
    if (bobot > 0) berbobot += 1;

    const adaUkuran = k.target != null && Number(k.target) > 0 && k.realisasi != null;
    if (!adaUkuran) {
      tanpaUkuran += 1;
      continue;
    }
    tersambung += 1;
    const rasio = Math.max(0, Math.min(1, Number(k.realisasi) / Number(k.target)));
    capaianTerbobot += bobot * rasio;
  }

  const persentase = bobotTotal > 0 ? Math.round((capaianTerbobot / bobotTotal) * 1000) / 10 : 0;

  let catatan: string | null = null;
  if (tanpaUkuran > 0) {
    catatan =
      `${tanpaUkuran} sasaran belum memiliki target atau realisasi sehingga dihitung 0. ` +
      'Lengkapi ukurannya agar persentase mencerminkan kinerja sebenarnya.';
  }

  return {
    persentase: Math.max(0, Math.min(100, persentase)),
    jumlahKpiTersambung: tersambung,
    jumlahIndikator: kpis.length,
    jumlahBerbobot: berbobot,
    catatan,
  };
}
