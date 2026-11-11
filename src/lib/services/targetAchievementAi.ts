import type { Db } from '@/lib/db/client';
import { generateContent } from './aiService';
import { bersihkanTeksAi } from '@/lib/utils/bersihkanTeksAi';

export { bersihkanTeksAi };

/** Satu baris capaian departemen, sesuai yang dikirim API target-achievement. */
export interface DepartemenCapaian {
  departmentId: string;
  departmentName: string;
  averagePercentage: number;
  employeeCount: number;
  kpiCount: number;
}

export interface RingkasanCapaian {
  scopeLevel: string;
  overallPercentage: number;
  targetCount: number;
  achievedCount: number;
  departments: DepartemenCapaian[];
}

/**
 * Menyusun prompt untuk AI dengan data capaian per departemen.
 *
 * Departemen diurutkan dari capaian terendah agar model fokus pada bagian yang
 * paling butuh tindakan — tujuan analisis ini adalah rekomendasi keputusan,
 * bukan sekadar ringkasan.
 */
export function susunPromptCapaianTarget(ringkasan: RingkasanCapaian): string {
  const urut = [...(ringkasan.departments ?? [])]
    .filter((d) => d && typeof d.averagePercentage === 'number')
    .sort((a, b) => a.averagePercentage - b.averagePercentage);

  const baris = urut.map(
    (d, i) =>
      `${i + 1}. ${d.departmentName} — capaian ${d.averagePercentage.toFixed(1)}% ` +
      `(${d.employeeCount} karyawan aktif, ${d.kpiCount} sasaran terukur)`
  );

  const daftar = baris.length > 0 ? baris.join('\n') : '(belum ada data departemen)';

  return [
    'Anda penasihat HRD. Berikut data capaian target organisasi dari sistem.',
    '',
    `Capaian keseluruhan: ${ringkasan.overallPercentage.toFixed(1)}%`,
    `Sasaran tercapai: ${ringkasan.achievedCount} dari ${ringkasan.targetCount}`,
    '',
    'Capaian per departemen (diurutkan dari yang paling rendah):',
    daftar,
    '',
    'Tugas Anda:',
    '1. Sebutkan maksimal tiga departemen yang paling perlu perhatian, lengkap dengan persentasenya.',
    '2. Untuk tiap departemen, tuliskan LANGKAH rekomendasi yang berurutan dan bisa langsung',
    '   dijalankan HR — bukan hanya satu kalimat ringkas. Gunakan penomoran bertahap:',
    '   "Langkah 1", "Langkah 2", "Langkah 3". Tiap langkah sebutkan siapa yang mengerjakan',
    '   dan hasil apa yang diharapkan.',
    '3. Bila ada departemen yang capaiannya sudah baik, tuliskan juga langkah menjaga',
    '   capaiannya, bukan hanya "pertahankan".',
    '',
    'Aturan penulisan:',
    '- Gunakan Bahasa Indonesia sederhana yang mudah dipahami HRD pemula.',
    '- Hindari istilah teknis berlebihan; bila perlu, jelaskan dalam tanda kurung.',
    '- JANGAN memakai penanda markdown seperti ** (tanda bintang ganda), __ , ###, atau backtick.',
    '  Tulis teks biasa saja.',
    '- Jangan mengarang angka yang tidak ada pada data di atas.',
    '- Jangan memakai emoji atau simbol hiasan.',
  ].join('\n');
}


export interface AnalisisCapaianHasil {
  insight: string;
  configured: boolean;
  failed: boolean;
}

/**
 * Meminta rekomendasi tindakan dari AI berdasarkan capaian target.
 * Aman dipanggil walau AI belum dikonfigurasi: hasilnya tetap berupa teks
 * petunjuk, bukan error.
 */
export async function analisisCapaianTarget(
  _db: Db,
  ringkasan: RingkasanCapaian,
  role: string
): Promise<AnalisisCapaianHasil> {
  const hint =
    role === 'HR_MANAGER'
      ? 'Pengguna adalah HR Manager; fokus pada kebijakan dan pendampingan.'
      : `Peran pengguna: ${role}.`;

  const res = await generateContent(`${susunPromptCapaianTarget(ringkasan)}\n\nKonteks pengguna: ${hint}`, {
    maxOutputTokens: 900,
    temperature: 0.3,
  });

  return {
    // Bersihkan penanda markdown di server agar klien menerima teks bersih.
    insight: bersihkanTeksAi(res.text),
    configured: res.configured,
    failed: Boolean(res.error),
  };
}
