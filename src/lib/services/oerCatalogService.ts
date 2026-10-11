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

/** Domain tepercaya (whitelist) untuk modul tipe VIDEO/PDF (OER). */
export const TRUSTED_OER_DOMAINS: string[] = [
  'open.edu',              // OpenLearn (Open University)
  'openlearn.open.ac.uk',
  'learn.microsoft.com',   // Microsoft Learn
  'docs.microsoft.com',
  'aws.amazon.com',        // AWS Skill Builder / Training
  'cloud.google.com',      // Google Cloud Skills Boost
  'developers.google.com',
  'freecodecamp.org',
  'youtube.com',           // kanal resmi (mis. freeCodeCamp, MIT OCW)
  'youtu.be',
  'ocw.mit.edu',           // MIT OpenCourseWare
  'khanacademy.org',
  'coursera.org',          // audit mode
  'edx.org',               // audit mode
  'github.com',            // repo materi/roadmap
  'roadmap.sh',            // peta jalan belajar
];

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
