/**
 * Rumus capaian RJMP yang DIKUNCI (ADR 021).
 *
 * Angka pada modul ini dipakai untuk menilai Direksi dan menjadi dasar
 * remunerasi/tantiem, sehingga perubahannya BUKAN perubahan teknis biasa:
 * setiap perubahan rumus wajib lewat revisi ADR 021 + kenaikan versi di bawah.
 *
 * `tests/unit/achievementFormula.test.ts` memverifikasi bahwa dokumen ADR
 * benar-benar memuat versi ini, sehingga kode dan dokumen tidak dapat menyimpang
 * tanpa ada test yang gagal.
 */

/** Versi basis perhitungan. Naikkan HANYA bersama revisi ADR 021. */
export const ACHIEVEMENT_FORMULA_VERSION = 'RJMP-2026-v1';

export type AchievementStatus = 'ACHIEVED' | 'BELOW_TARGET' | 'NO_DATA';

export interface PillarMeasurement {
  /** Bobot pilar strategis dalam persen (mis. 25). */
  weight: number;
  /** Capaian pilar dalam persen (mis. 92.5). Diabaikan bila `measured` false. */
  achievement: number;
  /** `false` bila pilar belum punya KPI sama sekali. */
  measured: boolean;
}

/** Pembulatan satu desimal yang aman terhadap NaN/Infinity. */
export function round1(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

/**
 * Capaian resmi: rata-rata tertimbang SELURUH pilar.
 *
 * Pilar `measured: false` bernilai 0% pada bobotnya sendiri dan TIDAK
 * dikeluarkan dari penyebut. Normalisasi ulang dilarang karena membuat skor
 * naik hanya dengan tidak menyusun KPI — kelalaian administratif berubah
 * menjadi perbaikan kinerja — sekaligus mengubah basis perhitungan yang
 * dipakai menilai Direksi di tengah periode.
 */
export function overallAchievement(pillars: PillarMeasurement[]): number {
  const totalWeight = pillars.reduce((s, p) => s + (Number.isFinite(p.weight) ? p.weight : 0), 0);
  if (totalWeight <= 0) return 0;

  const weighted = pillars.reduce(
    (s, p) =>
      s + (p.measured && Number.isFinite(p.achievement) ? p.achievement : 0) * (p.weight || 0),
    0
  );
  return round1(weighted / totalWeight);
}

/** Capaian pada pilar yang benar-benar terukur — konteks pelaporan, bukan angka resmi. */
export function measuredAchievement(pillars: PillarMeasurement[]): number {
  const measured = pillars.filter((p) => p.measured);
  const totalWeight = measured.reduce((s, p) => s + (p.weight || 0), 0);
  if (totalWeight <= 0) return 0;

  return round1(
    measured.reduce(
      (s, p) => s + (Number.isFinite(p.achievement) ? p.achievement : 0) * (p.weight || 0),
      0
    ) / totalWeight
  );
}

/**
 * Porsi bobot yang punya KPI, dalam persen (0-100).
 *
 * Dipisahkan dari capaian agar satu angka tidak memikul dua arti: "capaian"
 * menjawab seberapa baik kinerja, "cakupan" menjawab seberapa besar strategi
 * yang benar-benar terukur (disclosure cakupan data, ISO 30414).
 */
export function measurementCoverage(pillars: PillarMeasurement[]): number {
  const totalWeight = pillars.reduce((s, p) => s + (p.weight || 0), 0);
  if (totalWeight <= 0) return 0;

  const measuredWeight = pillars
    .filter((p) => p.measured)
    .reduce((s, p) => s + (p.weight || 0), 0);

  return Math.min(100, round1((measuredWeight / totalWeight) * 100));
}

/** Bobot pilar yang terukur (mis. 75 dari 100). */
export function measuredWeightOf(pillars: PillarMeasurement[]): number {
  return round1(pillars.filter((p) => p.measured).reduce((s, p) => s + (p.weight || 0), 0));
}

/** Bobot seluruh pilar aktif (biasanya 100). */
export function totalWeightOf(pillars: PillarMeasurement[]): number {
  return round1(pillars.reduce((s, p) => s + (p.weight || 0), 0));
}

/**
 * Status capaian. `NO_DATA` berarti BELUM DINILAI (bukan gagal) — pembaca harus
 * dapat membedakan lubang cascade dari kinerja di bawah target.
 */
export function statusOf(achievement: number, hasData: boolean): AchievementStatus {
  if (!hasData) return 'NO_DATA';
  if (!Number.isFinite(achievement)) return 'NO_DATA';
  return achievement >= 100 ? 'ACHIEVED' : 'BELOW_TARGET';
}