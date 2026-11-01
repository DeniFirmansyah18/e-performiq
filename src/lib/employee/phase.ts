/**
 * Sumber kebenaran tunggal siklus hidup karyawan (Pra / Saat / Pasca Kerja).
 *
 * Dipakai bersama oleh portal karyawan (tab fase, jembatan fase), dashboard
 * HR Command (kartu kontrol 3-fase, panel per fase), dan turunan fase di
 * server (`employeeProfileService`). Sebelumnya fase diturunkan di banyak
 * tempat dengan kosakata berbeda ('PRE' | 'pre' | label bebas) sehingga
 * pemetaan fitur melenceng — mis. panel payroll & e-Surat diletakkan di
 * fase Pra-Kerja. Semua konsumen kini menurunkan fase lewat modul ini.
 */
export type WorkPhase = 'PRE' | 'DURING' | 'POST';

/** Urutan fase = urutan tab/kartu di UI. */
export const PHASES: WorkPhase[] = ['PRE', 'DURING', 'POST'];

export const PHASE_LABEL: Record<WorkPhase, string> = {
  PRE: 'Sebelum Kerja',
  DURING: 'Saat Kerja',
  POST: 'Setelah Kerja',
};

/** Judul kartu fase pada dashboard HR. */
export const PHASE_TITLE: Record<WorkPhase, string> = {
  PRE: 'Fase Pra-Kerja',
  DURING: 'Fase Saat-Kerja',
  POST: 'Fase Pasca-Kerja',
};

/** Subjudul satu baris kartu fase pada dashboard HR. */
export const PHASE_SUBTITLE: Record<WorkPhase, string> = {
  PRE: 'Rekrutmen & MPP sebelum karyawan mulai bekerja',
  DURING: 'Pemantauan performa, pengembangan, dan transisi aktif',
  POST: 'Clearance offboarding, biaya, risiko & pelaporan',
};

/** Transisi fase yang sah (state machine): PRE → DURING → POST, tanpa mundur. */
export const NEXT_PHASES: Record<WorkPhase, WorkPhase[]> = {
  PRE: ['DURING'],
  DURING: ['POST'],
  POST: [],
};

/**
 * Pemetaan fitur (portal karyawan & panel HR) ke fase siklusnya.
 *
 * Setiap panel/fitur yang dirender per fase wajib terdaftar di sini agar
 * `phaseOf()` menempatkannya dengan benar; entri tak dikenal jatuh ke DURING.
 */
export const FEATURE_PHASE: Readonly<Record<string, WorkPhase>> = Object.freeze({
  // ===== Pra-Kerja: perencanaan tenaga kerja & rekrutmen =====
  mpp: 'PRE', // Manajemen MPP (kuota & budget formasi)
  recruitment: 'PRE', // Rekrutmen kandidat (portal karier publik)
  'job-posting': 'PRE', // Kelola lowongan
  interview: 'PRE', // Jadwal wawancara
  'technical-test': 'PRE', // Bank soal tes teknis
  registration: 'PRE', // Registrasi karyawan mandiri
  'document-verification': 'PRE', // Verifikasi berkas kepegawaian (pre-hire)
  onboarding: 'PRE', // Orientasi 30-60-90 hari
  'recruitment-fptk': 'PRE', // Formulir Permintaan Tenaga Kerja (aksi rekrutmen baru)

  // ===== Saat-Kerja: administrasi & pengelolaan kepegawaian =====
  'manager-assignment': 'DURING', // Penugasan atasan langsung
  leave: 'DURING', // Persetujuan cuti & izin
  payroll: 'DURING', // Payroll
  'e-letter': 'DURING', // Register e-Surat & disposisi
  policy: 'DURING', // Perpustakaan SOP & peraturan
  bpjs: 'DURING', // Data BPJS karyawan
  disciplinary: 'DURING', // Sanksi & keberatan
  'career-ladder': 'DURING', // Konfigurasi jenjang karir
  scorecard: 'DURING',
  'appraisal-calibration': 'DURING', // Kalibrasi nilai semester
  okr: 'DURING',
  development: 'DURING',
  timesheet: 'DURING',
  payslip: 'DURING',
  career: 'DURING',
  learning: 'DURING', // Pembelajaran & pengembangan kompetensi
  pipeline: 'DURING', // Pipeline suksesi & mobilitas internal
  reimbursement: 'DURING',
  helpdesk: 'DURING',
  evidence: 'DURING',
  jobboard: 'DURING',
  profile: 'DURING',
  attendance: 'DURING',
  overtime: 'DURING', // Lembur & penugasan tambahan
  coach: 'DURING', // Pembinaan/coaching oleh atasan
  'activity-feed': 'DURING', // Umpan aktivitas operasional harian

  // ===== Pasca-Kerja: keluar, clearance, & agregasi =====
  offboarding: 'POST',
  clearance: 'POST',
  cost: 'POST', // Kartu biaya & risiko pasca-kerja
  'iso-30414': 'POST', // Ekspor metrik human capital ISO 30414
  'hr-dashboard': 'POST', // Ringkasan SDM & Pasca-Kerja
  'executive-analytics': 'POST', // Analitik eksekutif lintas fase (BOD/Direktur)
});

export function phaseOf(feature: string): WorkPhase {
  return FEATURE_PHASE[feature] ?? 'DURING';
}

export function isWorkPhase(value: unknown): value is WorkPhase {
  return typeof value === 'string' && (PHASES as string[]).includes(value);
}

/** Fitur yang terdaftar pada satu fase (untuk render panel per fase). */
export function featuresInPhase(phase: WorkPhase): string[] {
  return Object.keys(FEATURE_PHASE).filter((f) => FEATURE_PHASE[f] === phase);
}

/** Normalisasi nilai longgar (mis. `?phase=pre` dari deep-link) → WorkPhase. */
export function normalizePhase(value: unknown, fallback: WorkPhase = 'PRE'): WorkPhase {
  const upper = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return isWorkPhase(upper) ? upper : fallback;
}

export interface PhaseSignals {
  /** Status permintaan offboarding terakhir, bila ada. */
  offboardingStatus?: string | null;
  /** Status program onboarding (onboarding_status_enum), bila ada. */
  programStatus?: string | null;
  /** Hasil masa percobaan dari milestone, bila ada. */
  probationPassed?: boolean | null;
  /** Jumlah milestone orientasi yang sudah terisi. */
  milestonesDone?: number | null;
  /** `employees.status` (PROBATION / PERMANENT / RESIGNED / ...). */
  status?: string | null;
}

/**
 * Turunkan fase dari sinyal kepegawaian. Dipakai sebagai fallback bila kolom
 * `employees.employee_phase` belum terisi, dan sebagai acuan hook otomatis.
 *
 * Aturan:
 * - ada permintaan offboarding → POST
 * - orientasi belum tuntas (program IN_PROGRESS, atau masih PROBATION) → PRE
 * - selain itu → DURING
 */
export function deriveWorkPhase(signals: PhaseSignals): WorkPhase {
  const {
    offboardingStatus = null,
    programStatus = null,
    probationPassed = null,
    milestonesDone = 0,
    status = null,
  } = signals;

  if (offboardingStatus) return 'POST';

  const orientationDone =
    programStatus === 'COMPLETED' || probationPassed === true || (milestonesDone ?? 0) >= 3;

  if (programStatus != null && !orientationDone) return 'PRE';
  if (status === 'PROBATION' && !orientationDone) return 'PRE';
  return 'DURING';
}

