/**
 * Resume parser — mengubah teks CV menjadi data terstruktur.
 *
 * Dua strategi:
 *  1. HEURISTIC (utama): regex + heuristik untuk email, telepon, skill,
 *     pendidikan, pengalaman. Cepat, deterministik, tanpa biaya.
 *  2. AI (fallback / pelengkap): memakai `aiService.generateContent` untuk
 *     mengekstrak struktur saat heuristik tak menemukan apa pun.
 *
 * Prinsip: TIDAK boleh crash. Bila teks kosong / parsing gagal → kembalikan
 * struktur kosong yang valid, bukan melempar error (plan review focus #2).
 */

export interface ParsedContact {
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
}

export interface ParsedEducation {
  level?: string;
  institution?: string;
  degree?: string;
  major?: string;
  startYear?: number;
  endYear?: number;
  gpa?: number;
}

export interface ParsedExperience {
  company?: string;
  roleTitle?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface ParsedResume {
  fullName?: string;
  contact: ParsedContact;
  gender?: string;
  nik?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  summary?: string;
  skills: string[];
  educations: ParsedEducation[];
  experiences: ParsedExperience[];
  totalExperienceYears?: number;
  parser: 'HEURISTIC' | 'AI' | 'MIXED';
}

const SKILL_DICTIONARY: string[] = [
  'TypeScript', 'JavaScript', 'React', 'Next.js', 'Node.js', 'Express', 'NestJS',
  'Vue', 'Angular', 'Svelte', 'PHP', 'Laravel', 'Python', 'Django', 'Flask',
  'FastAPI', 'Java', 'Spring Boot', 'Kotlin', 'Swift', 'Go', 'Golang', 'Rust',
  'C++', 'C#', '.NET', 'Ruby', 'Rails', 'SQL', 'PostgreSQL', 'MySQL', 'MariaDB',
  'MongoDB', 'Redis', 'Elasticsearch', 'GraphQL', 'REST API', 'Docker',
  'Kubernetes', 'AWS', 'GCP', 'Azure', 'CI/CD', 'Git', 'Linux', 'Terraform',
  'Kafka', 'RabbitMQ', 'Tailwind CSS', 'HTML', 'CSS', 'Sass', 'Figma',
  'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Pandas',
  'NumPy', 'Data Analysis', 'Power BI', 'Tableau', 'Looker', 'Excel', 'VBA',
  'HRIS', 'Recruitment', 'Payroll', 'Kompensasi', 'Benefit', 'Talent Management',
  'Performance Management', 'Training', 'Learning & Development', 'LMS',
  'Employee Relations', 'Industrial Relations', 'HR Analytics', 'People Analytics',
  'Manajemen Proyek', 'Project Management', 'Agile', 'Scrum', 'Kanban', 'Jira',
  'Komunikasi', 'Public Speaking', 'Presentasi', 'Negosiasi', 'Kepemimpinan',
  'Leadership', 'Team Management', 'Coaching', 'Analisis Data', 'Problem Solving',
  'Akuntansi', 'Accounting', 'Audit', 'Pajak', 'Tax', 'Perpajakan', 'Budgeting',
  'Forecasting', 'Financial Analysis', 'Cash Flow', 'Accounts Payable',
  'Accounts Receivable', 'General Ledger', 'Cost Accounting', 'SAP', 'Oracle',
  'Marketing', 'Digital Marketing', 'SEO', 'SEM', 'Content Marketing', 'CRM',
  'Salesforce', 'HubSpot', 'Brand Management', 'Copywriting', 'Social Media',
  'Supply Chain', 'Logistics', 'Procurement', 'Inventory Management', 'Warehouse',
  'Customer Service', 'Quality Assurance', 'Quality Control', 'ISO 9001',
  'K3', 'HSE', 'Safety Management', 'Six Sigma', 'Lean', 'Continuous Improvement',
];

const SKILL_LOOKUP = new Map(SKILL_DICTIONARY.map((s) => [s.toLowerCase(), s]));

export function normalizeResumeText(raw: string): string {
  return String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?62|0)8[1-9][0-9]{1,3}[\s-]?[0-9]{3,4}[\s-]?[0-9]{3,5}/;
const LINKEDIN_RE = /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/[^\s)"']+/i;
const URL_RE = /https?:\/\/[^\s)"']+/gi;

const DEGREE_PATTERNS: Array<{ re: RegExp; degree: string }> = [
  { re: /\b(s3|doktor|doctoral|ph\.?d)\b/i, degree: 'S3' },
  { re: /\b(s2|magister|master|m\.?sc|mba|m\.?m|m\.?t)\b/i, degree: 'S2' },
  { re: /\b(s1|sarjana|bachelor|b\.?sc|b\.?eng|s\.?kom|s\.?t)\b/i, degree: 'S1' },
  { re: /\b(d4|d3|diploma|d1|d2|vokasi)\b/i, degree: 'D3' },
  { re: /\b(sma|smk|smu|slta|madrasah|high school)\b/i, degree: 'SMA/SMK' },
];

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januari: 1, feb: 2, february: 2, februari: 2, mar: 3,
  march: 3, maret: 3, apr: 4, april: 4, mei: 5, may: 5, jun: 6, june: 6, juni: 6,
  jul: 7, july: 7, juli: 7, aug: 8, august: 8, agustus: 8, sep: 9, sept: 9,
  september: 9, okt: 10, oct: 10, october: 10, oktober: 10, nov: 11, november: 11,
  des: 12, dec: 12, december: 12, desember: 12,
};

function parseMonthYear(token: string): { year: number; month: number } | null {
  const t = String(token ?? '').trim().toLowerCase();
  let m = t.match(/(\d{4})[-/](\d{1,2})/);
  if (m) return { year: Number(m[1]), month: Number(m[2]) };
  m = t.match(/(\d{1,2})[-/](\d{4})/);
  if (m) return { year: Number(m[2]), month: Number(m[1]) };
  m = t.match(/([a-z]+)\.?\s+(\d{4})/);
  if (m && MONTHS[m[1]]) return { year: Number(m[2]), month: MONTHS[m[1]] };
  m = t.match(/(\d{4})/);
  if (m) return { year: Number(m[1]), month: 1 };
  return null;
}

const RANGE_RE =
  /((?:[a-z]{3,9}\.?\s+\d{4})|\d{4}[-/]\d{1,2}|\d{1,2}[-/]\d{4}|\d{4})\s*(?:-|–|—|s\/d|sampai|hingga|to)\s*((?:[a-z]{3,9}\.?\s+\d{4})|\d{4}[-/]\d{1,2}|\d{1,2}[-/]\d{4}|\d{4}|sekarang|present|now|kini)/i;

const EXPERIENCE_HEADINGS = /(pengalaman kerja|work experience|experience|riwayat pekerjaan|employment)/i;
const EDUCATION_HEADINGS = /(pendidikan|education|riwayat pendidikan|academic)/i;
const SKILLS_HEADINGS = /(keahlian|skills|kompetensi|technical skills|kemampuan)/i;

function splitSections(text: string): Record<string, string> {
  const lines = text.split('\n');
  const sections: Record<string, string> = { _head: '' };
  let current = '_head';
  for (const line of lines) {
    const trimmed = line.trim();
    const isHeading = trimmed.length > 0 && trimmed.length < 60 && !/\d{4}/.test(trimmed);
    if (isHeading && EXPERIENCE_HEADINGS.test(trimmed)) current = 'experience';
    else if (isHeading && EDUCATION_HEADINGS.test(trimmed)) current = 'education';
    else if (isHeading && SKILLS_HEADINGS.test(trimmed)) current = 'skills';
    sections[current] = (sections[current] ? sections[current] + '\n' : '') + line;
  }
  return sections;
}

export function extractSkills(text: string): string[] {
  const found = new Set<string>();
  const lower = ` ${String(text ?? '').toLowerCase()} `;
  // Varian tanpa spasi: mengatasi artefak ekstraksi PDF/run Word yang memecah
  // satu skill menjadi beberapa token ("Type Script", "Next .js", "Postgre SQL").
  const nospace = lower.replace(/\s+/g, '');
  SKILL_LOOKUP.forEach((canonical, needle) => {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    if (re.test(lower)) { found.add(canonical); return; }
    const needleNs = needle.replace(/\s+/g, '');
    if (needleNs.length >= 3 && nospace.includes(needleNs)) found.add(canonical);
  });
  return Array.from(found);
}

export function extractEducations(section: string): ParsedEducation[] {
  if (!section) return [];
  const out: ParsedEducation[] = [];
  const lines = section.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const degree = DEGREE_PATTERNS.find((d) => d.re.test(line))?.degree;
    const years = (line.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number);
    const gpaMatch = line.match(/\b(?:ipk|gpa)\b\D{0,6}([0-4](?:[.]\d{1,2})?)/i);
    const institution = line.match(/\b(universitas|university|institut|institute|sekolah|politeknik|college|akademi|stie|stmik)\b/i);
    if (!degree && !years.length && !institution && !gpaMatch) continue;
    const majorMatch = line.match(/\b(?:jurusan|program studi|prodi|major)\b[^\n,;]*/i);
    out.push({
      level: degree,
      institution: institution ? line.split(/[-–|]/)[0].trim() : undefined,
      degree,
      major: majorMatch ? majorMatch[0].replace(/^(jurusan|program studi|prodi|major)\s*:?\s*/i, '').trim() : undefined,
      startYear: years.length >= 2 ? years[0] : undefined,
      endYear: years.length >= 1 ? years[years.length - 1] : undefined,
      gpa: gpaMatch ? Number(gpaMatch[1].replace(',', '.')) : undefined,
    });
  }
  return out.slice(0, 5);
}

export function extractExperiences(text: string): ParsedExperience[] {
  if (!text) return [];
  const out: ParsedExperience[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let current: ParsedExperience | null = null;
  for (const line of lines) {
    const range = line.match(RANGE_RE);
    if (range) {
      if (current) out.push(current);
      const start = parseMonthYear(range[1]);
      const endToken = range[2].toLowerCase();
      const isPresent = /sekarang|present|now|kini/.test(endToken);
      const end = isPresent ? null : parseMonthYear(range[2]);
      const context = line.replace(range[0], '').replace(/[|,–—-]\s*$/, '').trim();
      current = {
        roleTitle: context || undefined,
        startDate: start ? `${start.year}-${String(start.month).padStart(2, '0')}-01` : undefined,
        endDate: end ? `${end.year}-${String(end.month).padStart(2, '0')}-01` : undefined,
        description: '',
      };
    } else if (current) {
      if (!current.company && /\b(pt|cv|inc|ltd|corp|tbd|group|bank|company|perusahaan)\b/i.test(line) && line.length < 80) {
        current.company = line;
      } else {
        current.description = (current.description ? current.description + ' ' : '') + line;
      }
    }
  }
  if (current) out.push(current);
  return out.slice(0, 10);
}

export function computeExperienceYears(exps: ParsedExperience[]): number {
  const now = new Date();
  let months = 0;
  for (const e of exps) {
    const s = e.startDate ? new Date(e.startDate) : null;
    const en = e.endDate ? new Date(e.endDate) : now;
    if (!s || Number.isNaN(s.getTime())) continue;
    const m = (en.getFullYear() - s.getFullYear()) * 12 + (en.getMonth() - s.getMonth());
    if (m > 0) months += m;
  }
  return Math.round((months / 12) * 10) / 10;
}

export function parseResumeHeuristic(rawText: string): ParsedResume {
  const text = normalizeResumeText(rawText);
  if (!text) {
    return { contact: {}, skills: [], educations: [], experiences: [], parser: 'HEURISTIC' };
  }
  const sections = splitSections(text);

  const email = text.match(EMAIL_RE)?.[0];
  const phone = text.match(PHONE_RE)?.[0];
  const linkedinUrl = text.match(LINKEDIN_RE)?.[0];
  const allUrls = text.match(URL_RE) ?? [];
  const portfolioUrl = allUrls.find((u) => !/linkedin\.com/i.test(u) && (!email || !u.includes(email)));

  const firstLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const fullName = firstLines.slice(0, 6).find(
    (l) => /^[A-Za-z][A-Za-z'.\- ]{2,60}$/.test(l) && l.split(' ').length <= 5 &&
      !EMAIL_RE.test(l) && !/curriculum|resume|daftar riwayat|vitae/i.test(l),
  );

  const skills = extractSkills(text);
  const educations = extractEducations(sections.education ?? '');
  const experiences = extractExperiences(sections.experience ?? text);

  // Gender: cari "jenis kelamin: ...", "gender:", atau kata kunci tunggal.
  let gender: string | undefined;
  const gm = text.match(/\b(?:jenis kelamin|gender|sex)\b\s*:?\s*(laki[- ]?laki|pria|male|perempuan|wanita|female|female)\b/i);
  if (gm) {
    const v = gm[1].toLowerCase();
    gender = /laki|pria|male/i.test(v) ? 'LAKI_LAKI' : 'PEREMPUAN';
  }

  // NIK: 16 digit (opsional dipisah spasi/tanda hubung).
  let nik: string | undefined;
  const nikMatch = text.match(/\b(?:nik|no\.?\s*ktp|nomor\s*ktp|ktp)\b\s*:?\s*([0-9][0-9\s-]{13,20}[0-9])/i)
    ?? text.match(/\b(\d{16})\b/);
  if (nikMatch) {
    const digits = nikMatch[1].replace(/\D/g, '');
    if (digits.length === 16) nik = digits;
  }

  // Alamat: "alamat: ...", "address: ..." (multi-baris dihentikan oleh heading).
  const LOCATION_FIELDS = { address: undefined as string | undefined, city: undefined as string | undefined, province: undefined as string | undefined, postalCode: undefined as string | undefined };
  const addrMatch = text.match(/\b(?:alamat|address|domisili|tempat tinggal)\b\s*:?\s*([^\n]{6,200})/i);
  if (addrMatch) LOCATION_FIELDS.address = addrMatch[1].trim().replace(/\s{2,}/g, ' ');
  const cityMatch = text.match(/\b(?:kota|kabupaten|kab\.?|city|domisili)\b\s*:?\s*([A-Za-z][A-Za-z .'-]{2,40})/i);
  if (cityMatch) LOCATION_FIELDS.city = cityMatch[1].trim();
  const provMatch = text.match(/\b(?:provinsi|province|propinsi)\b\s*:?\s*([A-Za-z][A-Za-z .'-]{2,40})/i);
  if (provMatch) LOCATION_FIELDS.province = provMatch[1].trim();
  const posMatch = text.match(/\b(?:kode pos|kodepos|postal code|zip)\b\s*:?\s*(\d{5})/i) ?? text.match(/\b(\d{5})\b/);
  if (posMatch) LOCATION_FIELDS.postalCode = posMatch[1];

  let summary: string | undefined;
  const summaryMatch = text.match(
    /(?:ringkasan|tentang saya|profil|summary|about me|professional summary)\s*:?\s*\n([\s\S]{40,600}?)(?:\n\s*\n)/i,
  );
  if (summaryMatch) summary = summaryMatch[1].replace(/\n/g, ' ').trim();
  else {
    const para = text.split('\n\n').map((p) => p.trim()).find((p) => p.length >= 80 && !EMAIL_RE.test(p) && !PHONE_RE.test(p));
    summary = para?.slice(0, 400);
  }

  return {
    fullName,
    contact: { email, phone, linkedinUrl, portfolioUrl },
    gender,
    nik,
    address: LOCATION_FIELDS.address,
    city: LOCATION_FIELDS.city,
    province: LOCATION_FIELDS.province,
    postalCode: LOCATION_FIELDS.postalCode,
    summary,
    skills,
    educations,
    experiences,
    totalExperienceYears: computeExperienceYears(experiences),
    parser: 'HEURISTIC',
  };
}

// ---------------------------------------------------------------------------
// Ekstraksi teks dari berkas biner (PDF/DOCX/TXT).
//
// Tidak menambah dependensi berat: kami memakai strategi "best-effort":
//  - TXT/MD/CSV/JSON: langsung dibaca sebagai UTF-8.
//  - DOCX: unzip (DOCX = arsip ZIP) lalu ambil teks dari word/document.xml.
//  - PDF: ekstrak string literal dari stream (heuristik) + fallback ke AI.
//
// Bila ekstraksi gagal → kembalikan string kosong; pemanggil meneruskan ke
// fallback AI / membiarkan ATS kosong (tidak crash).
// ---------------------------------------------------------------------------

/** Bersihkan fragmen teks dari artefak XML/PDF. */
function cleanupExtracted(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\([()\\])/g, '$1')
    .replace(/\u0000/g, ' ')
    .trim();
}

/** Ekstrak teks dari DOCX (zip → word/document.xml) memakai inflate bawaan zlib. */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const zlib = await import('node:zlib');
    // Telusuri local file headers ZIP (signature 0x504b0304) dan inflate tiap
    // entri; cari entri "word/document.xml".
    let offset = 0;
    let documentXml = '';
    while (offset + 30 <= buffer.length) {
      // signature PK\x03\x04
      if (buffer[offset] !== 0x50 || buffer[offset + 1] !== 0x4b ||
          buffer[offset + 2] !== 0x03 || buffer[offset + 3] !== 0x04) break;
      const compression = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const nameStart = offset + 30;
      const name = buffer.subarray(nameStart, nameStart + nameLen).toString('utf8');
      const dataStart = nameStart + nameLen + extraLen;
      const dataEnd = dataStart + compressedSize;
      if (name === 'word/document.xml' && compressedSize > 0) {
        const data = buffer.subarray(dataStart, dataEnd);
        documentXml = compression === 8
          ? zlib.inflateRawSync(data).toString('utf8')
          : data.toString('utf8');
        break;
      }
      offset = dataEnd;
    }
    if (!documentXml) return '';
    // Pisahkan per paragraf; di dalam satu paragraf, run <w:t> bersambung
    // TANPA spasi (Word memecah kata menjadi beberapa run, mis. "Type"+"Script").
    // Spasi antar-kata sudah tersimpan di dalam teks run itu sendiri.
    const paragraphs = documentXml
      .replace(/<w:p[ >]/g, '\n<w:p ')
      .split('\n')
      .map((p) => (p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) ?? [])
        .map((run) => run.replace(/<[^>]+>/g, ''))
        .join(''));
    const joined = paragraphs.filter((p) => p.trim().length > 0).join('\n');
    return normalizeResumeText(cleanupExtracted(joined)).replace(/\n{2,}/g, '\n');
  } catch {
    return '';
  }
}

/** Ekstrak teks (best-effort) dari PDF: literal string di dalam stream. */
export function extractTextFromPdf(buffer: Buffer): string {
  try {
    const raw = buffer.toString('latin1');
    const chunks: string[] = [];
    // 1) Objek teks PDF: (... ) Tj / (...) ' / [ ... ] TJ
    const tjRe = /\((?:\\.|[^\\()])*\)\s*(?:Tj|'|")/g;
    for (const m of raw.match(tjRe) ?? []) {
      const inner = m.slice(1, m.lastIndexOf(')'));
      chunks.push(inner.replace(/\\([()\\])/g, '$1'));
    }
    // 2) Array TJ: [(..) -250 (..)] TJ
    const arrRe = /\[((?:\s*\((?:\\.|[^\\()])*\)\s*-?\d*)*)\]\s*TJ/g;
    for (const m of raw.match(arrRe) ?? []) {
      const parts = m.match(/\((?:\\.|[^\\()])*\)/g) ?? [];
      chunks.push(parts.map((p) => p.slice(1, -1).replace(/\\([()\\])/g, '$1')).join(''));
    }
    const text = cleanupExtracted(chunks.join(' '));
    // Buang noise non-teks bila mayoritas karakter tak terbaca.
    return text.replace(/\s{2,}/g, ' ').trim();
  } catch {
    return '';
  }
}

/** Deteksi tipe berkas dari nama/ekstensi & magic bytes. */
export function detectResumeKind(fileName: string, buffer: Buffer): 'PDF' | 'DOCX' | 'TEXT' {
  const name = (fileName ?? '').toLowerCase();
  const magicPdf = buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
  const magicZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (magicPdf || name.endsWith('.pdf')) return 'PDF';
  if (magicZip || name.endsWith('.docx')) return 'DOCX';
  return 'TEXT';
}

/**
 * Ekstraksi teks terpadu dari sebuah berkas resume.
 * Mengembalikan string (mungkin kosong bila tak bisa diekstrak).
 */
export async function extractResumeText(fileName: string, buffer: Buffer): Promise<string> {
  if (!buffer || buffer.length === 0) return '';
  const kind = detectResumeKind(fileName, buffer);
  if (kind === 'PDF') {
    const t = extractTextFromPdf(buffer);
    // PDF terkompresi (FlateDecode) tak bisa dibaca tanpa zlib → biarkan kosong,
    // pemanggil akan memakai fallback AI atas nama berkas / metadata.
    return t;
  }
  if (kind === 'DOCX') {
    const t = await extractTextFromDocx(buffer);
    if (t) return t;
    // Fallback: baca sebagai teks mentah (mengandung XML yang tak terurai).
    return cleanupExtracted(buffer.toString('utf8'));
  }
  // TEXT: batasi ukuran agar aman.
  return normalizeResumeText(buffer.toString('utf8')).slice(0, 20000);
}

// ---------------------------------------------------------------------------
// Fallback AI: minta model mengekstrak struktur JSON dari teks CV.
// ---------------------------------------------------------------------------

/** Prompt ketat agar AI mengembalikan JSON valid tanpa penjelasan. */
function buildAiParsePrompt(text: string): string {
  const clipped = text.slice(0, 8000);
  return (
    'Ekstrak data dari CV berikut ke dalam JSON dengan skema PERSIS ini ' +
    '(tanpa penjelasan, tanpa markdown, hanya JSON):\n' +
    '{\n' +
    '  "fullName": string|null,\n' +
    '  "email": string|null,\n' +
    '  "phone": string|null,\n' +
    '  "gender": "LAKI_LAKI"|"PEREMPUAN"|null,\n' +
    '  "nik": string|null,\n' +
    '  "address": string|null,\n' +
    '  "city": string|null,\n' +
    '  "province": string|null,\n' +
    '  "postalCode": string|null,\n' +
    '  "summary": string|null,\n' +
    '  "skills": string[],\n' +
    '  "educations": [{ "institution": string, "degree": string, "major": string, "startYear": number, "endYear": number, "gpa": number }],\n' +
    '  "experiences": [{ "company": string, "roleTitle": string, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD atau null", "description": string }]\n' +
    '}\n' +
    'Aturan: gunakan hanya informasi yang ADA di CV; jangan mengarang. ' +
    'Isi nilai yang tidak diketahui dengan null atau array kosong.\n\n' +
    'CV:\n"""\n' + clipped + '\n"""'
  );
}

/** Coba parse JSON dari keluaran model (toleran terhadap pagar markdown). */
function safeJsonParse(raw: string): any | null {
  let t = String(raw ?? '').trim();
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first === -1 || last === -1) return null;
  try {
    return JSON.parse(t.slice(first, last + 1));
  } catch {
    return null;
  }
}

/**
 * Parsing resume memakai AI. Mengembalikan null bila AI tak terkonfigurasi
 * atau keluaran tak valid — pemanggil dapat memakai hasil heuristik.
 */
export async function parseResumeWithAi(rawText: string): Promise<ParsedResume | null> {
  const text = normalizeResumeText(rawText);
  if (text.length < 20) return null;
  try {
    const { generateContent, isAiConfigured } = await import('@/lib/services/aiService');
    if (!isAiConfigured()) return null;
    const res = await generateContent(buildAiParsePrompt(text), {
      maxOutputTokens: 2048,
      temperature: 0.1,
    });
    if (!res?.configured) return null;
    const json = safeJsonParse(res.text);
    if (!json) return null;
    const skills = Array.isArray(json.skills)
      ? json.skills.map((s: unknown) => String(s)).filter(Boolean).slice(0, 60)
      : [];
    const educations = Array.isArray(json.educations)
      ? json.educations.slice(0, 5).map((e: any) => ({
          institution: e?.institution ?? undefined,
          degree: e?.degree ?? undefined,
          major: e?.major ?? undefined,
          startYear: e?.startYear ? Number(e.startYear) : undefined,
          endYear: e?.endYear ? Number(e.endYear) : undefined,
          gpa: e?.gpa != null ? Number(e.gpa) : undefined,
        }))
      : [];
    const experiences = Array.isArray(json.experiences)
      ? json.experiences.slice(0, 10).map((e: any) => ({
          company: e?.company ?? undefined,
          roleTitle: e?.roleTitle ?? undefined,
          startDate: e?.startDate ?? undefined,
          endDate: e?.endDate ?? undefined,
          description: e?.description ?? undefined,
        }))
      : [];
    return {
      fullName: json.fullName ?? undefined,
      contact: {
        email: json.email ?? undefined,
        phone: json.phone ?? undefined,
      },
      gender: (json.gender === 'LAKI_LAKI' || json.gender === 'PEREMPUAN') ? json.gender : undefined,
      nik: json.nik ? String(json.nik).replace(/\D/g, '').slice(0, 16) || undefined : undefined,
      address: json.address ?? undefined,
      city: json.city ?? undefined,
      province: json.province ?? undefined,
      postalCode: json.postalCode ? String(json.postalCode).replace(/\D/g, '').slice(0, 5) || undefined : undefined,
      summary: json.summary ?? undefined,
      skills,
      educations,
      experiences,
      totalExperienceYears: computeExperienceYears(experiences),
      parser: 'AI',
    };
  } catch {
    return null;
  }
}

/**
 * Gabungkan hasil heuristik & AI: heuristik sebagai basis, AI melengkapi
 * field yang kosong dan menambah skill yang tak terdeteksi kamus.
 */
export function mergeParsed(heuristic: ParsedResume, ai: ParsedResume | null): ParsedResume {
  if (!ai) return heuristic;
  const skillSet = new Set<string>(heuristic.skills);
  for (const s of ai.skills) skillSet.add(s);
  return {
    fullName: heuristic.fullName ?? ai.fullName,
    contact: {
      email: heuristic.contact.email ?? ai.contact.email,
      phone: heuristic.contact.phone ?? ai.contact.phone,
      linkedinUrl: heuristic.contact.linkedinUrl,
      portfolioUrl: heuristic.contact.portfolioUrl,
    },
    gender: heuristic.gender ?? ai.gender,
    nik: heuristic.nik ?? ai.nik,
    address: heuristic.address ?? ai.address,
    city: heuristic.city ?? ai.city,
    province: heuristic.province ?? ai.province,
    postalCode: heuristic.postalCode ?? ai.postalCode,
    summary: heuristic.summary ?? ai.summary,
    skills: Array.from(skillSet),
    educations: heuristic.educations.length ? heuristic.educations : ai.educations,
    experiences: heuristic.experiences.length ? heuristic.experiences : ai.experiences,
    totalExperienceYears:
      heuristic.totalExperienceYears ?? ai.totalExperienceYears,
    parser: 'MIXED',
  };
}

/**
 * Fungsi utama: parse resume dari teks mentah.
 * Heuristik selalu jalan; AI dipakai bila heuristik "tipis" (mis. PDF
 * terkompresi yang teksnya tak terbaca) atau untuk memperkaya skill.
 * Bergerak asinkron karena AI memanggil jaringan.
 */
export async function parseResume(rawText: string, opts: { useAi?: boolean } = {}): Promise<ParsedResume> {
  const heuristic = parseResumeHeuristic(rawText);
  const thin = heuristic.skills.length === 0 && heuristic.experiences.length === 0 &&
    heuristic.educations.length === 0;
  const useAi = opts.useAi ?? (thin || heuristic.skills.length < 3);
  if (!useAi) return heuristic;
  const ai = await parseResumeWithAi(rawText);
  return mergeParsed(heuristic, ai);
}

