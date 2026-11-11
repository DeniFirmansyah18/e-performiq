import type { Db } from '@/lib/db/client';
import { generateContent } from './aiService';

export interface RingkasanPegawaiAi {
  profil: {
    fullName: string;
    employeeCode: string;
    departmentName: string | null;
    positionTitle: string | null;
    status: string | null;
    masaKerja: string | null;
    managerName: string | null;
    directReportCount: number;
  };
  gpaTerakhir: number | null;
  ratingTerakhir: string | null;
  jumlahKpi: number;
  capaianRataRata: number | null;
  jumlahIndikatorHarian: number;
  dokumen: Array<{ documentType: string; verificationStatus: string }>;
  bpjsAda: boolean;
}

/**
 * Menyusun prompt analisis untuk satu pegawai.
 *
 * Nada prompt menyesuaikan kondisi kinerja: bila capaian tinggi, HR diarahkan
 * mempertahankan dan mengembangkan; bila rendah, ke perbaikan. Bagian berkas
 * selalu disertakan karena kelengkapan dokumen sering menjadi penghambat
 * administrasi kepegawaian.
 */
export function susunPromptDetailPegawai(r: RingkasanPegawaiAi): string {
  const p = r.profil;
  const capaian = r.capaianRataRata;
  const tinggi = capaian !== null && capaian >= 90;
  const rendah = capaian !== null && capaian < 75;

  const dokBelum = r.dokumen.filter((d) => d.verificationStatus !== 'VERIFIED');
  const daftarDok =
    r.dokumen.length === 0
      ? 'Belum ada berkas yang tercatat.'
      : r.dokumen
          .map((d) => `- ${d.documentType}: ${d.verificationStatus === 'VERIFIED' ? 'terverifikasi' : `status ${d.verificationStatus}`}`)
          .join('\n');

  const arahan = tinggi
    ? 'Capaian kinerjanya sudah tinggi. Beri cara MEMPERTAHANKAN dan mengembangkan kinerja tersebut (mis. pengayaan peran, mentoring, jalur karier).'
    : rendah
    ? 'Capaian kinerjanya masih rendah. Beri rekomendasi PERBAIKAN dan peningkatan yang bisa dijalankan HR bersama atasannya.'
    : 'Capaian kinerjanya sedang. Beri rekomendasi agar naik ke tingkat berikutnya sekaligus menjaga yang sudah baik.';

  return [
    'Anda penasihat HRD. Berikut data seorang pegawai dari sistem kepegawaian.',
    '',
    `Nama: ${p.fullName} (NIP ${p.employeeCode})`,
    `Jabatan: ${p.positionTitle ?? 'belum diisi'}`,
    `Departemen: ${p.departmentName ?? 'belum diisi'}`,
    `Status kepegawaian: ${p.status ?? 'belum diisi'}`,
    `Masa kerja: ${p.masaKerja ?? 'belum diketahui'}`,
    `Atasan langsung: ${p.managerName ?? 'tidak ada'}`,
    `Jumlah bawahan langsung: ${p.directReportCount}`,
    '',
    'Data kinerja:',
    `- Nilai kinerja keseluruhan (GPA): ${r.gpaTerakhir ?? 'belum dinilai'}`,
    `- Peringkat terakhir: ${r.ratingTerakhir ?? 'belum ada'}`,
    `- Jumlah sasaran KPI: ${r.jumlahKpi}`,
    `- Rata-rata capaian KPI: ${capaian === null ? 'belum ada' : `${capaian.toFixed(1)}%`}`,
    `- Entri indikator harian: ${r.jumlahIndikatorHarian}`,
    `- Data BPJS: ${r.bpjsAda ? 'tersedia' : 'belum ada'}`,
    '',
    'Kelengkapan berkas:',
    daftarDok,
    dokBelum.length > 0
      ? `Berkas belum terverifikasi: ${dokBelum.map((d) => d.documentType).join(', ')}.`
      : 'Semua berkas yang tercatat sudah terverifikasi.',
    '',
    'Tugas Anda:',
    `1. ${arahan}`,
    '2. Sebutkan berkas atau data kepegawaian yang masih kurang atau perlu dilengkapi.',
    '3. Beri maksimal tiga langkah tindakan yang bisa langsung dijalankan HR.',
    '',
    'Aturan penulisan:',
    '- Gunakan Bahasa Indonesia sederhana dan mudah dipahami HRD pemula.',
    '- Tulis sebagai daftar bernomor singkat, maksimal 6 poin.',
    '- Jangan mengarang angka atau data yang tidak ada di atas.',
    '- Jangan memakai emoji atau simbol hiasan.',
  ].join('\n');
}

export interface AnalisisDetailHasil {
  insight: string;
  configured: boolean;
  failed: boolean;
}

/** Meminta rekomendasi tindakan HR untuk satu pegawai. */
export async function analisisDetailPegawai(
  _db: Db,
  ringkasan: RingkasanPegawaiAi,
  role: string
): Promise<AnalisisDetailHasil> {
  const hint =
    role === 'HR_MANAGER'
      ? 'Pengguna adalah HR Manager; fokus pada kebijakan, pendampingan, dan kelengkapan administrasi.'
      : `Peran pengguna: ${role}.`;

  const res = await generateContent(`${susunPromptDetailPegawai(ringkasan)}\n\nKonteks pengguna: ${hint}`, {
    maxOutputTokens: 900,
    temperature: 0.3,
  });

  return {
    insight: res.text,
    configured: res.configured,
    failed: Boolean(res.error),
  };
}
