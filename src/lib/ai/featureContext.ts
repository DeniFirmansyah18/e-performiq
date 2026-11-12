/**
 * Memetakan fitur menu ke konteks data AI yang tersedia di server.
 *
 * `buildFeatureContext` hanya mengenal beberapa konteks (executive, hr,
 * manager, ninebox, employee, learning, careers, board). Menu yang belum punya
 * konteks khusus memakai konteks umum HR agar analisis tetap berjalan dan
 * tetap menyebut menu yang sedang dibuka lewat `judulMenu`.
 */
const PETA_KONTEKS: Record<string, string> = {
  // Rekrutmen & seleksi
  recruitment: 'careers',
  interview: 'careers',
  'technical-test': 'careers',
  registration: 'careers',
  'document-verification': 'careers',

  // Pembelajaran
  learning: 'learning',

  // Talenta & kaderisasi
  pipeline: 'ninebox',
  'career-ladder': 'ninebox',
  scorecard: 'ninebox',
  recruitment_pipeline: 'ninebox',

  // Manajemen
  'manager-assignment': 'manager',
  leave: 'manager',

  // Ringkasan & wawasan
  'hr-dashboard': 'hr',
  mpp: 'hr',
  cost: 'executive',
  'iso-30414': 'executive',
  retirement: 'executive',
  alumni: 'executive',
  'exit-analytics': 'executive',
};

/** Konteks AI untuk sebuah fitur menu. */
export function fiturKonteksAi(feature: string): string {
  return PETA_KONTEKS[feature] ?? 'hr';
}
