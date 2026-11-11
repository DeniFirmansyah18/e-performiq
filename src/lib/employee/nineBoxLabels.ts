import type { NineBoxQuadrant } from '@/types';

/**
 * Satu-satunya sumber teks untuk kesembilan kotak 9-Box.
 *
 * Dipakai oleh `NineBoxGrid`, halaman `/dashboard/ninebox-matrix`, dan
 * `faqData` agar nama kotak tidak pernah berbeda antar layar. Kode internal
 * (`FUTURE_LEADER`, dst.) TIDAK berubah — ini hanya lapisan tampilan.
 *
 * Nada penulisan untuk pembaca HRD pemula: bahasa Indonesia sehari-hari, tanpa
 * jargon, dan TIDAK mengasumsikan penyebab masalah. "Langkah pertama" adalah
 * sesuatu yang bisa langsung dilakukan; "Yang perlu dicek dulu" berupa
 * pertanyaan pemandu agar pembaca memeriksa sebelum memutuskan.
 */
export interface NineBoxCopy {
  /** Nama tampil, mis. 'Penggerak Inti'. */
  name: string;
  /** Subteks posisi, mis. 'potensi sedang · kinerja sedang'. */
  position: string;
  /** Satu kalimat awam yang selalu tampil di kotak (maks ~90 karakter). */
  short: string;
  /** Apa yang sedang terjadi pada orang di kotak ini. */
  happening: string;
  /** Satu tindakan konkret yang bisa langsung dilakukan. */
  firstStep: string;
  /** Pertanyaan pemandu sebelum memutuskan. */
  checkFirst: string;
  /** Label tombol aksi singkat di kotak. */
  shortAction: string;
}

export const NINE_BOX_COPY: Record<NineBoxQuadrant, NineBoxCopy> = {
  FUTURE_LEADER: {
    name: 'Pemimpin Masa Depan',
    position: 'siap naik level · hasil kerja tinggi',
    short: 'Sudah berprestasi dan mampu memegang tanggung jawab yang lebih besar.',
    happening:
      'Orang ini memberi hasil di atas target sekaligus menunjukkan kemampuan memimpin. Biasanya inilah kandidat utama untuk posisi yang lebih tinggi.',
    firstStep: 'Masukkan ke daftar kandidat promosi dan beri satu proyek lintas tim untuk menguji kesiapannya.',
    checkFirst:
      'Apakah posisi tujuannya sudah tersedia? Apakah dia masih nyaman bertahan jika promosinya baru bisa tahun depan?',
    shortAction: 'Siapkan promosi',
  },

  GROWTH_STAR: {
    name: 'Bintang Berkembang',
    position: 'siap naik level · hasil kerja sedang',
    short: 'Punya kapasitas lebih, hasil kerjanya masih bisa dinaikkan.',
    happening:
      'Kemampuan dan tanda untuk naik level sudah tampak, tetapi hasil kerjanya baru pada tingkat memadai. Penyebabnya belum diketahui — bisa karena kurang tantangan, bisa karena hambatan lain.',
    firstStep: 'Beri satu tanggung jawab tambahan yang lebih menantang dan sepakati targetnya bersama.',
    checkFirst:
      'Apakah targetnya sekarang terlalu mudah? Apakah dia butuh bimbingan teknis, bukan hanya tambahan tugas?',
    shortAction: 'Beri tantangan',
  },

  ENIGMA: {
    name: 'Siap Naik Level, Hasil Kerja Rendah',
    position: 'siap naik level · hasil kerja rendah',
    short: 'Mampu naik level, tapi hasil kerjanya sekarang masih di bawah target.',
    happening:
      'Orang ini punya kapasitas untuk naik level, tapi hasil kerjanya sekarang belum sesuai target.',
    firstStep:
      'Cek dulu apakah masalahnya beban kerja, peran yang tidak cocok, atau memang belum kompeten — jangan langsung simpulkan "tidak mampu".',
    checkFirst:
      'Apakah dia baru pindah peran? Apakah targetnya realistis? Apakah ada hambatan yang bukan salahnya?',
    shortAction: 'Telusuri penyebab',
  },

  HIGH_IMPACT: {
    name: 'Pakar Berdampak',
    position: 'cukup siap · hasil kerja tinggi',
    short: 'Hasil kerjanya tinggi dan keahliannya sulit digantikan.',
    happening:
      'Hasil kerjanya konsisten di atas target dengan keahlian yang mendalam. Tanda untuk naik ke jenjang berikutnya baru pada tingkat sedang.',
    firstStep: 'Beri pengakuan dan insentif yang membuatnya bertahan, lalu pastikan keahliannya dibagikan ke rekan lain.',
    checkFirst:
      'Apakah dia merasa kariernya mentok karena tidak diarahkan ke jabatan manajerial? Apakah beban kerjanya sudah berlebihan?',
    shortAction: 'Pertahankan',
  },

  CORE_PLAYER: {
    name: 'Penggerak Inti',
    position: 'cukup siap · hasil kerja sedang',
    short: 'Bekerja stabil sesuai target dan menjadi tulang punggung tim.',
    happening:
      'Orang ini mengerjakan tugasnya sesuai target secara konsisten. Inilah kelompok terbesar dan penopang operasional sehari-hari.',
    firstStep: 'Jaga kondisi kerjanya dan tawarkan pengembangan keterampilan yang sejalan dengan minatnya.',
    checkFirst:
      'Apakah dia sudah lama di posisi yang sama tanpa variasi? Apakah ada tanda mulai jenuh atau ingin pindah?',
    shortAction: 'Kembangkan',
  },

  DILEMMA: {
    name: 'Perlu Penyesuaian',
    position: 'cukup siap · hasil kerja rendah',
    short: 'Kemampuannya ada, tapi hasil kerjanya belum mencapai target.',
    happening:
      'Kemampuan dasarnya cukup, tetapi hasil kerjanya belum sesuai target. Bisa karena keterampilan yang belum lengkap, atau peran yang tidak cocok.',
    firstStep: 'Tetapkan satu atau dua keterampilan yang paling menghambat, lalu susun pelatihannya.',
    checkFirst:
      'Keterampilan apa yang paling kurang? Apakah tugasnya cocok dengan kemampuannya sekarang? Apakah targetnya perlu ditinjau ulang?',
    shortAction: 'Susun pelatihan',
  },

  TRUSTED_PRO: {
    name: 'Profesional Andalan',
    position: 'belum siap · hasil kerja tinggi',
    short: 'Sangat andal di bidangnya, tapi tidak diarahkan memimpin orang.',
    happening:
      'Pekerjaannya rapi dan hasilnya tinggi pada bidang yang dikuasainya. Tanda untuk naik level belum terlihat pada penilaian.',
    firstStep: 'Pertahankan dan jadikan tempat bertanya bagi rekan yang lebih baru di bidang yang sama.',
    checkFirst:
      'Apakah keahliannya sudah terdokumentasi sehingga tidak hilang bila dia keluar? Apakah dia merasa dihargai?',
    shortAction: 'Pertahankan',
  },

  EFFECTIVE_PRO: {
    name: 'Kontributor Terampil',
    position: 'belum siap · hasil kerja sedang',
    short: 'Mengerjakan tugasnya dengan terampil sesuai standar harian.',
    happening:
      'Orang ini menjalankan pekerjaan operasional sesuai standar yang berlaku. Kontribusinya nyata, hanya belum ada tanda untuk naik ke tingkat berikutnya.',
    firstStep: 'Tinjau apakah hambatannya aturan kerja yang berbelit, lalu sederhanakan bila memungkinkan.',
    checkFirst:
      'Apakah ada hambatan proses yang membuat hasilnya mentok? Apakah dia ingin mempelajari keahlian baru?',
    shortAction: 'Tinjau hambatan',
  },

  UNDERPERFORMER: {
    name: 'Perlu Pembinaan',
    position: 'belum siap · hasil kerja rendah',
    short: 'Hasil kerjanya jauh di bawah target dan perlu pendampingan khusus.',
    happening:
      'Hasil kerja dan tanda kemampuan untuk naik level sama-sama di bawah harapan. Kelompok ini paling sedikit jumlahnya, tetapi paling perlu perhatian.',
    firstStep: 'Buat rencana pembinaan berbatas waktu dengan target yang jelas dan pendampingan rutin.',
    checkFirst:
      'Apakah akar masalahnya sudah dipahami bersama dia? Apakah ada kondisi pribadi atau hambatan kerja yang perlu ditangani lebih dulu?',
    shortAction: 'Buat rencana pembinaan',
  },
};

/** Nomor kotak 9-Box (1 = potensi & kinerja terendah, 9 = tertinggi). */
export const NINE_BOX_BOX_NUMBER: Record<NineBoxQuadrant, number> = {
  UNDERPERFORMER: 1,
  EFFECTIVE_PRO: 2,
  TRUSTED_PRO: 3,
  DILEMMA: 4,
  CORE_PLAYER: 5,
  HIGH_IMPACT: 6,
  ENIGMA: 7,
  GROWTH_STAR: 8,
  FUTURE_LEADER: 9,
};

const UNKNOWN: NineBoxCopy = {
  name: 'Kotak tidak dikenali',
  position: 'posisi tidak diketahui',
  short: 'Data kotak ini tidak dikenali sistem.',
  happening:
    'Penilaian karyawan ini tersimpan dengan kode kotak yang tidak dikenali aplikasi. Biasanya karena data lama atau pengisian manual.',
  firstStep: 'Buka dan simpan ulang penilaian karyawan ini agar kotaknya dihitung kembali.',
  checkFirst: 'Apakah penilaiannya berasal dari data lama sebelum pembaruan aplikasi?',
  shortAction: 'Tinjau data',
};

/** Teks kotak; kode tak dikenal mengembalikan teks netral, bukan crash. */
export function nineBoxCopy(code: string): NineBoxCopy {
  return (NINE_BOX_COPY as Record<string, NineBoxCopy>)[code] ?? UNKNOWN;
}

/** Nama tampil kotak; kode tak dikenal → 'Kotak tidak dikenali'. */
export function nineBoxLabel(code: string): string {
  return nineBoxCopy(code).name;
}

/**
 * Label potensi mengikuti ambang nyata `gpa-engine.ts`:
 * `< 3.0` rendah, `3.0–3.9` sedang, `>= 4.0` tinggi.
 * Angka aslinya tetap ditampilkan di UI agar presisi tidak hilang.
 */
export function potentialLabel(score: number): 'Potensi rendah' | 'Potensi sedang' | 'Potensi tinggi' {
  if (score >= 4.0) return 'Potensi tinggi';
  if (score >= 3.0) return 'Potensi sedang';
  return 'Potensi rendah';
}
