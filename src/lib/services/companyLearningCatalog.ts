/**
 * Company Professional Learning Module (PLM) Reference — acuan kurikulum
 * pembelajaran profesional perusahaan E-PerformIQ.
 *
 * Katalog ini adalah "rujukan" (grounding) yang dipakai oleh fitur berbantuan
 * AI: (a) generate kurikulum onboarding per-posisi, dan (b) pencarian materi
 * OER gratis. Tujuannya agar rekomendasi AI SELALU selaras dengan jalur
 * pembelajaran profesional yang sudah dibakukan perusahaan, bukan mengarang
 * topik dari nol.
 *
 * Struktur: setiap "family" (rumpun peran) punya tahapan belajar (learning
 * path) berisi modul-modul acuan dengan tingkat (Foundation/Intermediate/
 * Advanced) dan kata kunci keahlian terkait.
 */

export type PlmLevel = 'Foundation' | 'Intermediate' | 'Advanced';

export interface PlmModule {
  /** Judul modul acuan perusahaan. */
  title: string;
  /** Tingkat kedalaman. */
  level: PlmLevel;
  /** Kata kunci keahlian untuk pencocokan posisi/OER (huruf kecil). */
  skills: string[];
}

export interface PlmFamily {
  /** Rumpun peran (mis. teknologi, SDM, keuangan). */
  name: string;
  /** Kata kunci pemicu agar posisi dipetakan ke rumpun ini. */
  triggers: string[];
  modules: PlmModule[];
}

/** Rujukan Professional Learning Module perusahaan (kurasi internal). */
export const COMPANY_PLM: PlmFamily[] = [
  {
    name: 'Teknologi & Rekayasa Perangkat Lunak',
    triggers: ['engineer', 'developer', 'programmer', 'software', 'it', 'ti', 'data', 'devops', 'qa', 'teknologi'],
    modules: [
      { title: 'Fondasi Rekayasa Perangkat Lunak & SDLC', level: 'Foundation', skills: ['sdlc', 'agile', 'git', 'software engineer'] },
      { title: 'Pemrograman Modern & Kualitas Kode', level: 'Intermediate', skills: ['typescript', 'javascript', 'python', 'backend', 'frontend', 'clean code'] },
      { title: 'Basis Data & Perancangan Skema', level: 'Intermediate', skills: ['sql', 'postgresql', 'database', 'basis data'] },
      { title: 'Cloud, DevOps & Keandalan Sistem', level: 'Advanced', skills: ['cloud', 'aws', 'devops', 'ci/cd', 'kubernetes'] },
      { title: 'Keamanan Aplikasi & Perlindungan Data', level: 'Advanced', skills: ['security', 'keamanan', 'owasp', 'privasi'] },
    ],
  },
  {
    name: 'Data, Analitik & Kecerdasan Artifisial',
    triggers: ['data', 'analyst', 'analis', 'ai', 'ml', 'scientist', 'business intelligence', 'bi'],
    modules: [
      { title: 'Literasi Data & Statistik Terapan', level: 'Foundation', skills: ['statistik', 'data', 'analitik', 'excel'] },
      { title: 'Analitik Data & Visualisasi', level: 'Intermediate', skills: ['analytics', 'power bi', 'tableau', 'python', 'data science'] },
      { title: 'Machine Learning Terapan', level: 'Advanced', skills: ['machine learning', 'ml', 'ai', 'model'] },
    ],
  },
  {
    name: 'Sumber Daya Manusia & Human Capital',
    triggers: ['hr', 'human capital', 'sdm', 'rekrutmen', 'recruiter', 'people', 'talent', 'personalia'],
    modules: [
      { title: 'Fondasi Human Capital & Regulasi Ketenagakerjaan', level: 'Foundation', skills: ['hr', 'ketenagakerjaan', 'sdm', 'compliance'] },
      { title: 'Manajemen Talenta & Rekrutmen Berbasis Kompetensi', level: 'Intermediate', skills: ['rekrutmen', 'talent', 'kompetensi', 'interview'] },
      { title: 'Perencanaan Tenaga Kerja & Manpower Planning', level: 'Intermediate', skills: ['manpower planning', 'workforce', 'perencanaan'] },
      { title: 'Kepemimpinan & Pengembangan Organisasi', level: 'Advanced', skills: ['leadership', 'kepemimpinan', 'organisasi', 'people development'] },
    ],
  },
  {
    name: 'Keuangan, Akuntansi & Payroll',
    triggers: ['finance', 'keuangan', 'akuntan', 'accounting', 'payroll', 'tax', 'pajak', 'treasury', 'audit'],
    modules: [
      { title: 'Fondasi Akuntansi & Pelaporan Keuangan', level: 'Foundation', skills: ['akuntansi', 'accounting', 'laporan keuangan'] },
      { title: 'Perpajakan & Kepatuhan Fiskal', level: 'Intermediate', skills: ['pajak', 'tax', 'fiskal', 'compliance'] },
      { title: 'Analisis Keuangan & Penganggaran', level: 'Intermediate', skills: ['budgeting', 'anggaran', 'analisis keuangan', 'finance'] },
    ],
  },
  {
    name: 'Operasional, Produksi & K3',
    triggers: ['operasional', 'produksi', 'operasi', 'lapangan', 'pabrik', 'logistik', 'supply chain', 'safety', 'k3'],
    modules: [
      { title: 'Keselamatan & Kesehatan Kerja (K3) Dasar', level: 'Foundation', skills: ['k3', 'keselamatan', 'safety', 'operasional'] },
      { title: 'Manajemen Operasional & Perbaikan Berkelanjutan', level: 'Intermediate', skills: ['operasional', 'lean', 'kaizen', 'efisiensi'] },
      { title: 'Manajemen Rantai Pasok & Logistik', level: 'Intermediate', skills: ['supply chain', 'logistik', 'inventory', 'gudang'] },
    ],
  },
  {
    name: 'Pemasaran, Penjualan & Layanan Pelanggan',
    triggers: ['marketing', 'pemasaran', 'sales', 'penjualan', 'customer', 'layanan', 'brand', 'komunikasi'],
    modules: [
      { title: 'Fondasi Pemasaran & Perilaku Konsumen', level: 'Foundation', skills: ['marketing', 'pemasaran', 'brand'] },
      { title: 'Penjualan Konsultatif & Manajemen CRM', level: 'Intermediate', skills: ['sales', 'penjualan', 'crm', 'customer'] },
      { title: 'Layanan Pelanggan & Penanganan Keluhan', level: 'Intermediate', skills: ['customer service', 'layanan', 'keluhan'] },
    ],
  },
  {
    name: 'Umum — Budaya, Tata Kelola & Kepemimpinan',
    triggers: [],
    modules: [
      { title: 'Budaya Kerja & Nilai Inti AKHLAK', level: 'Foundation', skills: ['akhlaq', 'budaya', 'nilai inti', 'etika'] },
      { title: 'Tata Kelola Perusahaan & Kepatuhan (GCG)', level: 'Foundation', skills: ['gcg', 'tata kelola', 'kepatuhan', 'compliance'] },
      { title: 'Komunikasi Efektif & Kolaborasi Lintas Fungsi', level: 'Intermediate', skills: ['komunikasi', 'kolaborasi', 'presentasi'] },
      { title: 'Manajemen Proyek & Manajemen Waktu', level: 'Intermediate', skills: ['project management', 'manajemen waktu', 'agile'] },
    ],
  },
];

/**
 * Memilih rumpun PLM yang paling relevan dengan judul posisi + skill wajib.
 * Mengembalikan daftar modul acuan (selalu menyertakan rumpun Umum sebagai dasar).
 */
export function selectPlmModules(positionTitle: string, requiredSkills: string[] = []): { family: string; modules: PlmModule[] }[] {
  const hay = `${positionTitle} ${requiredSkills.join(' ')}`.toLowerCase();
  const picked: { family: string; modules: PlmModule[] }[] = [];
  const general = COMPANY_PLM.find((f) => f.triggers.length === 0)!;
  for (const fam of COMPANY_PLM) {
    if (fam.triggers.length === 0) continue;
    if (fam.triggers.some((t) => hay.includes(t))) picked.push({ family: fam.name, modules: fam.modules });
  }
  // Selalu sertakan modul umum sebagai fondasi.
  picked.push({ family: general.name, modules: general.modules });
  return picked.slice(0, 3);
}

/** Daftar kata kunci keahlian dari rumpun PLM terpilih (untuk pencocokan OER). */
export function plmSkillKeywords(positionTitle: string, requiredSkills: string[] = []): string[] {
  const picked = selectPlmModules(positionTitle, requiredSkills);
  const out = new Set<string>();
  for (const p of picked) for (const m of p.modules) for (const s of m.skills) out.add(s);
  for (const s of requiredSkills) if (s && s.trim()) out.add(s.trim().toLowerCase());
  return Array.from(out);
}

/** Ringkasan rujukan PLM sebagai teks untuk prompt AI. */
export function plmReferenceForPrompt(positionTitle: string, requiredSkills: string[] = []): string {
  const picked = selectPlmModules(positionTitle, requiredSkills);
  return picked
    .map((p) => `[${p.family}] ${p.modules.map((m) => `${m.title} (${m.level})`).join('; ')}`)
    .join('\n');
}
