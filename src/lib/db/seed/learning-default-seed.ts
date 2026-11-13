/**
 * Materi + kuis untuk kursus default onboarding.
 *
 * Kuis dibuat OTOMATIS dari isi materi: tiap modul teks menghasilkan satu soal
 * pilihan ganda yang jawabannya diambil dari kalimat materi itu sendiri, lalu
 * ditambah satu modul QUIZ berisi soal-soal tersebut. Dengan begitu
 * pertanyaan selalu konsisten dengan materi yang dibaca karyawan — tidak ada
 * soal yang menanyakan hal di luar materinya.
 */

import type { SqlClient } from '@/lib/db/client';

export interface MateriDefault {
  title: string;
  /** Isi materi; satu kalimat per baris memudahkan pembuatan soal. */
  paragraf: string[];
}

export interface KursusDefault {
  courseCode: string;
  materi: MateriDefault[];
  /** Pertanyaan penutup (khas kursus), jawabannya indeks 0. */
  kuisPenutup: Array<{ text: string; options: string[] }>;
}

/** Bentuk soal yang disimpan pada content_body modul QUIZ. */
interface Soal {
  text: string;
  options: string[];
}

/** Buang kata depan yang membuat soal janggal bila ditaruh sebagai jawaban. */
function rapikanJawaban(kalimat: string): string {
  return kalimat
    .replace(/^(Adalah|Yaitu|Merupakan|Bahwa)\s+/i, '')
    .replace(/\.$/, '')
    .trim();
}

/**
 * Susun satu soal pilihan ganda dari sebuah kalimat materi.
 *
 * Kalimat dipakai sebagai pertanyaan ("Manakah yang benar tentang …?"), dan
 * jawaban benar adalah kalimat itu sendiri; pengecoh diambil dari kalimat
 * materi LAIN pada kursus yang sama sehingga tetap masuk akal dan tidak
 * menjebak.
 */
export function soalDariMateri(
  kalimat: string,
  semuaKalimat: string[],
  seed: number
): Soal | null {
  const m = kalimat.trim();
  if (m.length < 15) return null;

  const benar = rapikanJawaban(m);
  const pengecoh = semuaKalimat
    .map((k) => rapikanJawaban(k.trim()))
    .filter((k) => k && k !== benar && k.length >= 10);

  if (pengecoh.length < 3) return null;

  // Pilih tiga pengecoh secara deterministik agar seed idempoten.
  const opsi = [benar];
  for (let i = 0; i < 3; i++) {
    const idx = (seed * 7 + i * 3 + 1) % pengecoh.length;
    const calon = pengecoh[idx];
    if (!opsi.includes(calon)) opsi.push(calon);
  }
  // Lengkapi bila ada pengecoh duplikat.
  for (const p of pengecoh) {
    if (opsi.length >= 4) break;
    if (!opsi.includes(p)) opsi.push(p);
  }
  if (opsi.length < 4) return null;

  return {
    text: `Manakah pernyataan yang benar tentang "${ringkasJudul(m)}"?`,
    options: opsi,
  };
}

/**
 * Ambil frasa inti kalimat sebagai judul rujukan pertanyaan.
 *
 * Dulu dipakai enam kata pertama sehingga pertanyaan menjadi panjang dan
 * terpotong ("… menurut materi \"Perusahaan didirikan unt\""). Sekarang
 * diambil sampai tanda hubung/awal penjelasan agar terbaca utuh.
 */
function ringkasJudul(kalimat: string): string {
  const inti = kalimat
    .replace(/\.$/, '')
    // Potong sebelum kata penjelas agar frasa tetap bermakna.
    .split(/\s+(?:berarti|adalah|yaitu|merupakan|dilakukan|diterapkan|wajib|terdiri|bertugas|diterbitkan|hanya)\s+/i)[0]
    .trim();
  const kata = inti.split(/\s+/);
  const hasil = kata.slice(0, 4).join(' ');
  return hasil.replace(/[.,;:]$/, '');
}

/**
 * Bangun seluruh modul (materi + satu modul QUIZ) untuk sebuah kursus default.
 */
export function bangunModulKursusDefault(kursus: KursusDefault): Array<{
  title: string;
  orderIndex: number;
  contentType: 'TEXT' | 'QUIZ';
  contentBody: string;
  quizKey: Array<{ q: number; a: number }> | null;
}> {
  const semuaKalimat = kursus.materi.flatMap((m) => m.paragraf);

  const modul: Array<{
    title: string;
    orderIndex: number;
    contentType: 'TEXT' | 'QUIZ';
    contentBody: string;
    quizKey: Array<{ q: number; a: number }> | null;
  }> = kursus.materi.map((m, i) => ({
    title: m.title,
    orderIndex: i + 1,
    contentType: 'TEXT',
    contentBody: m.paragraf.join(' '),
    quizKey: null,
  }));

  // Kuis: soal dari materi + soal penutup, jawaban selalu opsi pertama.
  const soal: Soal[] = [];
  let seed = 1;
  for (const kalimat of semuaKalimat) {
    const s = soalDariMateri(kalimat, semuaKalimat, seed++);
    if (s) soal.push(s);
    if (soal.length >= 3) break;
  }
  soal.push(...kursus.kuisPenutup);

  modul.push({
    title: 'Kuis Pemahaman Materi',
    orderIndex: kursus.materi.length + 1,
    contentType: 'QUIZ',
    contentBody: JSON.stringify({ questions: soal }),
    quizKey: soal.map((_, i) => ({ q: i + 1, a: 0 })),
  });

  return modul;
}

/** Isi kursus default yang di-seed (materi + kuis). */
export const KURSUS_DEFAULT: KursusDefault[] = [
  {
    courseCode: 'ONB-101',
    materi: [
      {
        title: 'Mengenal Perusahaan',
        paragraf: [
          'Perusahaan didirikan untuk memberikan layanan terbaik bagi pelanggan dengan menjunjung tata kelola yang baik.',
          'Struktur organisasi terdiri atas Dewan Direksi, Human Capital, Teknologi, dan Satuan Pengawas Internal.',
          'Setiap karyawan baru wajib memahami visi, misi, dan nilai perusahaan pada masa orientasi.',
        ],
      },
      {
        title: 'Tata Kelola & Kepatuhan',
        paragraf: [
          'Tata kelola perusahaan menerapkan prinsip transparansi, akuntabilitas, tanggung jawab, independensi, dan kewajaran.',
          'Setiap dugaan pelanggaran wajib dilaporkan melalui saluran pelaporan resmi perusahaan.',
          'Dokumen resmi perusahaan hanya boleh dibagikan kepada pihak yang berwenang.',
        ],
      },
      {
        title: 'Sistem Kerja & Komunikasi',
        paragraf: [
          'Komunikasi resmi dilakukan melalui surel perusahaan, bukan akun pribadi.',
          'Setiap pekerjaan dicatat dalam sistem agar dapat ditelusuri dan dinilai secara objektif.',
          'Atasan langsung bertugas memantau dan membimbing karyawan di departemennya.',
        ],
      },
    ],
    kuisPenutup: [
      {
        text: 'Apa yang harus dilakukan bila menemukan dugaan pelanggaran kode etik?',
        options: ['Melaporkan melalui saluran resmi perusahaan', 'Menyimpan untuk diri sendiri', 'Membahas di media sosial', 'Menunggu sampai ada yang bertanya'],
      },
    ],
  },
  {
    courseCode: 'AKHLAK-CULTURE',
    materi: [
      {
        title: 'Nilai AKHLAK',
        paragraf: [
          'Amanah berarti memegang teguh kepercayaan yang diberikan dengan penuh tanggung jawab.',
          'Kompeten berarti terus belajar dan meningkatkan kemampuan demi hasil kerja terbaik.',
          'Harmonis berarti saling peduli dan menghargai perbedaan antar rekan kerja.',
        ],
      },
      {
        title: 'Loyal, Adaptif & Kolaboratif',
        paragraf: [
          'Loyal berarti menjaga nama baik perusahaan dan mengutamakan kepentingan bersama.',
          'Adaptif berarti cepat menyesuaikan diri terhadap perubahan dan tantangan baru.',
          'Kolaboratif berarti membangun kerja sama yang sinergis untuk mencapai tujuan bersama.',
        ],
      },
      {
        title: 'Penerapan Sehari-hari',
        paragraf: [
          'Nilai AKHLAK diterapkan dalam interaksi kerja, pengambilan keputusan, dan penanganan konflik kepentingan.',
          'Konflik kepentingan wajib diungkapkan kepada atasan agar keputusan tetap objektif.',
        ],
      },
    ],
    kuisPenutup: [
      {
        text: 'Mana yang termasuk perilaku AKHLAK dalam kerja sehari-hari?',
        options: ['Mengungkapkan konflik kepentingan kepada atasan', 'Menutupi kesalahan tim', 'Bekerja sendiri tanpa koordinasi', 'Mengabaikan perubahan kebijakan'],
      },
    ],
  },
];

/**
 * Seed materi & kuis untuk kursus default.
 *
 * Idempoten: modul lama pada kursus tersebut diganti isinya, sehingga
 * menjalankan seed berulang tidak menggandakan materi.
 */
export async function seedMateriKursusDefault(client: SqlClient): Promise<void> {
  for (const kursus of KURSUS_DEFAULT) {
    const c = await client.query<{ id: number }>(
      'SELECT id FROM moodle_courses WHERE course_code = $1',
      [kursus.courseCode]
    );
    const courseId = c.rows[0]?.id;
    if (!courseId) continue;

    // Bersihkan modul lama agar tidak menggandakan/menyisakan materi usang.
    await client.query('DELETE FROM course_modules WHERE course_id = $1', [courseId]);

    const modul = bangunModulKursusDefault(kursus);
    for (const m of modul) {
      await client.query(
        `INSERT INTO course_modules (course_id, title, order_index, content_type, content_body, quiz_key)
         VALUES ($1, $2, $3, $4::content_type_enum, $5, $6::jsonb)`,
        [
          courseId,
          m.title,
          m.orderIndex,
          m.contentType,
          m.contentBody,
          m.quizKey ? JSON.stringify(m.quizKey) : null,
        ]
      );
    }
  }
}

/** Kode kursus yang isinya dibangkitkan seed ini. */
export const KODE_KURSUS_DEFAULT = KURSUS_DEFAULT.map((k) => k.courseCode);
