/**
 * Bank soal asesmen (WS-6). Dipisah dari seed utama agar mudah diperluas.
 *
 * Menyediakan:
 *  - 1 template PSIKOMETRI (IPIP subset, Big Five / OCEAN) — Likert 5 titik.
 *  - 1 template TEKNIS (MCQ — logika, SQL, dasar pemrograman, kuantitatif).
 *  - 1 template INTERVIEW (Open — untuk input skor HR; tidak dijawab kandidat).
 *
 * Semua data idempoten (ON CONFLICT DO NOTHING) via id tetap.
 */

export interface SeedQuestion {
  id: string;
  order: number;
  type: 'MCQ' | 'LIKERT' | 'CODING' | 'OPEN';
  prompt: string;
  options?: Array<{ key: string; label: string; score?: number }>;
  correctKey?: string;
  scale?: string;
  reverse?: boolean;
  source?: string;
  sourceRef?: string;
}

export interface SeedTemplate {
  id: string;
  code: string;
  title: string;
  type: 'PSYCHOMETRIC' | 'TECHNICAL' | 'INTERVIEW';
  weight: number;
  description: string;
  questions: SeedQuestion[];
}

// Likert 5 titik (skor 1..5).
const LIKERT_5 = [
  { key: '1', label: 'Sangat Tidak Setuju', score: 1 },
  { key: '2', label: 'Tidak Setuju', score: 2 },
  { key: '3', label: 'Netral', score: 3 },
  { key: '4', label: 'Setuju', score: 4 },
  { key: '5', label: 'Sangat Setuju', score: 5 },
];

/**
 * IPIP subset (item domain Big Five). Beberapa item bersifat *reverse scored*.
 * Label domain: O=Openness, C=Conscientiousness, E=Extraversion,
 * A=Agreeableness, N=Neuroticism (Emotional Stability di-*reverse*).
 */
const IPIP_ITEMS: Array<{ domain: string; prompt: string; reverse?: boolean }> = [
  { domain: 'O', prompt: 'Saya memiliki imajinasi yang hidup dan suka ide-ide baru.' },
  { domain: 'O', prompt: 'Saya tertarik mempelajari hal-hal yang belum saya pahami.' },
  { domain: 'O', prompt: 'Saya sulit membayangkan hal-hal abstrak.', reverse: true },
  { domain: 'O', prompt: 'Saya menikmati diskusi filosofis atau konseptual.' },
  { domain: 'C', prompt: 'Saya menyelesaikan pekerjaan tepat waktu dan teliti.' },
  { domain: 'C', prompt: 'Saya sering menunda pekerjaan hingga menit terakhir.', reverse: true },
  { domain: 'C', prompt: 'Saya menyiapkan rencana sebelum memulai tugas besar.' },
  { domain: 'C', prompt: 'Ruang kerja dan berkas saya selalu rapi dan teratur.' },
  { domain: 'E', prompt: 'Saya mudah memulai percakapan dengan orang baru.' },
  { domain: 'E', prompt: 'Saya lebih suka bekerja sendiri daripada dalam kelompok.', reverse: true },
  { domain: 'E', prompt: 'Saya merasa bersemangat berada di tengah banyak orang.' },
  { domain: 'E', prompt: 'Saya cenderung pendiam ketika berada di lingkungan baru.', reverse: true },
  { domain: 'A', prompt: 'Saya peduli dan berusaha memahami perasaan orang lain.' },
  { domain: 'A', prompt: 'Saya mudah memaafkan orang yang melakukan kesalahan.' },
  { domain: 'A', prompt: 'Saya sering berdebat dan sulit berkompromi.', reverse: true },
  { domain: 'A', prompt: 'Saya senang membantu rekan kerja yang kesulitan.' },
  { domain: 'N', prompt: 'Saya mudah merasa cemas atau khawatir.' },
  { domain: 'N', prompt: 'Saya tetap tenang menghadapi tekanan pekerjaan.', reverse: true },
  { domain: 'N', prompt: 'Perasaan saya mudah berubah-ubah.', reverse: true },
  { domain: 'N', prompt: 'Saya jarang merasa sedih atau murung.', reverse: true },
];

const PSYCHOMETRIC_QUESTIONS: SeedQuestion[] = IPIP_ITEMS.map((it, i) => ({
  id: `c1000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  order: i + 1,
  type: 'LIKERT',
  prompt: it.prompt,
  options: LIKERT_5,
  scale: `BIG5-${it.domain}`,
  reverse: it.reverse ?? false,
  source: 'IPIP',
  sourceRef: 'IPIP-NEO-120 (subset)',
}));

const TECHNICAL_QUESTIONS: SeedQuestion[] = [
  {
    id: 'c2000000-0000-4000-8000-000000000001',
    order: 1,
    type: 'MCQ',
    prompt: 'Manakah pernyataan SQL yang benar untuk mengambil 10 karyawan dengan gaji tertinggi?',
    options: [
      { key: 'A', label: 'SELECT * FROM employees LIMIT 10 ORDER BY salary DESC;' },
      { key: 'B', label: 'SELECT * FROM employees ORDER BY salary DESC LIMIT 10;' },
      { key: 'C', label: 'SELECT TOP 10 * FROM employees ORDER BY salary;' },
      { key: 'D', label: 'SELECT * FROM employees WHERE salary > 10 ORDER BY salary;' },
    ],
    correctKey: 'B',
    source: 'CUSTOM',
  },
  {
    id: 'c2000000-0000-4000-8000-000000000002',
    order: 2,
    type: 'MCQ',
    prompt: 'Berapakah kompleksitas waktu rata-rata pencarian pada Binary Search Tree yang seimbang?',
    options: [
      { key: 'A', label: 'O(1)' },
      { key: 'B', label: 'O(log n)' },
      { key: 'C', label: 'O(n)' },
      { key: 'D', label: 'O(n log n)' },
    ],
    correctKey: 'B',
    source: 'CUSTOM',
  },
  {
    id: 'c2000000-0000-4000-8000-000000000003',
    order: 3,
    type: 'MCQ',
    prompt: 'Seorang karyawan bekerja 8 jam dengan upah Rp50.000/jam. Bila lembur 1,5× untuk 2 jam tambahan, berapa total upahnya?',
    options: [
      { key: 'A', label: 'Rp 450.000' },
      { key: 'B', label: 'Rp 500.000' },
      { key: 'C', label: 'Rp 550.000' },
      { key: 'D', label: 'Rp 600.000' },
    ],
    correctKey: 'C',
    source: 'MMLU',
    sourceRef: 'kuantitatif-dasar',
  },
  {
    id: 'c2000000-0000-4000-8000-000000000004',
    order: 4,
    type: 'MCQ',
    prompt: 'Dalam HTTP, kode status 401 menunjukkan apa?',
    options: [
      { key: 'A', label: 'Sumber daya tidak ditemukan' },
      { key: 'B', label: 'Akses ditolak karena kredensial tidak valid/belum diautentikasi' },
      { key: 'C', label: 'Permintaan berhasil' },
      { key: 'D', label: 'Server mengalami kesalahan internal' },
    ],
    correctKey: 'B',
    source: 'CUSTOM',
  },
  {
    id: 'c2000000-0000-4000-8000-000000000005',
    order: 5,
    type: 'MCQ',
    prompt: 'Manakah yang BUKAN prinsip SOLID dalam pemrograman berorientasi objek?',
    options: [
      { key: 'A', label: 'Single Responsibility' },
      { key: 'B', label: 'Open/Closed' },
      { key: 'C', label: 'Dependency Inversion' },
      { key: 'D', label: 'Global State Management' },
    ],
    correctKey: 'D',
    source: 'CUSTOM',
  },
  {
    id: 'c2000000-0000-4000-8000-000000000006',
    order: 6,
    type: 'MCQ',
    prompt: 'Jika 3 mesin produksi menyelesaikan 300 unit dalam 2 jam, berapa unit yang diselesaikan 5 mesin dalam 1 jam (asumsi laju sama)?',
    options: [
      { key: 'A', label: '125 unit' },
      { key: 'B', label: '250 unit' },
      { key: 'C', label: '300 unit' },
      { key: 'D', label: '500 unit' },
    ],
    correctKey: 'B',
    source: 'CUSTOM',
  },
  {
    id: 'c2000000-0000-4000-8000-000000000007',
    order: 7,
    type: 'MCQ',
    prompt: 'Sebuah laporan menunjukkan penjualan naik 20% dari Rp250 juta. Berapa nilai penjualan baru?',
    options: [
      { key: 'A', label: 'Rp 270 juta' },
      { key: 'B', label: 'Rp 300 juta' },
      { key: 'C', label: 'Rp 320 juta' },
      { key: 'D', label: 'Rp 350 juta' },
    ],
    correctKey: 'B',
    source: 'CUSTOM',
  },
  {
    id: 'c2000000-0000-4000-8000-000000000008',
    order: 8,
    type: 'MCQ',
    prompt: 'Manakah yang paling tepat menggambarkan fungsi utama index pada basis data?',
    options: [
      { key: 'A', label: 'Menambah kapasitas penyimpanan' },
      { key: 'B', label: 'Mempercepat pencarian data dengan mengorbankan sedikit ruang & waktu tulis' },
      { key: 'C', label: 'Mengenkripsi seluruh tabel' },
      { key: 'D', label: 'Membuat backup otomatis' },
    ],
    correctKey: 'B',
    source: 'CUSTOM',
  },
];

const INTERVIEW_QUESTIONS: SeedQuestion[] = [
  {
    id: 'c3000000-0000-4000-8000-000000000001',
    order: 1,
    type: 'OPEN',
    prompt: 'Ceritakan pengalaman Anda menangani konflik dalam tim dan hasilnya.',
    source: 'CUSTOM',
  },
  {
    id: 'c3000000-0000-4000-8000-000000000002',
    order: 2,
    type: 'OPEN',
    prompt: 'Bagaimana Anda memprioritaskan pekerjaan ketika tenggat berdekatan?',
    source: 'CUSTOM',
  },
  {
    id: 'c3000000-0000-4000-8000-000000000003',
    order: 3,
    type: 'OPEN',
    prompt: 'Apa motivasi utama Anda melamar posisi ini?',
    source: 'CUSTOM',
  },
];

export const ASSESSMENT_TEMPLATES: SeedTemplate[] = [
  {
    id: 'c0000000-0000-4000-8000-000000000001',
    code: 'PSY-BIG5',
    title: 'Tes Psikometri (Big Five / IPIP)',
    type: 'PSYCHOMETRIC',
    weight: 30,
    description: 'Mengukur lima dimensi kepribadian (Keterbukaan, Kehati-hatian, Ekstraversi, Keramahan, Stabilitas Emosi).',
    questions: PSYCHOMETRIC_QUESTIONS,
  },
  {
    id: 'c0000000-0000-4000-8000-000000000002',
    code: 'TECH-GEN',
    title: 'Tes Teknis (Logika & Kuantitatif)',
    type: 'TECHNICAL',
    weight: 40,
    description: 'Soal pilihan ganda mencakup logika, basis data, algoritma, dan kuantitatif dasar.',
    questions: TECHNICAL_QUESTIONS,
  },
  {
    id: 'c0000000-0000-4000-8000-000000000003',
    code: 'INTV-STRUCT',
    title: 'Wawancara Terstruktur',
    type: 'INTERVIEW',
    weight: 30,
    description: 'Panduan wawancara terstruktur; skor diisi pewawancara (HR/Manager).',
    questions: INTERVIEW_QUESTIONS,
  },
];
