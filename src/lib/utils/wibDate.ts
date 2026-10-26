/**
 * Tanggal hari ini menurut zona waktu Indonesia Barat (UTC+7).
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
