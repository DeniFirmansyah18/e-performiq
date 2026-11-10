/**
 * Utilitas penanggalan dan lokalisasi Indonesia Barat (WIB, UTC+7, id-ID).
 */

export const WIB_TIMEZONE = 'Asia/Jakarta';
export const ID_LOCALE = 'id-ID';

/**
 * Tanggal hari ini menurut zona waktu Indonesia Barat (UTC+7) dalam format YYYY-MM-DD.
 * `new Date().toISOString()` memakai UTC sehingga antara 00:00-06:59 WIB
 * masih menghasilkan tanggal kemarin.
 */
export function todayInJakarta(now: Date = new Date()): string {
  const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
  return new Date(now.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Menambah (atau mengurangi, bila negatif) hari pada string YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const base = Date.parse(`${date}T00:00:00Z`);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Parsing input ke Date object yang valid, atau null jika tidak valid.
 */
function toValidDate(input: Date | string | number | null | undefined): Date | null {
  if (input == null || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format tanggal ke Bahasa Indonesia dalam zona waktu WIB.
 * Contoh default: "10 November 2026"
 */
export function formatDateWib(
  date: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = toValidDate(date);
  if (!d) return '—';
  return d.toLocaleDateString(ID_LOCALE, {
    timeZone: WIB_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options,
  });
}

/**
 * Format tanggal pendek ke Bahasa Indonesia.
 * Contoh: "10 Nov 2026"
 */
export function formatDateShortWib(
  date: Date | string | number | null | undefined
): string {
  return formatDateWib(date, { month: 'short' });
}

/**
 * Format tanggal & waktu ke Bahasa Indonesia dalam zona waktu WIB.
 * Contoh: "10 Nov 2026, 23.42 WIB"
 */
export function formatDateTimeWib(
  date: Date | string | number | null | undefined,
  includeSeconds = false
): string {
  const d = toValidDate(date);
  if (!d) return '—';
  const datePart = d.toLocaleDateString(ID_LOCALE, {
    timeZone: WIB_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString(ID_LOCALE, {
    timeZone: WIB_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
  });
  return `${datePart}, ${timePart} WIB`;
}

/**
 * Format waktu saja dalam zona waktu WIB.
 * Contoh: "23.42 WIB"
 */
export function formatTimeWib(
  date: Date | string | number | null | undefined,
  includeSeconds = false
): string {
  const d = toValidDate(date);
  if (!d) return '—';
  const timePart = d.toLocaleTimeString(ID_LOCALE, {
    timeZone: WIB_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
  });
  return `${timePart} WIB`;
}

/**
 * Format angka mata uang Rupiah standar Indonesia.
 * Contoh: formatRupiah(10000000) => "Rp 10.000.000"
 */
export function formatRupiah(
  value: number | string | null | undefined,
  options?: { withPrefix?: boolean; decimals?: number }
): string {
  if (value == null || value === '') return '—';
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return '—';

  const withPrefix = options?.withPrefix ?? true;
  const decimals = options?.decimals ?? 0;

  const formatted = num.toLocaleString(ID_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return withPrefix ? `Rp ${formatted}` : formatted;
}

/**
 * Format angka standar Indonesia (pemisah ribuan titik, desimal koma).
 * Contoh: formatNumberId(1250000.5) => "1.250.000,5"
 */
export function formatNumberId(
  value: number | string | null | undefined,
  decimals = 0
): string {
  return formatRupiah(value, { withPrefix: false, decimals });
}
