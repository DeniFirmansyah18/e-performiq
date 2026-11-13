/**
 * Batas tata kelola KPI.
 *
 * Dipisah dari `kpiService` agar dapat diimpor oleh `kpiIndicatorService`
 * tanpa impor melingkar (kpiService juga memakai kpiIndicatorService).
 */

/** Jumlah indikator minimal per KPI — terlalu sedikit membuat KPI kabur. */
export const MIN_INDIKATOR = 3;

/** Jumlah indikator maksimal per KPI — terlalu banyak melemahkan fokus. */
export const MAX_INDIKATOR = 5;

/** Total bobot KPI yang sah per periode (dalam persen). */
export const TOTAL_BOBOT_WAJIB = 100;
