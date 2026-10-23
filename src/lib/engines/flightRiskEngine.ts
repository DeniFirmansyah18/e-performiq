/**
 * Mesin risiko karyawan (PRD v2.0 §5.4 Modul 4):
 * "Predictive Attrition & Burnout Warning".
 *
 * Murni dan deterministik: semua sinyal masuk sebagai angka, tidak ada I/O,
 * sehingga hasilnya dapat diaudit dan diuji sampai nilai persisnya. Setiap
 * faktor selalu dikembalikan (termasuk yang bernilai 0) agar UI dapat
 * menjelaskan *mengapa* seseorang berisiko, bukan hanya berapa skornya.
 */

export type RiskBand = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface RiskFactor {
  code: string;
  label: string;
  points: number;
  maxPoints: number;
  /** Kalimat panjang untuk konsumen lama (`calculateFlightRisk.warnings`). */
  warning?: string;
}

export interface RiskSignals {
  /** Hari tidak hadir dalam 30 hari terakhir. */
  absentDays30: number;
  /** Hari terlambat dalam 30 hari terakhir. */
  lateDays30: number;
  /** Hari dengan kotak status MERAH dalam 30 hari terakhir. */
  redDays30: number;
  /** Total jam lembur (tercatat) dalam 30 hari terakhir. */
  overtimeHours30: number;
  /** Hari kerja beruntun terpanjang tanpa hari libur. */
  longestWorkStreak: number;
  /** Rata-rata DPI 30 hari terakhir; null bila belum ada snapshot. */
  avgDpi30: number | null;
  /** Rata-rata DPI 7 hari terakhir dikurangi 7 hari sebelumnya. */
  dpiTrend: number | null;
  /** Rasio indikator terisi terhadap indikator wajib (0..1); null bila tak ada data. */
  entryAdherence: number | null;
  /** Masa kerja dalam bulan. */
  tenureMonths: number;

  /**
   * Sinyal warisan dari `coreHrService.buildRiskProfile`. Opsional: hanya
   * dipakai jalur lama (`calculateFlightRisk`). Bila `overtimeHours30` sudah
   * terisi, `overtimeHoursWeekly` diabaikan agar beban lembur tidak dihitung dua kali.
   */
  bradfordFactor?: number;
  peerReviewAvg?: number | null;
  contractDaysRemaining?: number | null;
  overtimeHoursWeekly?: number | null;
}

export interface RiskResult {
  score: number;
  band: RiskBand;
  factors: RiskFactor[];
}

export interface FlightRiskResult {
  attrition: RiskResult;
  burnout: RiskResult;
  overall: RiskBand;
}

const BAND_ORDER: RiskBand[] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const capped = (value: number, cap: number) => Math.min(Math.max(value, 0), cap);

export function bandFor(score: number): RiskBand {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MODERATE';
  return 'LOW';
}

export function highestBand(a: RiskBand, b: RiskBand): RiskBand {
  return BAND_ORDER.indexOf(a) >= BAND_ORDER.indexOf(b) ? a : b;
}

function finish(factors: RiskFactor[]): RiskResult {
  const score = clampScore(factors.reduce((sum, f) => sum + f.points, 0));
  return { score, band: bandFor(score), factors };
}

/** Risiko berhenti (attrition). */
export function computeAttritionRisk(s: RiskSignals): RiskResult {
  const lowDpi =
    s.avgDpi30 === null ? 0 : s.avgDpi30 < 70 ? 20 : s.avgDpi30 < 85 ? 10 : 0;

  const decline =
    s.dpiTrend === null ? 0 : s.dpiTrend <= -5 ? 15 : s.dpiTrend < 0 ? 8 : 0;

  const adherence =
    s.entryAdherence === null ? 0 : s.entryAdherence < 0.6 ? 10 : 0;

  const earlyTenure =
    s.tenureMonths < 12 && s.avgDpi30 !== null && s.avgDpi30 < 75 ? 5 : 0;

  const bradford = s.bradfordFactor !== undefined && s.bradfordFactor > 45 ? 25 : 0;
  const peerReview =
    s.peerReviewAvg !== undefined && s.peerReviewAvg !== null && s.peerReviewAvg < 3.2 ? 20 : 0;
  const contractEnd =
    s.contractDaysRemaining !== undefined &&
    s.contractDaysRemaining !== null &&
    s.contractDaysRemaining > 0 &&
    s.contractDaysRemaining <= 60
      ? 15
      : 0;

  return finish([
    { code: 'ABSENCE', label: 'Ketidakhadiran 30 hari', points: capped(s.absentDays30, 10) * 3, maxPoints: 30 },
    { code: 'LOW_DPI', label: 'Rata-rata DPI rendah', points: lowDpi, maxPoints: 20 },
    { code: 'RED_DAYS', label: 'Hari status merah', points: capped(s.redDays30, 10) * 2, maxPoints: 20 },
    { code: 'DPI_DECLINE', label: 'Tren DPI menurun', points: decline, maxPoints: 15 },
    { code: 'LOW_ADHERENCE', label: 'Kepatuhan pengisian KPI rendah', points: adherence, maxPoints: 10 },
    { code: 'EARLY_TENURE', label: 'Masa kerja baru dengan kinerja rendah', points: earlyTenure, maxPoints: 5 },
    {
      code: 'BRADFORD',
      label: 'Indeks Bradford tinggi',
      points: bradford,
      maxPoints: 25,
      warning: 'Indeks Bradford absensi mengindikasikan ketidakhadiran berulang',
    },
    {
      code: 'PEER_REVIEW',
      label: 'Nilai rekan kerja rendah',
      points: peerReview,
      maxPoints: 20,
      warning: 'Penurunan indeks kepuasan interaksi tim & rekan kerja',
    },
    {
      code: 'CONTRACT_END',
      label: 'Kontrak hampir berakhir',
      points: contractEnd,
      maxPoints: 15,
      warning: 'Masa berlaku kontrak PKWT akan berakhir dalam 60 hari',
    },
  ]);
}

/** Risiko kelelahan (burnout). */
export function computeBurnoutRisk(s: RiskSignals): RiskResult {
  const overtime =
    s.overtimeHours30 >= 40 ? 40 : s.overtimeHours30 >= 20 ? 25 : s.overtimeHours30 >= 10 ? 12 : 0;

  // Bila beban 30 hari sudah dihitung, lembur mingguan diabaikan (bukan dijumlah).
  const weeklyOvertime =
    s.overtimeHours30 > 0
      ? 0
      : s.overtimeHoursWeekly !== undefined && s.overtimeHoursWeekly !== null && s.overtimeHoursWeekly > 10
        ? 30
        : 0;

  const decline = s.dpiTrend === null ? 0 : s.dpiTrend < 0 ? 10 : 0;

  return finish([
    { code: 'OVERTIME_LOAD', label: 'Beban lembur 30 hari', points: overtime, maxPoints: 40 },
    {
      code: 'OVERTIME_WEEKLY',
      label: 'Lembur mingguan berlebih',
      points: weeklyOvertime,
      maxPoints: 30,
      warning: 'Beban lembur berlebih berisiko memicu kelelahan kerja (burnout)',
    },
    {
      code: 'LONG_STREAK',
      label: 'Hari kerja beruntun tanpa jeda',
      points: s.longestWorkStreak >= 12 ? 20 : 0,
      maxPoints: 20,
    },
    { code: 'LATE_FATIGUE', label: 'Keterlambatan berulang', points: capped(s.lateDays30, 10) * 2, maxPoints: 20 },
    { code: 'RED_DAYS', label: 'Hari status merah', points: capped(s.redDays30, 10), maxPoints: 10 },
    { code: 'DPI_DECLINE', label: 'Tren DPI menurun', points: decline, maxPoints: 10 },
  ]);
}

export function computeFlightRisk(s: RiskSignals): FlightRiskResult {
  const attrition = computeAttritionRisk(s);
  const burnout = computeBurnoutRisk(s);
  return {
    attrition,
    burnout,
    overall: highestBand(attrition.band, burnout.band),
  };
}
