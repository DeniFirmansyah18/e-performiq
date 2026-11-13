/**
 * OER Catalog Service — sumber materi pembelajaran gratis (Open Educational
 * Resources) untuk modul bertipe VIDEO/PDF, plus validasi tautan tepercaya.
 *
 * Katalog bersifat terkurasi (bukan hasil web-scraping): tiap entri memetakan
 * kata kunci/topik ke tautan resmi penyedia gratis. Generator kurikulum (dengan
 * bantuan AI) mencocokkan topik posisi ke katalog ini, sehingga tautan yang
 * disimpan selalu berasal dari domain tepercaya — tanpa membutuhkan API key
 * tambahan dan tanpa risiko tautan mati/tidak aman.
 */

/**
 * Domain tepercaya (whitelist) untuk modul tipe VIDEO/PDF (OER).
 *
 * Hanya penyedia yang mengizinkan materi diakses publik/audit. Tautan
 * disimpan sebagai RUJUKAN (redirect), bukan salinan materi, sehingga hak
 * cipta tetap pada penyedianya.
 */
export const TRUSTED_OER_DOMAINS: string[] = [
  // ----- Universitas & OER murni -----
  'open.edu',              // OpenLearn (Open University)
  'openlearn.open.ac.uk',
  'ocw.mit.edu',           // MIT OpenCourseWare
  'ocw.tudelft.nl',        // TU Delft OpenCourseWare
  'oyc.yale.edu',          // Yale Open Courses
  'web.stanford.edu',      // materi publik Stanford
  'openstax.org',          // buku teks CC-BY
  'libretexts.org',        // perpustakaan OER
  'oercommons.org',        // katalog OER
  'open.umn.edu',          // Open Textbook Library
  'merlot.org',            // MERLOT (OER terkurasi)
  'openintrolab.github.io',
  'khanacademy.org',
  'kubernetes.io',         // dokumentasi resmi Kubernetes (CC-BY-4.0)
  'docs.flutter.dev',      // dokumentasi resmi Flutter

  // ----- Penyedia industri (gratis / audit) -----
  'learn.microsoft.com',   // Microsoft Learn
  'docs.microsoft.com',
  'aws.amazon.com',        // AWS Skill Builder / Training
  'cloud.google.com',      // Google Cloud Skills Boost
  'developers.google.com',
  'skillshop.exceedlms.com', // Google Skillshop (sertifikat gratis)
  'skillsbuild.org',       // IBM SkillsBuild
  'alison.com',            // Alison (kursus gratis)
  'freecodecamp.org',
  'theodinproject.com',    // The Odin Project
  'roadmap.sh',            // peta jalan belajar
  'github.com',            // repo materi/roadmap publik
  'coursera.org',          // audit mode
  'edx.org',               // audit mode
  'class-central.com',     // DIREKTORI kursus (bukan pengganti materi)
  'moodle.net',            // MoodleNet (kursus komunitas)
  'moodleshare.org',       // MoodleShare
  'openlms.net',           // Open LMS courses

  // ----- Video dari kanal resmi -----
  'youtube.com',
  'youtu.be',
];

/**
 * Penyedia yang secara RESMI mengizinkan pengambilan data otomatis (API
 * publik / materi berlisensi terbuka). Hanya domain ini yang boleh diambil
 * program; selain itu penautan manual.
 */
export const SCRAPE_ALLOWED_DOMAINS: string[] = [
  'openverse.org',         // API publik, konten CC
  'api.openverse.org',
  'archive.org',           // Internet Archive API publik
  'commons.wikimedia.org', // Wikimedia
  'api.wikimedia.org',
  'ocw.mit.edu',           // MIT OCW terbuka
];

/** Apakah penyedia mengizinkan pengambilan data otomatis. */
export function bolehDiambilOtomatis(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return SCRAPE_ALLOWED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export interface OerResource {
  /** Judul materi gratis. */
  title: string;
  /** Tautan https ke sumber. */
  url: string;
  /** Penyedia (label singkat). */
  provider: string;
  /** Topik/kata kunci terkait (huruf kecil). */
  topics: string[];
}

/** Katalog OER terkurasi (gratis). Tambah entri baru di sini bila perlu. */
export const OER_CATALOG: OerResource[] = [
  // ----- Umum / budaya & kepatuhan -----
  { title: 'Kode Etik & Integritas di Tempat Kerja', url: 'https://www.open.edu/openlearn/money-business/business-organisation-management/business-ethics/content-section-0', provider: 'OpenLearn', topics: ['etika', 'kode etik', 'integritas', 'compliance', 'gcg', 'kepatuhan'] },
  { title: 'Manajemen Waktu & Produktivitas Kerja', url: 'https://www.open.edu/openlearn/money-business/managing-time-and-priorities/content-section-0', provider: 'OpenLearn', topics: ['produktivitas', 'manajemen waktu', 'prioritas', 'time management'] },
  { title: 'Komunikasi Efektif di Tempat Kerja', url: 'https://www.open.edu/openlearn/money-business/communication-workplace/content-section-0', provider: 'OpenLearn', topics: ['komunikasi', 'communication', 'presentasi', 'kolaborasi'] },

  // ----- Software / teknis -----
  { title: 'Dasar TypeScript & JavaScript Modern', url: 'https://learn.microsoft.com/en-us/training/paths/build-javascript-applications-typescript/', provider: 'Microsoft Learn', topics: ['typescript', 'javascript', 'node', 'nodejs', 'frontend', 'backend'] },
  { title: 'Membangun Aplikasi Web Modern (React/Next.js)', url: 'https://learn.microsoft.com/en-us/training/paths/react/', provider: 'Microsoft Learn', topics: ['react', 'next', 'nextjs', 'frontend', 'web', 'ui'] },
  { title: 'Dasar PostgreSQL & Basis Data Relasional', url: 'https://learn.microsoft.com/en-us/training/paths/azure-database-developer/', provider: 'Microsoft Learn', topics: ['postgres', 'postgresql', 'database', 'sql', 'basis data'] },
  { title: 'Dasar Cloud (AWS Cloud Practitioner Essentials)', url: 'https://aws.amazon.com/training/learn-about/cloud-practitioner/', provider: 'AWS', topics: ['cloud', 'aws', 'devops', 'infrastruktur'] },
  { title: 'Google Cloud Fundamentals', url: 'https://cloud.google.com/learn/training/cloud-fundamentals', provider: 'Google Cloud', topics: ['cloud', 'gcp', 'google cloud', 'devops'] },
  { title: 'Peta Jalan Belajar Backend & Fullstack (roadmap.sh)', url: 'https://roadmap.sh/backend', provider: 'roadmap.sh', topics: ['backend', 'fullstack', 'roadmap', 'software engineer'] },
  { title: 'Peta Jalan Belajar Frontend (roadmap.sh)', url: 'https://roadmap.sh/frontend', provider: 'roadmap.sh', topics: ['frontend', 'web', 'ui', 'software engineer'] },

  // ----- Data / AI -----
  { title: 'Dasar Machine Learning (MIT OCW)', url: 'https://ocw.mit.edu/courses/6-036-introduction-to-machine-learning-fall-2020/', provider: 'MIT OCW', topics: ['machine learning', 'ai', 'ml', 'data science', 'artificial intelligence'] },
  { title: 'Data Science & Analitik Data (freeCodeCamp)', url: 'https://www.freecodecamp.org/learn/data-analysis-with-python/', provider: 'freeCodeCamp', topics: ['data', 'analitik', 'analytics', 'python', 'data science'] },

  // ----- Human Capital / HR / Manajemen -----
  { title: 'Manajemen Sumber Daya Manusia', url: 'https://www.open.edu/openlearn/money-business/human-resource-management/content-section-0', provider: 'OpenLearn', topics: ['hr', 'human capital', 'sdm', 'rekrutmen', 'people'] },
  { title: 'Kepemimpinan & Manajemen Tim', url: 'https://www.open.edu/openlearn/money-business/leadership-and-management/content-section-0', provider: 'OpenLearn', topics: ['leadership', 'kepemimpinan', 'manajemen', 'manager', 'team'] },
  { title: 'Dasar Manajemen Proyek', url: 'https://www.open.edu/openlearn/money-business/introduction-project-management/content-section-0', provider: 'OpenLearn', topics: ['project management', 'proyek', 'manajemen proyek', 'agile'] },

  // ----- Keuangan / Sipil / Operasional (fallback umum) -----
  { title: 'Dasar-Dasar Akuntansi & Keuangan', url: 'https://www.open.edu/openlearn/money-business/introduction-bookkeeping-and-accounting/content-section-0', provider: 'OpenLearn', topics: ['akuntansi', 'keuangan', 'finance', 'payroll', 'accounting'] },
  { title: 'Keselamatan & Kesehatan Kerja (K3)', url: 'https://www.open.edu/openlearn/money-business/introduction-managing-health-and-safety/content-section-0', provider: 'OpenLearn', topics: ['k3', 'keselamatan', 'safety', 'operasional', 'lapangan'] },

  // ===== Posisi: Lead Cloud & DevOps Engineer =====
  { title: 'DevOps on AWS (AWS Skill Builder)', url: 'https://aws.amazon.com/training/digital/', provider: 'AWS', topics: ['devops', 'ci/cd', 'pipeline', 'kubernetes', 'docker', 'cloud engineer', 'lead cloud'] },
  { title: 'Kubernetes & Container Orchestration', url: 'https://kubernetes.io/docs/tutorials/', provider: 'Kubernetes Docs', topics: ['kubernetes', 'container', 'orchestration', 'devops', 'cloud'] },
  { title: 'Google Cloud Skills Boost — Cloud Engineering', url: 'https://cloud.google.com/learn/training/cloud-fundamentals', provider: 'Google Cloud', topics: ['cloud', 'gcp', 'cloud engineer', 'devops'] },

  // ===== Posisi: Cyber Security & IT Governance Specialist =====
  { title: 'Keamanan Informasi & Kepatuhan (OpenLearn)', url: 'https://www.open.edu/openlearn/science-maths-technology/introduction-cyber-security/content-section-0', provider: 'OpenLearn', topics: ['cyber security', 'keamanan informasi', 'security', 'it governance', 'iso 27001', 'audit'] },
  { title: 'Microsoft Security, Compliance & Identity Fundamentals', url: 'https://learn.microsoft.com/en-us/training/courses/sc-900t00', provider: 'Microsoft Learn', topics: ['security', 'compliance', 'identity', 'keamanan', 'cyber security'] },

  // ===== Posisi: Data Engineer & Analytics Specialist =====
  { title: 'Azure Data Fundamentals (DP-900)', url: 'https://learn.microsoft.com/en-us/training/courses/dp-900t00', provider: 'Microsoft Learn', topics: ['data engineer', 'data', 'analytics', 'etl', 'database', 'bi'] },
  { title: 'Pengantar Ilmu Data (MIT OCW)', url: 'https://ocw.mit.edu/courses/6-0002-introduction-to-computational-thinking-and-data-science-fall-2016/', provider: 'MIT OCW', topics: ['data science', 'analitik', 'analytics', 'python', 'data engineer'] },

  // ===== Posisi: Mobile Application Developer =====
  { title: 'Dasar Pengembangan Aplikasi Android (Google)', url: 'https://developers.google.com/learn/training/android', provider: 'Google Developers', topics: ['android', 'mobile', 'aplikasi', 'kotlin', 'mobile developer'] },
  { title: 'Flutter & Cross-Platform Mobile', url: 'https://docs.flutter.dev/get-started/codelab', provider: 'Google Developers', topics: ['flutter', 'mobile', 'cross platform', 'dart', 'mobile developer'] },

  // ===== Posisi: Lead UI/UX & Product Designer =====
  { title: 'Desain Pengalaman Pengguna (OpenLearn)', url: 'https://www.open.edu/openlearn/science-maths-technology/design-thinking/content-section-0', provider: 'OpenLearn', topics: ['ui', 'ux', 'design thinking', 'product design', 'user experience', 'desainer'] },
  { title: 'Design Thinking & Riset Pengguna', url: 'https://www.open.edu/openlearn/education-development/design-thinking/content-section-0', provider: 'OpenLearn', topics: ['design thinking', 'ux', 'riset pengguna', 'product'] },

  // ===== Posisi: Technical Support & Operations Specialist =====
  { title: 'Dasar Dukungan TI & Layanan Operasional', url: 'https://learn.microsoft.com/en-us/training/courses/it-support', provider: 'Microsoft Learn', topics: ['technical support', 'helpdesk', 'it support', 'operations', 'troubleshooting'] },
  { title: 'ITIL — Manajemen Layanan TI', url: 'https://www.open.edu/openlearn/money-business/management-lifecycle/content-section-0', provider: 'OpenLearn', topics: ['itil', 'service management', 'operations', 'support', 'layanan ti'] },

  // ===== Posisi: Head of Engineering & Ops =====
  { title: 'Kepemimpinan Teknis & Manajemen Tim Engineering', url: 'https://roadmap.sh/engineering-manager', provider: 'roadmap.sh', topics: ['engineering manager', 'head of engineering', 'leadership', 'kepemimpinan teknis', 'ops'] },
  { title: 'Manajemen Proyek Teknologi (Agile & Scrum)', url: 'https://www.open.edu/openlearn/money-business/introduction-project-management/content-section-0', provider: 'OpenLearn', topics: ['agile', 'scrum', 'project management', 'engineering manager', 'ops'] },

  // ===== Posisi: Junior Software Engineer (Internship) =====
  { title: 'Belajar Pemrograman dari Nol (The Odin Project)', url: 'https://www.theodinproject.com/paths/foundations/courses/foundations', provider: 'The Odin Project', topics: ['junior developer', 'internship', 'magang', 'pemrograman dasar', 'software engineer', 'html', 'css'] },
  { title: 'Git & Version Control untuk Pemula', url: 'https://learn.microsoft.com/en-us/training/paths/intro-to-vc-git/', provider: 'Microsoft Learn', topics: ['git', 'version control', 'junior developer', 'magang', 'internship', 'software engineer'] },

  // ===== Posisi: Senior Talent Acquisition Lead =====
  { title: 'Rekrutmen & Seleksi Talenta (OpenLearn)', url: 'https://www.open.edu/openlearn/money-business/human-resource-management/content-section-0', provider: 'OpenLearn', topics: ['talent acquisition', 'rekrutmen', 'recruitment', 'seleksi', 'hiring', 'interview'] },
  { title: 'Teknik Wawancara & Penilaian Kandidat', url: 'https://www.open.edu/openlearn/money-business/recruitment-and-selection/content-section-0', provider: 'OpenLearn', topics: ['interview', 'wawancara', 'rekrutmen', 'talent acquisition', 'seleksi'] },

  // ===== Posisi: Learning & Organizational Development Specialist =====
  { title: 'Pengembangan Organisasi & Pembelajaran', url: 'https://www.open.edu/openlearn/education-development/organisational-development/content-section-0', provider: 'OpenLearn', topics: ['learning development', 'organizational development', 'od', 'pelatihan', 'training', 'learning'] },
  { title: 'Desain Program Pelatihan Karyawan', url: 'https://www.open.edu/openlearn/education-development/learning-and-development/content-section-0', provider: 'OpenLearn', topics: ['training design', 'pelatihan', 'learning', 'ld', 'kurikulum'] },

  // ===== Posisi: Compensation & Benefit Specialist =====
  { title: 'Manajemen Kompensasi & Tunjangan', url: 'https://www.open.edu/openlearn/money-business/reward-management/content-section-0', provider: 'OpenLearn', topics: ['kompensasi', 'compensation', 'benefit', 'payroll', 'tunjangan', 'remunerasi'] },
  { title: 'Dasar Payroll & Perpajakan Karyawan', url: 'https://www.open.edu/openlearn/money-business/introduction-bookkeeping-and-accounting/content-section-0', provider: 'OpenLearn', topics: ['payroll', 'pph21', 'kompensasi', 'benefit', 'perpajakan'] },

  // ===== Posisi: HR System Administrator =====
  { title: 'Sistem Informasi SDM (HRIS)', url: 'https://www.open.edu/openlearn/money-business/human-resource-management/content-section-0', provider: 'OpenLearn', topics: ['hris', 'hr system', 'hr admin', 'administrasi sdm', 'database hr'] },
  { title: 'Microsoft Excel & Analitik Data untuk HR', url: 'https://learn.microsoft.com/en-us/training/paths/excel-data-analysis/', provider: 'Microsoft Learn', topics: ['excel', 'hr admin', 'hris', 'analitik', 'data'] },

  // ===== Posisi: VP of Human Capital =====
  { title: 'Manajemen Sumber Daya Manusia Strategis', url: 'https://www.open.edu/openlearn/money-business/human-resource-management/content-section-0', provider: 'OpenLearn', topics: ['vp human capital', 'hc', 'strategis', 'human capital', 'sdm'] },
  { title: 'Kepemimpinan Strategis & Manajemen Perubahan', url: 'https://www.open.edu/openlearn/money-business/leadership-and-management/content-section-0', provider: 'OpenLearn', topics: ['leadership', 'change management', 'strategis', 'vice president'] },

  // ===== Posisi: Chief Internal Auditor =====
  { title: 'Audit Internal & Pengendalian Internal', url: 'https://www.open.edu/openlearn/money-business/auditing/content-section-0', provider: 'OpenLearn', topics: ['audit', 'audit internal', 'internal auditor', 'pengendalian', 'kontrol', 'gcg'] },
  { title: 'Tata Kelola Perusahaan & Manajemen Risiko', url: 'https://www.open.edu/openlearn/money-business/corporate-governance/content-section-0', provider: 'OpenLearn', topics: ['governance', 'gcg', 'risiko', 'risk management', 'audit'] },

  // ===== Posisi: Risk & Governance Compliance Analyst =====
  { title: 'Manajemen Risiko Perusahaan', url: 'https://www.open.edu/openlearn/money-business/managing-risk/content-section-0', provider: 'OpenLearn', topics: ['risk', 'risiko', 'risk management', 'compliance', 'grc'] },
  { title: 'Kepatuhan & Regulasi (Compliance)', url: 'https://www.open.edu/openlearn/money-business/business-ethics/content-section-0', provider: 'OpenLearn', topics: ['compliance', 'kepatuhan', 'regulasi', 'governance', 'risk analyst'] },

  // ===== Posisi: Lead Talent Assessor & Facilitator =====
  { title: 'Asesmen Kompetensi & Pengembangan Talenta', url: 'https://www.open.edu/openlearn/education-development/assessment-and-development/content-section-0', provider: 'OpenLearn', topics: ['asesmen', 'assessment', 'talent', 'talenta', 'facilitator', 'kompetensi'] },
  { title: 'Teknik Fasilitasi & Pelatihan Kelompok', url: 'https://www.open.edu/openlearn/education-development/facilitating-learning/content-section-0', provider: 'OpenLearn', topics: ['facilitator', 'fasilitasi', 'pelatihan', 'trainer', 'asesor'] },

  // ===== Posisi: Chief Executive Officer (CEO) =====
  { title: 'Kepemimpinan Eksekutif & Strategi Bisnis', url: 'https://www.open.edu/openlearn/money-business/strategic-management/content-section-0', provider: 'OpenLearn', topics: ['ceo', 'executive', 'strategi', 'strategic', 'leadership', 'board'] },
  { title: 'Tata Kelola & Hubungan Pemangku Kepentingan', url: 'https://www.open.edu/openlearn/money-business/corporate-governance/content-section-0', provider: 'OpenLearn', topics: ['ceo', 'governance', 'stakeholder', 'board', 'eksekutif'] },

  // ===== Sertifikat & kuis gratis (penautan) =====
  { title: 'Google Skillshop — Sertifikat Gratis (Pemasaran & Data)', url: 'https://skillshop.exceedlms.com/student/catalog', provider: 'Google Skillshop', topics: ['sertifikat', 'certificate', 'digital marketing', 'data', 'kuis', 'asesmen'] },
  { title: 'IBM SkillsBuild — Kursus & Badge Gratis', url: 'https://skillsbuild.org/students/course-catalog', provider: 'IBM SkillsBuild', topics: ['sertifikat', 'badge', 'certificate', 'ai', 'data', 'cyber security'] },
  { title: 'Alison — Kursus Gratis Bersertifikat', url: 'https://alison.com/courses', provider: 'Alison', topics: ['sertifikat', 'certificate', 'kursus gratis', 'hr', 'finance', 'it'] },
  { title: 'OpenLearn — Kursus Gratis Bersertifikat', url: 'https://www.open.edu/openlearn/free-courses', provider: 'OpenLearn', topics: ['sertifikat', 'certificate', 'free course', 'kursus gratis'] },
  { title: 'MoodleShare — Kursus Moodle Siap Impor', url: 'https://moodleshare.org/', provider: 'MoodleShare', topics: ['moodle', 'impor', 'mbz', 'kursus siap pakai', 'kuis'] },
];

/** Apakah sebuah host termasuk domain OER tepercaya. */
export function isTrustedOerUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    return TRUSTED_OER_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/**
 * Validasi tautan modul. Untuk tipe selain VIDEO/PDF, tautan boleh kosong atau
 * mengikuti aturan longgar (https). Untuk VIDEO/PDF, tautan WAJIB https dan
 * berasal dari domain tepercaya.
 */
export function validateModuleUrl(contentType: string, url: string | null): { ok: boolean; reason?: string } {
  if (contentType !== 'VIDEO' && contentType !== 'PDF') return { ok: true };
  if (!url || !url.trim()) return { ok: false, reason: 'Modul VIDEO/PDF wajib memiliki tautan materi.' };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'Tautan materi tidak valid.' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'Tautan materi harus menggunakan https.' };
  if (!isTrustedOerUrl(url)) {
    return { ok: false, reason: 'Tautan materi harus dari domain tepercaya (OpenLearn, Microsoft Learn, AWS, Google Cloud, freeCodeCamp, MIT OCW, dsb.).' };
  }
  return { ok: true };
}

/**
 * Mencocokkan kata kunci/topik ke katalog OER. Mengembalikan hingga `limit`
 * sumber paling relevan (skor = jumlah topik yang cocok, urutan katalog sebagai
 * tie-breaker agar deterministik).
 */
export function matchOerResources(keywords: string[], limit = 3): OerResource[] {
  const terms = keywords
    .flatMap((k) => k.toLowerCase().split(/[^a-z0-9+.#]+/))
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (terms.length === 0) return OER_CATALOG.slice(0, limit);

  const scored = OER_CATALOG.map((res, idx) => {
    let score = 0;
    const haystack = `${res.title} ${res.provider} ${res.topics.join(' ')}`.toLowerCase();
    for (const topic of res.topics) {
      if (terms.some((t) => topic.includes(t) || t.includes(topic))) score += 2;
    }
    // Cocokkan juga kata pada judul/penyedia (skor lebih rendah) agar kueri
    // umum seperti "microsoft" atau "react" tetap menemukan materi relevan.
    for (const t of terms) {
      if (t.length >= 3 && haystack.includes(t)) score += 1;
    }
    return { res, score, idx };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.idx - b.idx);

  return scored.slice(0, limit).map((s) => s.res);
}
