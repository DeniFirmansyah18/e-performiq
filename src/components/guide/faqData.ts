export type FaqCategory =
  | 'all'
  | 'pemula'
  | 'roles'
  | 'perhitungan'
  | 'konsep'
  | 'glosarium'
  | 'regulasi'
  | 'keamanan';

export interface FaqItem {
  id: string;
  category: FaqCategory;
  categoryLabel: string;
  categoryColor: string;
  roleTag?: string;
  question: string;
  summary: string;
  detail: {
    background?: string;
    explanation: string[];
    caseStudy?: {
      title: string;
      content: string[];
    };
    steps?: {
      title: string;
      items: string[];
    };
    legalBasis?: string;
    importantNote?: string;
  };
}

export const FAQ_CATEGORIES: Array<{ id: FaqCategory; label: string; description: string }> = [
  { id: 'all', label: 'Semua Panduan', description: 'Seluruh petunjuk penggunaan, tata cara operasional, dan tanya jawab lengkap.' },
  { id: 'pemula', label: 'Mulai Dari Sini', description: 'Panduan kilat 3 langkah untuk Anda yang baru pertama kali login ke aplikasi.' },
  { id: 'roles', label: 'Panduan Peran (Role)', description: 'Petunjuk langkah praktis bagi Karyawan, Atasan, HR, Penilai, Direksi, dan Auditor.' },
  { id: 'perhitungan', label: 'Perhitungan Nilai & Kuota', description: 'Cara membaca nilai rapor GPA 4.00, aturan kuota bobot 100%, dan contoh angka.' },
  { id: 'konsep', label: 'Alur Kerja & Siklus', description: 'Tahapan perjalanan karyawan: Masuk (Pre), Bekerja (During), hingga Selesai (Post).' },
  { id: 'glosarium', label: 'Kamus Istilah Awam', description: 'Arti singkatan KPI, 9-Box, GPA, BAST, LWD, dan LCI dalam bahasa sehari-hari.' },
  { id: 'regulasi', label: 'Aturan Regulasi & Standar', description: 'Rujukan sah perhitungan pesangon PP 35/2021, standar ISO 30414, dan Kurva Gaussian.' },
  { id: 'keamanan', label: 'Keamanan & Tata Kelola GCG', description: 'Kunci nilai permanen, ulasan rekan rahasia 360°, dan buku pengawasan audit SPI.' },
];

export const FAQ_DATA: FaqItem[] = [
  // ===================== 0. PANDUAN PENGGUNA AWAL (QUICK START) =====================
  {
    id: 'pemula-1',
    category: 'pemula',
    categoryLabel: 'Panduan Awal',
    categoryColor: 'bg-[#E3F1DF] text-[#008060] border-[#B4E3B2]',
    roleTag: 'Khusus Pemula',
    question: 'Saya baru pertama kali login ke E-PerformIQ, dari mana saya harus memulai?',
    summary: 'Cukup ikuti 3 langkah mudah: lihat nilai rapor di profil Anda, periksa sasaran kerja (KPI), dan perbarui capaian kerja Anda.',
    detail: {
      background:
        'Selamat datang di aplikasi E-PerformIQ! Aplikasi ini dibuat agar setiap karyawan dapat melihat hasil kerjanya secara transparan, adil, dan tanpa rasa cemas di akhir tahun.',
      explanation: [
        'Sebagai pengguna baru, Anda tidak perlu khawatir atau bingung. Sistem ini bukan alat pemantau yang kaku, melainkan asisten kerja harian Anda.',
        'Di sini, Anda dapat memantau capaian target kerja, mengajukan sasaran baru, memberikan masukan rahasia kepada rekan satu tim, serta melihat nilai rapor kinerja (Composite GPA) secara langsung kapan saja.',
      ],
      steps: {
        title: '3 Langkah Mudah Memulai bagi Karyawan Baru',
        items: [
          'Langkah 1 (Buka Portal Karyawan): Klik menu "Employee Growth Portal" pada bilah menu di sebelah kiri.',
          'Langkah 2 (Cek Rapor & Target Kerja): Di bagian atas, lihat kartu "Composite Performance Scorecard" yang menampilkan nilai rapor Anda (skala 4.00). Di bawahnya, Anda dapat melihat daftar target kerja (KPI) Anda untuk kuartal berjalan.',
          'Langkah 3 (Catat Kemajuan Kerja): Setiap kali Anda menyelesaikan tugas atau ada perkembangan target, klik tombol "Update Realisasi" pada kartu target tersebut, ketikkan angka terbaru Anda, lalu klik simpan.',
        ],
      },
      importantNote:
        'Ingin melihat fitur peran lain? Anda dapat keluar (logout) dan mencoba masuk dengan tombol cepat peran Atasan, HR, Direksi, atau Komite Penilai di halaman demo.',
    },
  },
  {
    id: 'pemula-2',
    category: 'pemula',
    categoryLabel: 'Panduan Awal',
    categoryColor: 'bg-[#E3F1DF] text-[#008060] border-[#B4E3B2]',
    roleTag: 'Alur Sistem',
    question: 'Bagaimana alur kerja penilaian karyawan di aplikasi ini berjalan dari awal sampai selesai?',
    summary: 'Mulai dari penetapan target, pencatatan hasil kerja, penilaian atasan, sidang kalibrasi adil, hingga rapor akhir resmi.',
    detail: {
      background:
        'Pada sistem lama, penilaian sering kali baru dibahas di akhir tahun secara tergesa-gesa. Di E-PerformIQ, seluruh proses berjalan teratur dan bertahap sehingga tidak ada kejutan.',
      explanation: [
        'Ada 5 tahapan utama penilaian kinerja yang berlangsung sepanjang periode:',
        '1. Penetapan Target (Awal Periode): Karyawan dan atasan menyepakati target kerja (KPI). Total bobot seluruh target wajib tepat 100%.',
        '2. Pencatatan Hasil (Harian/Mingguan): Karyawan memperbarui angka capaian kerja secara berkala di portal pribadinya.',
        '3. Evaluasi Atasan (Tengah/Akhir Periode): Atasan menilai pencapaian target, kepatuhan tata tertib SOP, keahlian teknis, dan perilaku budaya kerja.',
        '4. Sidang Kalibrasi (Komite Penilai): Komite Assessor independen meninjau seluruh nilai agar sebaran nilai di seluruh divisi adil dan merata.',
        '5. Penerbitan Rapor Sah: Nilai dikunci permanen, rapor diterbitkan, dan posisi karyawan dipetakan ke dalam Matriks 9-Box untuk jenjang karir selanjutnya.',
      ],
      steps: {
        title: 'Siapa yang Mengerjakan Apa?',
        items: [
          'Karyawan: Memperbarui realisasi capaian & mengisi ulasan rekan sejawat 360° secara anonim.',
          'Atasan Langsung: Menyetujui usulan target bawahan & memberikan penilaian komposit 4 pilar.',
          'Assessor / Komite: Menyelenggarakan sidang kalibrasi untuk mencegah perlakuan tidak adil.',
          'HR Manager: Memantau kelengkapan berkas, mengelola rekrutmen, dan memproses hak pesangon pensiun/keluar.',
          'Direksi (BOD): Memantau kesehatan performa korporat secara keseluruhan lewat grafik eksekutif.',
        ],
      },
      legalBasis: 'Standar Manajemen Siklus Talenta Terpadu (Workforce Lifecycle Management).',
    },
  },
  {
    id: 'pemula-3',
    category: 'pemula',
    categoryLabel: 'Panduan Awal',
    categoryColor: 'bg-[#E3F1DF] text-[#008060] border-[#B4E3B2]',
    roleTag: 'Daftar Peran',
    question: 'Apa saja 6 peran (Role) di aplikasi ini dan apa fungsi masing-masing peran?',
    summary: 'Karyawan (isi capaian), Atasan (nilai tim), Assessor (kalibrasi adil), HR (kelola pegawai), Direksi (pantau strategi), Auditor (awasi keabsahan).',
    detail: {
      explanation: [
        'Setiap peran di E-PerformIQ memiliki menu dan tombol yang disesuaikan dengan tanggung jawab resminya:',
        '1. Karyawan (Individual Talent - Budi Pratama): Mengakses portal pribadi untuk melihat rapor nilai, menambah target KPI baru, mengupdate capaian, dan mengirim ulasan 360° anonim.',
        '2. Atasan Langsung (People Lead - Raden Mas Danu): Menyetujui target anggota tim, menilai kinerja 4 pilar bawahan, dan melihat simulasi penempatan kuadran 9-Box tim.',
        '3. Komite Penilai (Lead Assessor - Dr. Aris Wicaksono): Menyelenggarakan sidang moderasi nilai dan mengesahkan penempatan talenta pada Matriks 9-Box suksesi.',
        '4. Pengelola SDM (HR Command - Siti Nurhaliza): Mengelola penerimaan calon karyawan baru (QoH), mengekspor laporan standar ISO 30414, mengawasi pengembalian aset kantor (BAST), dan menghitung uang pesangon resmi PP 35/2021.',
        '5. Direksi Korporasi (Executive Boardroom - Ir. Hendra Gunawan): Memantau indeks kesehatan strategi VMAI, memeriksa grafik 4 pilar Balanced Scorecard, dan mengunduh laporan RUPS.',
        '6. Pengawas Tata Kelola (Auditor SPI - Bambang Soeprapto): Mengawasi keaslian rekaman data sistem, memastikan kepatuhan tata kelola GCG, dan memeriksa perbandingan data dengan tombol "Lihat Diff".',
      ],
      importantNote:
        'Anda dapat berganti peran secara bebas pada halaman login demo untuk mencoba langsung setiap tombol dan tampilan dari sudut pandang peran yang berbeda.',
    },
  },

  // ===================== 1. KONSEP DASAR & ALUR =====================
  {
    id: 'konsep-1',
    category: 'konsep',
    categoryLabel: 'Konsep Dasar',
    categoryColor: 'bg-[#E3F1DF] text-[#008060] border-[#B4E3B2]',
    question: 'Apa sebenarnya sistem E-PerformIQ dan apa perbedaannya dengan evaluasi kinerja konvensional?',
    summary: 'Sistem komprehensif 3-fase yang mengukur siklus karyawan secara matematis, transparan, dan terlindungi regulasi hukum.',
    detail: {
      background:
        'Penilaian kinerja konvensional pada banyak perusahaan sering kali dikritik karena rentan terhadap "bias subjektif" (seperti halo effect, kedekatan personal, bias akhir tahun/recency bias) dan baru dilakukan setahun sekali secara tergesa-gesa tanpa data rekam jejak harian yang valid.',
      explanation: [
        'E-PerformIQ (Enterprise Employee Performance & Lifecycle Analytics) adalah platform manajemen talenta korporat terintegrasi berbasis standar internasional ISO 30414:2019 dan hukum ketenagakerjaan RI.',
        'Platform ini mendampingi karyawan sepanjang 3 fase perjalanan karir (Employee Lifecycle): Pre-Employment (rekrutmen & seleksi mutu QoH), During-Employment (pencapaian sasaran kerja, kepatuhan SOP, kompetensi teknis, dan budaya AKHLAK 360°), hingga Post-Employment (pengakhiran tugas, audit clearance inventaris BAST, dan pencairan pesangon PP 35/2021).',
        'Semua angka dihitung menggunakan formula matematis terbuka tanpa "black box", sehingga karyawan mengetahui dengan pasti dari mana setiap poin nilainya berasal.',
      ],
      caseStudy: {
        title: 'Perbandingan Nyata di Lapangan',
        content: [
          'Pada sistem lama: Seorang karyawan yang bekerja sangat keras selama 11 bulan bisa mendapatkan nilai buruk hanya karena membuat satu kesalahan kecil di bulan Desember (Recency Bias).',
          'Pada E-PerformIQ: Skor dihitung secara kumulatif dari data riil sepanjang kuartal (50% KPI tercatat + 20% log SOP harian + 15% asesmen kompetensi terstandar + 15% umpan balik rekan kerja), sehingga penilaian terbebas dari persepsi emosional sesaat atasan.',
        ],
      },
      legalBasis: 'Pedoman Tata Kelola Perusahaan yang Baik (KNKG RI 2021).',
    },
  },
  {
    id: 'konsep-2',
    category: 'konsep',
    categoryLabel: 'Konsep Dasar',
    categoryColor: 'bg-[#E3F1DF] text-[#008060] border-[#B4E3B2]',
    question: 'Bagaimana alur kerja 3 fase siklus karyawan berjalan secara menyeluruh?',
    summary: 'Mencakup Fase 1 (Pre-Employment), Fase 2 (During-Employment), dan Fase 3 (Post-Employment).',
    detail: {
      background:
        'Karyawan tidak dinilai hanya saat bekerja, melainkan dievaluasi sejak standar seleksi masuk hingga hak-hak normatif saat mengakhiri masa tugasnya dipenuhi dengan benar.',
      explanation: [
        'Fase 1: Pre-Employment — Dimulai dari penyusunan formasi kebutuhan pegawai (Manpower Planning / MPP) dan evaluasi calon karyawan dengan formula Quality of Hire (QoH) yang menggabungkan tes psikometri, tes teknis keahlian, dan wawancara kompetensi.',
        'Fase 2: During-Employment — Karyawan menetapkan target sasaran SMART yang terhubung ke Balanced Scorecard perusahaan, memasukkan angka realisasi capaian berkala, dinilai kepatuhan operasionalnya terhadap SOP perusahaan, dan dievaluasi rekan sejawat secara 360° tanpa membocorkan identitas.',
        'Fase 3: Post-Employment — Saat masa kerja berakhir (PHK, pensiun, atau pengunduran diri), sistem memvalidasi berita acara serah terima aset (BAST), mencabut token akun IT SSO secara terpusat, menghitung pesangon statuter sesuai PP No. 35/2021, serta mengarsipkan karya inovasi/paten ke dalam Talent Legacy (LCI).',
      ],
      steps: {
        title: 'Urutan Alur Operasional di Aplikasi',
        items: [
          'HR Manager membuka formulir pendaftaran rekrutmen baru dan menyeleksi kandidat hingga lulus seleksi.',
          'Karyawan (Employee) mengajukan sasaran target baru di portal pribadinya sesuai pilar Balanced Scorecard.',
          'Atasan Langsung (People Manager) menyetujui target kerja dan melakukan evaluasi berkala 4 pilar.',
          'Komite Penilai (Assessor) menyelenggarakan sidang kalibrasi untuk memoderasi nilai dan menempatkan posisi karyawan di 9-Box Talent Matrix.',
          'Direksi (BOD) memantau skor kesehatan kinerja korporat dan Auditor Pengawas memeriksa keabsahan catatan riwayat.',
        ],
      },
      legalBasis: 'Standar Manajemen Siklus Talenta Terpadu (Workforce Lifecycle).',
    },
  },

  // ===================== 2. ACUAN HUKUM & REGULASI RESMI RI =====================
  {
    id: 'regulasi-1',
    category: 'regulasi',
    categoryLabel: 'Regulasi RI & ISO',
    categoryColor: 'bg-[#FFF4F2] text-[#D72C0D] border-[#FED3D1]',
    question: 'Apa dasar hukum perhitungan uang pesangon di E-PerformIQ dan bagaimana rumusnya sesuai PP No. 35 Tahun 2021?',
    summary: 'Mengacu resmi pada Pasal 40–59 PP No. 35 Tahun 2021 dengan rincian UP, UPMK, dan UPH.',
    detail: {
      background:
        'Sering terjadi sengketa ketenagakerjaan akibat perbedaan tafsir hitungan uang pesangon antara perusahaan dan pekerja saat terjadi pemutusan hubungan kerja (PHK). E-PerformIQ mengunci rumus baku pemerintah secara otomatis sehingga hasil perhitungan memiliki kekuatan hukum yang sah dan adil.',
      explanation: [
        'Dasar hukum yang digunakan adalah Peraturan Pemerintah (PP) Republik Indonesia Nomor 35 Tahun 2021 tentang Perjanjian Kerja Waktu Tertentu, Alih Daya, Waktu Kerja dan Waktu Istirahat, dan Pemutusan Hubungan Kerja (turunan dari UU Cipta Kerja).',
        'Kompensasi pesangon terdiri atas 3 komponen utama:',
        '1. Uang Pesangon (UP): Dihitung berdasarkan masa kerja, mulai dari 1 bulan upah (masa kerja < 1 tahun) hingga maksimal 9 bulan upah (masa kerja 8 tahun atau lebih). Nilai ini kemudian dikalikan dengan koefisien pengali alasan PHK (misal: 0.5x untuk efisiensi merugi, 1.0x untuk efisiensi pencegahan rugi, atau 1.75x untuk pensiun).',
        '2. Uang Penghargaan Masa Kerja (UPMK): Diberikan bagi pekerja dengan masa kerja minimal 3 tahun (2 bulan upah) dan bertambah bertahap hingga maksimal 10 bulan upah (masa kerja 24 tahun atau lebih).',
        '3. Uang Penggantian Hak (UPH): Meliputi kompensasi sisa hak cuti tahunan yang belum diambil/gugur, ongkos kepulangan bagi pekerja dan keluarga ke tempat asal, serta hal-hal lain yang disepakati dalam Perjanjian Kerja (PK) atau PKB.',
      ],
      caseStudy: {
        title: 'Simulasi Kasus Nyata Perhitungan Pesangon',
        content: [
          'Kasus: Budi Pratama memiliki masa kerja 4 tahun 2 bulan dengan gaji pokok + tunjangan tetap sebesar Rp 14.000.000 per bulan. Budi mengalami pengakhiran kerja karena restrukturisasi efisiensi perusahaan (pengali UP = 1.0x). Budi masih memiliki sisa cuti 6 hari kerja.',
          'Hitungan Uang Pesangon (UP): Masa kerja 4 tahun berhak atas 5 bulan upah = 5 × Rp 14.000.000 × 1.0 = Rp 70.000.000.',
          'Hitungan UPMK: Masa kerja 3-6 tahun berhak atas 2 bulan upah = 2 × Rp 14.000.000 = Rp 28.000.000.',
          'Hitungan UPH: Kompensasi 6 hari cuti = (6 / 25 hari kerja) × Rp 14.000.000 = Rp 3.360.000.',
          'Total Pesangon Sah (Total Disbursement): Rp 70.000.000 + Rp 28.000.000 + Rp 3.360.000 = Rp 101.360.000.',
        ],
      },
      steps: {
        title: 'Cara Menggunakan Kalkulator Pesangon di Aplikasi',
        items: [
          'Buka menu "HR Ops Command Center" melalui bilah navigasi samping.',
          'Pilih tab "Post-Employment (Offboarding & Pesangon)".',
          'Klik tombol "Kalkulator Pesangon (PP 35/2021)".',
          'Pilih nama karyawan dan alasan pemutusan hubungan kerja dari daftar pilihan.',
          'Sistem secara otomatis menghitung masa kerja dari data kepegawaian resmi dan menampilkan rincian UP, UPMK, serta UPH dalam format mata uang Rupiah.',
        ],
      },
      legalBasis: 'Pasal 40 ayat (2), (3), dan (4) serta Pasal 43–52 Peraturan Pemerintah No. 35 Tahun 2021.',
    },
  },
  {
    id: 'regulasi-2',
    category: 'regulasi',
    categoryLabel: 'Regulasi RI & ISO',
    categoryColor: 'bg-[#FFF4F2] text-[#D72C0D] border-[#FED3D1]',
    question: 'Apa itu standar internasional ISO 30414:2019 dan mengapa modul SDM E-PerformIQ wajib mematuhinya?',
    summary: 'Pedoman global transparansi pelaporan modal manusia (Human Capital Reporting) bagi stakeholder & investor.',
    detail: {
      background:
        'Di pasar global dan perusahaan terbuka (Tbk/BUMN), pemegang saham dan investor tidak hanya mengaudit keuangan, tetapi juga menuntut audit modal manusia untuk memastikan kepatuhan tata kelola, efisiensi anggaran rekrutmen, dan mitigasi risiko kepegawaian.',
      explanation: [
        'ISO 30414:2019 (Human Resource Management — Guidelines for Internal and External Human Capital Reporting) adalah standar global resmi pertama untuk mengukur nilai nyata dari modal manusia sebuah organisasi.',
        'E-PerformIQ mengimplementasikan klausul inti ISO 30414, antara lain:',
        '1. Metrik Kualitas Rekrutmen (Quality of Hire / QoH): Mengukur apakah proses rekrutmen menghasilkan karyawan berkinerja tinggi atau justru salah rekrut.',
        '2. Efisiensi Biaya & Waktu (Cost-per-Hire & Time-to-Fill): Melacak rata-rata biaya seleksi dan berapa hari yang dibutuhkan untuk mengisi formasi kosong.',
        '3. Kepatuhan Kuota Formasi Kerja (Manpower Planning / MPP): Memastikan jumlah karyawan yang dipekerjakan tidak melampaui kuota dan anggaran resmi yang telah disahkan direksi.',
      ],
      steps: {
        title: 'Cara Mengekspor Laporan ISO 30414 di Aplikasi',
        items: [
          'Di halaman HR Command Center, klik tombol "Ekspor ISO 30414" di sudut kanan atas.',
          'Sistem akan memvalidasi data formasi seluruh departemen dan mengunduh berkas CSV resmi ("Laporan_ISO_30414_Human_Capital_2026.csv") yang siap diserahkan kepada auditor eksternal atau Dewan Komisaris.',
        ],
      },
      legalBasis: 'Standar Pelaporan Modal Manusia Internasional (ISO 30414:2019 Clause 4.7).',
    },
  },
  {
    id: 'regulasi-3',
    category: 'regulasi',
    categoryLabel: 'Regulasi RI & ISO',
    categoryColor: 'bg-[#FFF4F2] text-[#D72C0D] border-[#FED3D1]',
    question: 'Bagaimana metodologi Balanced Scorecard (Kaplan & Norton) diterapkan pada sasaran kerja karyawan?',
    summary: 'Membagi sasaran strategis ke 4 perspektif berimbang agar penilaian tidak semata-mata berfokus pada uang.',
    detail: {
      background:
        'Banyak organisasi gagal karena hanya menilai karyawan dari target finansial jangka pendek (seperti penjualan), sehingga mengabaikan kepuasan pelanggan, kualitas proses kerja, dan kepatuhan budaya kerja.',
      explanation: [
        'Metode Balanced Scorecard (BSC) yang dikembangkan oleh Prof. Robert S. Kaplan dan Dr. David P. Norton membagi sasaran kinerja ke dalam 4 pilar seimbang:',
        '1. Perspektif Finansial (Financial): Efisiensi penggunaan anggaran, rasio penghematan biaya server/operasional, dan kontribusi terhadap pendapatan korporasi.',
        '2. Perspektif Pelanggan (Customer / Stakeholder): Kepuasan pengguna layanan, indeks CSAT, ketepatan SLA waktu tanggap masalah, dan reputasi merek.',
        '3. Perspektif Proses Bisnis Internal (Internal Business Process): Kepatuhan terhadap SOP tanpa insiden keselamatan kerja, efisiensi alur kerja, dan cakupan pengujian mutu (quality gate).',
        '4. Perspektif Pembelajaran & Pertumbuhan (Learning & Growth): Jam pelatihan wajib, penguasaan sertifikasi keahlian baru, inovasi Kaizen, dan penerapan nilai-nilai budaya AKHLAK.',
        'Pohon Penurunan Sasaran (Cascading Tree): Target direksi di Level 1 diturunkan ke target divisi di Level 2, lalu dipecah menjadi target KPI individu karyawan di Level 3. Dengan demikian, setiap pekerjaan karyawan terhubung langsung dengan visi besar perusahaan.',
      ],
      legalBasis: 'Kerangka Kerja Penyelarasan Strategis Balanced Scorecard (Kaplan & Norton).',
    },
  },
  {
    id: 'regulasi-4',
    category: 'regulasi',
    categoryLabel: 'Regulasi RI & ISO',
    categoryColor: 'bg-[#FFF4F2] text-[#D72C0D] border-[#FED3D1]',
    question: 'Apa itu 9-Box Talent Matrix (GE/McKinsey) dan apa arti masing-masing dari ke-9 kotak tersebut?',
    summary: 'Model pemetaan suksesi talenta berbasis dua dimensi: Hasil Kinerja Masa Kini vs Potensi Masa Depan.',
    detail: {
      background:
        'Perusahaan besar memerlukan perencanaan suksesi kepemimpinan yang objektif agar jabatan penting (seperti VP dan Direktur) tidak diisi berdasarkan unsur nepotisme atau kedekatan personal.',
      explanation: [
        '9-Box Matrix memetakan karyawan ke dalam diagram 3x3 yang dibentuk oleh dua sumbu:',
        '• Sumbu X (Kinerja Masa Kini / Performance): Dihitung dari Composite GPA (IPK Kinerja 0.0 - 4.0).',
        '• Sumbu Y (Potensi Kepemimpinan Masa Depan / Potential): Dinilai dari kapasitas belajar, pemikiran strategis, dan kepemimpinan (skala 1.0 - 5.0).',
        'Rincian dan Makna ke-9 Kuadran:',
        '• Box 9 - Future Leader (Kinerja Tinggi, Potensi Tinggi): Suksesor utama jabatan Direksi/VP (Ready Now / Ready 1-2 Thn). Mendapat program Executive Mentoring.',
        '• Box 8 - Growth Leader (Kinerja Sedang, Potensi Tinggi): Calon pemimpin masa depan yang membutuhkan jam terbang manajerial tambahan.',
        '• Box 7 - Enigma (Kinerja Rendah, Potensi Tinggi): Karyawan sangat cerdas namun kinerjanya terhambat karena ketidaksesuaian peran atau beban adaptasi (perlu role re-alignment).',
        '• Box 6 - High Impact (Kinerja Tinggi, Potensi Sedang): Kontributor kunci yang sangat produktif namun lebih cocok di jalur spesialis (SME/Expert). Diberi insentif retensi.',
        '• Box 5 - Core Backbone (Kinerja Sedang, Potensi Sedang): Tulang punggung operasional organisasi yang stabil dan konsisten.',
        '• Box 4 - Dilemma (Kinerja Rendah, Potensi Sedang): Memerlukan pelatihan ulang dan evaluasi penempatan tugas.',
        '• Box 3 - Trusted Pro (Kinerja Tinggi, Potensi Terbatas): Tenaga ahli senior yang sangat andal pada bidang spesifiknya tanpa keinginan menjadi manajer struktural.',
        '• Box 2 - Effective Pro (Kinerja Sedang, Potensi Terbatas): Pelaksana operasional harian standar.',
        '• Box 1 - Underperformer (Kinerja Rendah, Potensi Rendah): Wajib masuk program pembinaan khusus (Performance Improvement Plan / PIP) selama 60 hari.',
      ],
      legalBasis: 'Metodologi Pemetaan Suksesi Kepemimpinan 9-Box (GE / McKinsey).',
    },
  },
  {
    id: 'regulasi-5',
    category: 'regulasi',
    categoryLabel: 'Regulasi RI & ISO',
    categoryColor: 'bg-[#FFF4F2] text-[#D72C0D] border-[#FED3D1]',
    question: 'Mengapa digunakan standar Kurva Normal Gaussian (BUMN Standard) dan apa batas toleransinya?',
    summary: 'Mencegah atasan memberi nilai "semua anak buah dapat nilai A" (bias kelonggaran) atau "semua dapat C".',
    detail: {
      background:
        'Tanpa distribusi terarah (forced distribution), departemen yang memiliki atasan santai akan mendapat nilai A semua, sementara departemen dengan atasan keras akan mendapat nilai C semua. Hal ini menimbulkan kecemburuan sosial dan ketidakadilan saat pembagian bonus korporasi.',
      explanation: [
        'E-PerformIQ menggunakan model distribusi terkendali Kurva Gaussian standar Kementerian BUMN RI untuk menjaga proporsi penilaian yang wajar:',
        '• Predikat A (Sangat Baik / Istimewa): Ditargetkan pada 15% - 20% populasi karyawan.',
        '• Predikat B (Baik / Memenuhi Standar Kuat): Ditargetkan pada 60% - 70% populasi karyawan (mayoritas).',
        '• Predikat C (Cukup / Perlu Bimbingan): Ditargetkan pada 10% - 15% populasi karyawan.',
        '• Predikat D (Kurang / Mandat PIP): Ditargetkan pada 3% - 5% populasi karyawan.',
        'Jika atasan menilai seluruh bawahannya dengan nilai 100% (A), sistem akan menampilkan indikator "Deviasi Toleransi Kuota Melebihi Batas" dan mewajibkan atasan tersebut mengikuti sidang kalibrasi bersama Komite Penilai untuk menguji keabsahan bukti kerjanya.',
      ],
      legalBasis: 'Pedoman Standar Distribusi Normal Kurva BUMN RI.',
    },
  },
  {
    id: 'regulasi-6',
    category: 'regulasi',
    categoryLabel: 'Regulasi RI & ISO',
    categoryColor: 'bg-[#FFF4F2] text-[#D72C0D] border-[#FED3D1]',
    question: 'Bagaimana prinsip TARIF dari Komite Nasional Kebijakan Governansi (KNKG) diterapkan di aplikasi?',
    summary: 'Menjamin lima pilar Good Corporate Governance: Transparency, Accountability, Responsibility, Independency, Fairness.',
    detail: {
      background:
        'Penegakan prinsip GCG memastikan perusahaan dikelola secara sehat, bebas dari benturan kepentingan, manipulasi data nilai, atau kesewenang-wenangan pemegang jabatan.',
      explanation: [
        '1. Transparency (Keterbukaan): Rumus bobot komposit (50/20/15/15) dan pohon cascading sasaran dapat dilihat secara transparan oleh seluruh karyawan di portal pribadinya tanpa ada formula rahasia.',
        '2. Accountability (Akuntabilitas): Pengesahan nilai akhir wajib diputuskan melalui sidang kuorum Komite Kalibrasi Talenta dan dibubuhi stempel digital penilai serta catatan risalah resmi.',
        '3. Responsibility (Pertanggungjawaban): Kepatuhan mutlak terhadap hukum ketenagakerjaan RI (PP 35/2021) terkait pembayaran pesangon, jaminan sosial, dan keselamatan kerja.',
        '4. Independency (Kemandirian): Kehadiran peran Assessor Independen yang tidak berada di bawah tekanan operasional departemen untuk memoderasi nilai secara objektif.',
        '5. Fairness (Kewajaran & Kesetaraan): Kesetaraan hak karyawan melalui mekanisme ulasan rekan sejawat 360° yang terlindungi anonimitasnya, serta hak audit bagi SPI untuk melacak segala bentuk perubahan data.',
      ],
      legalBasis: 'Pedoman Umum Good Corporate Governance Indonesia (KNKG RI 2021).',
    },
  },

  // ===================== 3. PANDUAN LANGKAH KERJA TIAP PERAN (ROLE WORKFLOW) =====================
  {
    id: 'roles-1',
    category: 'roles',
    categoryLabel: 'Panduan Role',
    categoryColor: 'bg-[#F1F1F1] text-[#202223] border-[#E1E3E5]',
    roleTag: 'Karyawan / Individual Talent',
    question: 'Bagaimana panduan lengkap langkah demi langkah bagi peran KARYAWAN (Budi Pratama)?',
    summary: 'Cara memeriksa skor GPA, mengajukan sasaran KPI baru, memperbarui realisasi, dan mengisi ulasan 360°.',
    detail: {
      explanation: [
        'Sebagai karyawan, portal Anda berfokus pada transparansi kinerja mandiri (Self-Appraisal & Growth Portal). Berikut panduan lengkap penggunaannya:',
      ],
      steps: {
        title: 'Langkah Demi Langkah di Portal Karyawan',
        items: [
          'Langkah 1 (Melihat Skor & Rapor): Buka menu "Employee Growth Portal" di navigasi utama. Pada kartu "Composite Performance Scorecard", periksa nilai rapor IPK Kinerja (skala 4.00) dan rincian 4 pilar pencapaian Anda.',
          'Langkah 2 (Memeriksa Kuota Bobot): Perhatikan badge "Bobot Terpakai: X% / 100%" dan "Sisa Kuota: Y%". Total bobot seluruh target KPI Anda dalam satu kuartal tidak boleh melebihi 100%.',
          'Langkah 3 (Mengajukan Sasaran Baru): Klik tombol "+ Ajukan Milestone Baru". Masukkan judul target kerja SMART, pilih pilar BSC yang relevan, masukkan angka target dan bobot (%). Jika kuota sudah 100%, gunakan tombol "Kurangi 10% dari KPI Lain Otomatis" atau pilih tab kuartal 2026-Q4.',
          'Langkah 4 (Memperbarui Realisasi Capaian): Pada daftar kartu KPI Anda, klik tombol "Update Realisasi" kapan saja Anda mencapai kemajuan baru. Masukkan angka riil terbaru, lalu simpan. Sistem akan langsung memperbarui persentase ketercapaian (Achievement %).',
          'Langkah 5 (Mengisi Ulasan 360° Rekan Kerja): Pada kartu "Peer Review 360° Feedback" di bagian bawah, klik tombol "Isi Feedback Anonim". Berikan skor perilaku nilai AKHLAK (Integritas, Kolaborasi, Inovasi) dan catatan masukan membangun bagi rekan setim Anda.',
          'Langkah 6 (Melihat Keterkaitan Target Korporat): Klik tombol "Diagram Pohon BSC" untuk memeriksa bagaimana pekerjaan Anda terhubung hingga ke target dewan direksi holding.',
        ],
      },
      importantNote: 'Seluruh ulasan 360° yang Anda berikan dijamin 100% rahasia dan identitas Anda tidak akan dibagikan kepada siapa pun.',
    },
  },
  {
    id: 'roles-2',
    category: 'roles',
    categoryLabel: 'Panduan Role',
    categoryColor: 'bg-[#F1F1F1] text-[#202223] border-[#E1E3E5]',
    roleTag: 'Atasan Langsung / People Lead',
    question: 'Bagaimana panduan lengkap langkah demi langkah bagi peran ATASAN LANGSUNG (Raden Mas Danu)?',
    summary: 'Cara menyetujui target bawahan, melakukan evaluasi komposit 4 pilar, dan melihat estimasi 9-Box.',
    detail: {
      explanation: [
        'Sebagai People Manager, tugas utama Anda adalah memastikan target tim realistis dan selaras dengan divisi, serta memberikan penilaian berkala yang adil tanpa bias.',
      ],
      steps: {
        title: 'Langkah Demi Langkah di Manager Cockpit',
        items: [
          'Langkah 1: Buka menu "Manager Evaluation Cockpit" pada bilah navigasi samping.',
          'Langkah 2 (Persetujuan Target Tim): Periksa tabel bawahan Anda. Jika terdapat sasaran KPI yang diajukan dengan status "Menunggu Approval", klik tombol "Setujui" pada baris tersebut atau gunakan tombol "Setujui Semua KPI Tim" untuk persetujuan massal.',
          'Langkah 3 (Melakukan Evaluasi Komposit): Klik tombol "Evaluasi" pada baris anggota tim yang ingin dinilai. Jendela evaluasi interaktif akan terbuka.',
          'Langkah 4 (Menyesuaikan Slider Penilaian): Geser slider untuk menentukan: Capaian KPI (bobot 50%), Kepatuhan SOP & Regulasi (bobot 20%), Analisis Gap Kompetensi Teknis (bobot 15%), dan Perilaku Core Values Budaya AKHLAK (bobot 15%). Tentukan juga estimasi skor Potensi Awal (1.0 - 5.0).',
          'Langkah 5 (Memantau Hasil Perhitungan): Perhatikan panel preview secara real-time. Sistem akan menampilkan estimasi nilai akhir IPK Kinerja (Composite GPA), predikat huruf (A/B/C/D), dan proyeksi penempatan kuadran 9-Box.',
          'Langkah 6 (Menyimpan Draft): Klik "Simpan & Hitung Komposit GPA". Hasil evaluasi akan tersimpan aman di sistem dan siap diajukan ke sidang komite kalibrasi.',
        ],
      },
      importantNote: 'Pastikan sebaran nilai tim Anda tidak melebihi kuota wajar Kurva Normal Gaussian.',
    },
  },
  {
    id: 'roles-3',
    category: 'roles',
    categoryLabel: 'Panduan Role',
    categoryColor: 'bg-[#F1F1F1] text-[#202223] border-[#E1E3E5]',
    roleTag: 'Komite Penilai Independen / Assessor',
    question: 'Bagaimana panduan lengkap langkah demi langkah bagi peran ASSESSOR (Dr. Aris Wicaksono)?',
    summary: 'Cara memimpin sidang kalibrasi talenta, memoderasi nilai, dan mengesahkan penempatan 9-Box.',
    detail: {
      explanation: [
        'Assessor bertindak sebagai penjamin mutu dan keadilan penilaian di seluruh organisasi, memastikan standar BUMN diterapkan secara merata dan merumuskan talent pipeline suksesi.',
      ],
      steps: {
        title: 'Langkah Demi Langkah di 9-Box Talent Matrix',
        items: [
          'Langkah 1: Buka menu "9-Box Talent Matrix" di bilah navigasi. Anda akan melihat sebaran seluruh karyawan perusahaan pada 9 kuadran talenta.',
          'Langkah 2: Klik tombol biru "Moderasi & Kalibrasi (Assessor)" di bilah atas.',
          'Langkah 3: Pada modal sidang kalibrasi, pilih nama pegawai yang disidangkan (misal: Budi Pratama).',
          'Langkah 4: Tentukan skor "Potensi Kepemimpinan & Suksesi" (skala 1.0 - 5.0) berdasarkan hasil uji asesmen kepemimpinan atau psikotes berkala.',
          'Langkah 5: Sesuaikan skor moderasi capaian KPI jika sidang menemukan deviasi objektivitas dari atasan langsung.',
          'Langkah 6: Tuliskan justifikasi formal pada kolom "Catatan Risalah Komite Kalibrasi & Justifikasi Moderasi" (misal: "Kesiapan suksesi arsitektur cloud tingkat C-Level").',
          'Langkah 7: Klik tombol "Sahkan Kalibrasi & Simpan". Sistem akan mengunci nilai secara otomatis menjadi permanen (tidak dapat diubah sepihak) dan mencatat pengesahan ini ke buku pengawasan internal (SPI).',
        ],
      },
      importantNote: 'Pengesahan oleh Assessor merupakan gerbang hukum terakhir sebelum nilai dicantumkan dalam SK resmi kepegawaian.',
    },
  },
  {
    id: 'roles-4',
    category: 'roles',
    categoryLabel: 'Panduan Role',
    categoryColor: 'bg-[#F1F1F1] text-[#202223] border-[#E1E3E5]',
    roleTag: 'Pengelola Human Capital / HR Manager',
    question: 'Bagaimana panduan lengkap langkah demi langkah bagi peran HR MANAGER (Siti Nurhaliza)?',
    summary: 'Mengelola formasi MPP, pendaftaran seleksi FPTK (QoH), clearance offboarding, pesangon, dan ekspor ISO.',
    detail: {
      explanation: [
        'HR Manager memegang kendali penuh operasional lifecycle tenaga kerja, mulai dari hulu rekrutmen hingga hilir pemenuhan hak pesangon.',
      ],
      steps: {
        title: 'Langkah Demi Langkah di HR Ops Command Center',
        items: [
          'Langkah 1 (Pre-Employment): Di halaman HR Command, klik tombol "+ Rekrutmen Baru (FPTK)". Masukkan nama kandidat, posisi jabatan, skor psikometri (30%), skor tes teknis (40%), skor wawancara user (30%), biaya rekrutmen, dan time-to-fill. Sistem akan otomatis mengalkulasi indeks Quality of Hire (QoH).',
          'Langkah 2 (Ekspor ISO 30414): Klik tombol "Ekspor ISO 30414" untuk mengunduh laporan realisasi anggaran rekrutmen, pemenuhan kuota formasi departemen, dan SLA dalam format CSV.',
          'Langkah 3 (Memantau Kurva Kinerja): Pada tab During-Employment, periksa grafik Gaussian Bell Curve untuk memastikan jumlah peraih nilai A, B, C, dan D berada dalam batas toleransi normal BUMN.',
          'Langkah 4 (Post-Employment & Pesangon): Buka tab Post-Employment. Klik "Kalkulator Pesangon (PP 35/2021)" untuk menghitung kompensasi pekerja keluar. Periksa juga daftar "Offboarding Clearance Pending" untuk memvalidasi checklist serah terima barang (BAST) dan pencabutan akses token SSO sebelum tanggal LWD (Last Working Day).',
        ],
      },
    },
  },
  {
    id: 'roles-5',
    category: 'roles',
    categoryLabel: 'Panduan Role',
    categoryColor: 'bg-[#F1F1F1] text-[#202223] border-[#E1E3E5]',
    roleTag: 'Direksi / C-Level / CEO',
    question: 'Bagaimana panduan lengkap langkah demi langkah bagi peran DIREKSI / BOD (Ir. Hendra Gunawan)?',
    summary: 'Memantau indeks kesehatan VMAI, 4 pilar BSC makro, mencetak risalah dewan, dan unduh ringkasan RUPS.',
    detail: {
      explanation: [
        'Direksi berfokus pada keselarasan strategis makro antara kinerja seluruh jajaran pegawai dengan visi-misi korporasi dan tolok ukur pasar.',
      ],
      steps: {
        title: 'Langkah Demi Langkah di Executive Boardroom',
        items: [
          'Langkah 1: Buka menu "Executive Boardroom" pada bilah navigasi utama.',
          'Langkah 2: Pantau kartu "VMAI Indeks Korporasi" (misal: 89.4%) yang mencerminkan kesehatan eksekusi strategi dibandingkan tolok ukur industri (benchmark: 85.0%).',
          'Langkah 3: Periksa sebaran 4 perspektif Balanced Scorecard (Finansial, Pelanggan, Proses Internal, Pembelajaran) untuk mendeteksi divisi mana yang mengalami hambatan sasaran.',
          'Langkah 4: Klik tombol "Cetak Risalah BOD" untuk mencetak dokumen rapat evaluasi dewan komisaris langsung ke printer atau format PDF.',
          'Langkah 5: Klik tombol "Unduh Ringkasan Eksekutif" untuk mengunduh berkas laporan rekapitulasi kinerja korporat yang siap dipaparkan pada Rapat Umum Pemegang Saham (RUPS).',
        ],
      },
    },
  },
  {
    id: 'roles-6',
    category: 'roles',
    categoryLabel: 'Panduan Role',
    categoryColor: 'bg-[#F1F1F1] text-[#202223] border-[#E1E3E5]',
    roleTag: 'Auditor SPI Governance',
    question: 'Bagaimana panduan lengkap langkah demi langkah bagi peran AUDITOR SPI (Bambang Soeprapto)?',
    summary: 'Pengawasan independen kepatuhan tata kelola, pemantauan riwayat sistem, dan pemeriksaan perbandingan data.',
    detail: {
      explanation: [
        'Satuan Pengawas Internal (SPI) memiliki hak baca independen (read-only murni) untuk menjamin transparansi tanpa risiko memanipulasi data.',
      ],
      steps: {
        title: 'Langkah Demi Langkah di GCG Audit & Compliance',
        items: [
          'Langkah 1: Buka menu "GCG Audit & Compliance" di bilah navigasi samping.',
          'Langkah 2: Periksa kartu kepatuhan 5 prinsip TARIF (KNKG RI) dan status "Pengawasan Sistem: Aktif".',
          'Langkah 3: Gunakan kolom pencarian atau filter tipe aksi (CALIBRATE, LOGIN, LOGOUT, CREATE, UNLOCK) untuk menyaring riwayat mutasi data yang mencurigakan.',
          'Langkah 4 (Memeriksa Perubahan Data): Klik tombol "Lihat Diff" pada baris aktivitas (misalnya pengesahan nilai oleh penilai). Jendela perbandingan akan menampilkan rekaman data semula berdampingan dengan data baru yang disimpan secara transparan.',
        ],
      },
    },
  },

  // ===================== 4. RUMUS PERHITUNGAN, KUOTA BOBOT & SIMULASI =====================
  {
    id: 'hitung-1',
    category: 'perhitungan',
    categoryLabel: 'Formula & Kuota',
    categoryColor: 'bg-[#F1F1F1] text-[#202223] border-[#E1E3E5]',
    question: 'Mengapa muncul pesan "Total bobot KPI melebihi 100%" saat menambah sasaran baru dan bagaimana solusinya?',
    summary: 'Aturan tata kelola sasaran kerja agar beban target seimbang. Tersedia tombol bantuan 1-klik untuk meluangkan kuota.',
    detail: {
      background:
        'Jika karyawan diizinkan membuat target dengan bobot total 120% atau 150%, maka perhitungan nilai akhir menjadi tidak adil dan tidak dapat diperbandingkan dengan rekan kerja lain yang berbobot 100%. Oleh karena itu, sistem membatasi akumulasi bobot sasaran kerja per periode tepat maksimal 100% agar adil bagi semua karyawan.',
      explanation: [
        'Pada data awal (pre-seeded), profil Budi Pratama di periode 2026-Q3 telah memiliki 4 sasaran KPI dengan total bobot pas 100% (30% + 25% + 25% + 20% = 100%).',
        'Ketika Anda mencoba menambah sasaran baru berbobot 5% atau 10%, sistem menghitung 100% + 5% = 105%, sehingga pendaftaran ditolak oleh aturan validasi tata kelola kinerja.',
      ],
      steps: {
        title: 'Solusi Cepat Mengatasi Kuota Penuh',
        items: [
          'Solusi 1 (Kurangi Bobot Otomatis): Di dalam jendela "Ajukan Sasaran Kerja / KPI Baru", klik tombol kuning bertanda "Kurangi 10% dari KPI Lain Otomatis". Sistem akan memotong 10% dari KPI terbesar Anda secara aman sehingga kuota 10% langsung bebas untuk sasaran baru Anda.',
          'Solusi 2 (Ubah Bobot Manual): Pada tabel KPI Anda di Employee Portal, klik tombol "Ubah Bobot" pada salah satu target, ubah bobotnya (misal dari 30% menjadi 20%), lalu simpan. Sisa kuota 10% kini tersedia.',
          'Solusi 3 (Hapus Sasaran Usang): Klik tombol "Hapus" pada sasaran kerja yang sudah dibatalkan untuk mengembalikan bobotnya ke kuota bebas.',
          'Solusi 4 (Pilih Kuartal 2026-Q4): Beralih ke periode perencanaan berikutnya "2026-Q4" di mana kuota bobot masih 100% kosong dan siap dirancang dari awal.',
        ],
      },
      legalBasis: 'Pedoman Tata Kelola Pembobotan Sasaran Kerja Seimbang.',
    },
  },
  {
    id: 'hitung-2',
    category: 'perhitungan',
    categoryLabel: 'Formula & Kuota',
    categoryColor: 'bg-[#F1F1F1] text-[#202223] border-[#E1E3E5]',
    question: 'Bagaimana rumus matematis lengkap perhitungan Composite GPA (IPK Kinerja Karyawan)?',
    summary: 'Total Score = (0.50 × KPI) + (0.20 × SOP) + (0.15 × Kompetensi) + (0.15 × Core Values 360°), lalu dikonversi ke skala 4.00.',
    detail: {
      background:
        'Sistem E-PerformIQ tidak menggunakan asumsi abstrak. Seluruh nilai dirumuskan berdasarkan 4 variabel terbobot yang mencakup hasil kerja, kepatuhan, keahlian, dan akhlak.',
      explanation: [
        'Formula Perhitungan Skor Persentase:',
        'Total Score = (50% × Skor Capaian KPI) + (20% × Skor Kepatuhan SOP) + (15% × Skor Uji Kompetensi) + (15% × Skor Perilaku Core Values 360°).',
        'Formula Konversi ke Skala GPA (Skala 4.00):',
        'Composite GPA = (Total Score / 100) × 4.00.',
        'Tabel Predikat & Huruf Mutu Kinerja:',
        '• GPA 3.50 – 4.00 (Total Skor ≥ 87.5%): Predikat A (Sangat Baik / Istimewa). Memenuhi syarat fast-track promosi.',
        '• GPA 3.00 – 3.49 (Total Skor 75.0% – 87.4%): Predikat B (Baik / Standar Inti Organisasi). Berhak atas kenaikan gaji berkala penuh.',
        '• GPA 2.00 – 2.99 (Total Skor 50.0% – 74.9%): Predikat C (Cukup / Butuh Bimbingan IDP).',
        '• GPA < 2.00 (Total Skor < 50.0%): Predikat D (Kurang / Tidak Memenuhi Syarat). Wajib masuk pembinaan PIP 60 hari.',
      ],
      caseStudy: {
        title: 'Contoh Hitungan Rapor Budi Pratama',
        content: [
          '1. Skor KPI Terbobot: 92.50 × 50% = 46.25%',
          '2. Skor SOP Compliance: 96.00 × 20% = 19.20%',
          '3. Skor Kompetensi Teknis: 85.00 × 15% = 12.75%',
          '4. Skor Core Values 360°: 90.00 × 15% = 13.50%',
          'Total Akumulasi Skor = 46.25% + 19.20% + 12.75% + 13.50% = 91.70%.',
          'Nilai Akhir Composite GPA = (91.70 / 100) × 4.00 = 3.67 / 4.00 (Predikat A - Sangat Baik).',
        ],
      },
      legalBasis: 'Standar Perhitungan Rapor Kinerja Komposit Berimbang.',
    },
  },
  {
    id: 'hitung-3',
    category: 'perhitungan',
    categoryLabel: 'Formula & Kuota',
    categoryColor: 'bg-[#F1F1F1] text-[#202223] border-[#E1E3E5]',
    question: 'Bagaimana rumus indeks Quality of Hire (QoH) dihitung pada modul rekrutmen Pre-Employment?',
    summary: 'QoH = (30% × Skor Psikometri) + (40% × Skor Tes Teknis) + (30% × Skor Wawancara Kompetensi).',
    detail: {
      background:
        'Banyak kandidat yang pintar saat wawancara tetapi gagal saat tes keahlian teknis nyata, atau sebaliknya. Rumus QoH menyeimbangkan 3 instrumen uji seleksi.',
      explanation: [
        'Formula Baku ISO 30414 Quality of Hire:',
        'QoH = (0.30 × Skor Tes Psikometri) + (0.40 × Skor Uji Teknis/Koding) + (0.30 × Skor Wawancara Kompetensi User).',
        'Skala indeks berkisar antara 0 hingga 100.',
        '• Skor ≥ 85.0: Kategori "Exceptional Talent" (Sangat Layak Direkrut).',
        '• Skor 75.0 – 84.9: Kategori "Meets Expectations" (Standar Formasi Terpenuhi).',
        '• Skor < 75.0: Kategori "High Attrition Risk" (Beresiko Mengalami Ketidakcocokan Kerja).',
      ],
      caseStudy: {
        title: 'Simulasi Seleksi Calon Senior Cloud Engineer',
        content: [
          'Kandidat bernama Maya Safitri mengikuti tahapan seleksi dengan perolehan nilai:',
          '• Skor Tes Psikometri: 88 (bobot 30% = 26.4)',
          '• Skor Uji Teknis Cloud: 92 (bobot 40% = 36.8)',
          '• Skor Wawancara Direksi: 86 (bobot 30% = 25.8)',
          'Total Indeks QoH = 26.4 + 36.8 + 25.8 = 89.0 / 100 (Status: Siap Ditawarkan Kontrak / OFFERED).',
        ],
      },
      legalBasis: 'Standar Mutu Rekrutmen Internasional (ISO 30414:2019).',
    },
  },

  // ===================== 5. KAMUS ISTILAH AWAM (GLOSARIUM) =====================
  {
    id: 'glosarium-1',
    category: 'glosarium',
    categoryLabel: 'Kamus Awam',
    categoryColor: 'bg-[#F1F1F1] text-[#202223] border-[#E1E3E5]',
    question: 'Kamus Istilah: Apa arti KPI, Bobot, Composite GPA, dan Cascading Tree dalam bahasa sehari-hari?',
    summary: 'Penjelasan istilah teknis manajemen target dengan perumpamaan sederhana dunia nyata.',
    detail: {
      explanation: [
        '1. KPI (Key Performance Indicator) = Target Sasaran Kerja Nyata.',
        'Perumpamaan: Seperti target speedometer atau target jumlah kilometer yang harus Anda tempuh. Bukan sekadar "bekerja rajin", tapi jelas angkanya (misal: memperbaiki 50 bug, melatih 6 junior, atau efisiensi anggaran 10%).',
        '2. Bobot KPI (Weight) = Porsi Kepentingan Tugas.',
        'Perumpamaan: Dalam ujian sekolah, tugas akhir memiliki bobot 50% sedangkan PR harian berbobot 20%. Di kantor, tugas yang paling penting bagi divisi diberi bobot lebih besar (misal 30%), dan total seluruh tugas wajib pas 100%.',
        '3. Composite GPA = Nilai Rapor Gabungan Akhir Karyawan.',
        'Perumpamaan: Seperti Indeks Prestasi Kumulatif (IPK) saat kuliah dengan batas maksimal 4.00, namun tidak hanya dihitung dari hasil ujian (KPI), melainkan juga kehadiran/kepatuhan aturan (SOP), keahlian teknis (Kompetensi), dan perilaku kerja sama (Core Values).',
        '4. Cascading Tree = Pohon Penurunan Target Kerja.',
        'Perumpamaan: Seperti dahan pohon. Batang utama adalah target Direktur Utama. Dahan besar adalah target Kepala Divisi. Ranting kecil adalah target tugas Anda. Jika Anda menyelesaikan tugas di ranting Anda, secara otomatis dahan dan batang pohon ikut kokoh.',
      ],
    },
  },
  {
    id: 'glosarium-2',
    category: 'glosarium',
    categoryLabel: 'Kamus Awam',
    categoryColor: 'bg-[#F1F1F1] text-[#202223] border-[#E1E3E5]',
    question: 'Kamus Istilah: Apa bedanya Kinerja (Performance) dengan Potensi (Potential) di Matriks 9-Box?',
    summary: 'Kinerja adalah bukti rapor masa lalu dan kini, sedangkan Potensi adalah kapasitas belajar untuk memimpin di masa depan.',
    detail: {
      explanation: [
        'Banyak orang mengira karyawan yang paling pintar di kantor otomatis pasti cocok menjadi Direktur. Padahal keahlian bekerja teknis sangat berbeda dengan keahlian memimpin orang.',
        '• Kinerja (Performance - Sumbu X): Mengukur APA YANG SUDAH DIBUKTIKAN. Apakah target KPI tercapai? Apakah tidak pernah melanggar SOP? Jika ya, kinerjanya TINGGI.',
        '• Potensi (Potential - Sumbu Y): Mengukur KAPASITAS BELAJAR DAN KEPEMIMPINAN. Seberapa cepat ia mempelajari hal baru yang belum pernah diajarkan? Apakah ia mampu menenangkan tim saat krisis? Apakah ia memiliki visi strategis?',
        'Contoh Nyata:',
        'Seorang programmer jenius yang mampu menyelesaikan ribuan baris kode tanpa salah memiliki KINERJA TINGGI. Namun jika ia tidak suka berbicara dengan orang lain dan menolak mengelola bawahan, maka POTENSI KEPEMIMPINANNYA SEDANG/RENDAH (masuk ke Box 3: Trusted Pro). Ia tetap sangat dihargai dan gajinya tinggi sebagai Tenaga Ahli (SME), tanpa dipaksa menjadi manajer yang justru bisa membuatnya stres.',
      ],
    },
  },
  {
    id: 'glosarium-3',
    category: 'glosarium',
    categoryLabel: 'Kamus Awam',
    categoryColor: 'bg-[#F1F1F1] text-[#202223] border-[#E1E3E5]',
    question: 'Kamus Istilah: Apa arti BAST, LWD, LCI, dan PIP pada proses akhir kerja karyawan?',
    summary: 'Rangkaian istilah resmi serah terima barang kantor, tanggal hari kerja terakhir, rekam jejak paten, dan pembinaan.',
    detail: {
      explanation: [
        '1. LWD (Last Working Day) = Hari Kerja Terakhir: Tanggal resmi di mana karyawan berhenti bekerja aktif di kantor sebelum SK pengakhiran kerja diterbitkan.',
        '2. BAST (Berita Acara Serah Terima) Clearance: Dokumen checklist resmi yang membuktikan bahwa karyawan telah mengembalikan laptop kantor, kartu akses gedung, menghapus token akses SSO IT, dan menyelesaikan pinjaman dinas.',
        '3. LCI (Lifetime Contribution Index): Arsip rekam jejak kehormatan bagi karyawan yang menciptakan hak paten terdaftar atau inovasi efisiensi biaya (Kaizen) selama masa baktinya, sehingga jasanya tetap diakui selamanya di Hall of Fame korporasi.',
        '4. PIP (Performance Improvement Plan): Program bimbingan intensif selama 60 hari bagi karyawan yang nilai kinerjanya berada di bawah standar (Box 1 Underperformer) sebelum perusahaan mengambil keputusan status kepegawaian selanjutnya.',
      ],
    },
  },

  // ===================== 6. KEAMANAN DATA & ANTI-TAMPER GCG =====================
  {
    id: 'keamanan-1',
    category: 'keamanan',
    categoryLabel: 'Keamanan & GCG',
    categoryColor: 'bg-[#FFF8E5] text-[#5C4500] border-[#FEDB87]',
    question: 'Apa yang dimaksud dengan status "Terkunci Permanen" dan bagaimana E-PerformIQ melindungi nilai dari manipulasi?',
    summary: 'Sistem penguncian otomatis yang menjaga agar nilai tidak dapat diedit atau dihapus sepihak setelah disahkan oleh komite.',
    detail: {
      background:
        'Pada cara kerja konvensional, nilai rawan diubah diam-diam oleh pihak tertentu setelah masa evaluasi selesai. Di E-PerformIQ, hal tersebut dicegah melalui sistem penguncian otomatis berstandar audit perbankan dan tata kelola GCG.',
      explanation: [
        'Ketika Komite Penilai (Assessor) mengesahkan penilaian seorang karyawan, sistem langsung mengaktifkan kunci pengaman resmi (status Terkalibrasi / Sah).',
        'Setelah berstatus terkunci, sistem secara otomatis menolak segala upaya pengeditan maupun penghapusan nilai dari pihak mana pun tanpa kecuali.',
        'Bagaimana jika terjadi kekeliruan administrasi yang sah?',
        'Nilai hanya dapat diperbaiki melalui prosedur pembukaan kunci resmi yang memerlukan izin tertulis dari Direktur Human Capital dengan menyertakan alasan yang jelas. Setiap proses perbaikan nilai otomatis dicatat di buku riwayat audit sistem yang tidak dapat dihapus, sehingga Satuan Pengawas Internal (SPI) dapat memantau transparansinya kapan saja.',
      ],
      legalBasis: 'Standar Integritas & Penguncian Nilai Resmi (Pedoman KNKG RI).',
    },
  },
  {
    id: 'keamanan-2',
    category: 'keamanan',
    categoryLabel: 'Keamanan & GCG',
    categoryColor: 'bg-[#FFF8E5] text-[#5C4500] border-[#FEDB87]',
    question: 'Apakah evaluasi rekan sejawat (Ulasan 360°) benar-benar rahasia dan anonim?',
    summary: 'Identitas pemberi nilai dirahasiakan sepenuhnya; rekan kerja yang dinilai hanya menerima skor rata-rata gabungan.',
    detail: {
      background:
        'Karyawan sering merasa sungkan atau khawatir memberikan penilaian jujur kepada rekan kerja karena takut menimbulkan ketegangan di lingkungan kantor.',
      explanation: [
        'E-PerformIQ menerapkan sistem evaluasi rekan kerja tertutup (rahasia):',
        '• Saat Anda mengisi evaluasi pada formulir Ulasan 360°, sistem hanya menyimpan masukan dan skor budaya kerja secara terpisah dari nama Anda.',
        '• Rekan yang dinilai hanya akan melihat skor rata-rata gabungan dari semua penilai (misalnya: Nilai Kerja Sama Tim = 4.5 / 5.0) dan rangkuman masukan positif tanpa pernah mengetahui siapa yang memberikan nilai tersebut.',
        '• Langkah ini memastikan setiap karyawan dapat memberikan masukan yang jujur, objektif, dan membangun demi kemajuan bersama tanpa rasa sungkan atau khawatir.',
      ],
      legalBasis: 'Standar Evaluasi Rekan Kerja Terbuka & Rahasia.',
    },
  },
  {
    id: 'keamanan-3',
    category: 'keamanan',
    categoryLabel: 'Keamanan & GCG',
    categoryColor: 'bg-[#FFF8E5] text-[#5C4500] border-[#FEDB87]',
    question: 'Bagaimana cara Auditor Satuan Pengawas Internal (SPI) memeriksa jejak audit dengan fitur "Lihat Diff"?',
    summary: 'Memeriksa perbandingan data sebelum dan sesudah perubahan secara bersebelahan agar transparan.',
    detail: {
      background:
        'Dalam proses pengawasan tata kelola perusahaan yang baik (GCG), pemeriksa tidak hanya perlu tahu kapan data diperbarui, tetapi juga angka atau kata apa saja yang diubah agar tidak terjadi kekeliruan atau kecurangan.',
      explanation: [
        'Di halaman "GCG Audit & Compliance" pada menu navigasi samping, setiap aktivitas penting (seperti pengesahan nilai, persetujuan target kerja, atau pembukaan kunci) dicatat secara otomatis dalam dua rekaman:',
        '1. Rekaman Data Semula: Kondisi nilai atau dokumen persis sebelum dilakukan perubahan.',
        '2. Rekaman Data Baru: Kondisi nilai atau dokumen setelah disimpan.',
        'Dengan mengeklik tombol "Lihat Diff", pemeriksa internal (SPI) dapat langsung melihat perbandingan antara data lama dan data baru secara bersebelahan dan transparan.',
      ],
      legalBasis: 'Pedoman Transparansi & Jejak Pengawasan GCG (Standar KNKG RI).',
    },
  },
];
