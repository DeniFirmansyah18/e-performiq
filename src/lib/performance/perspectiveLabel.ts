/**
 * Label manusia untuk perspektif Balanced Scorecard.
 *
 * Kode mentah (FINANCIAL, CUSTOMER, ...) adalah istilah teknis basis data.
 * BOD/HR tidak perlu melihatnya; yang ditampilkan adalah nama yang mudah
 * dipahami. Kode tak dikenal dikembalikan apa adanya agar tidak menyesatkan.
 */
export const LABEL_PERSPEKTIF: Record<string, string> = {
  FINANCIAL: 'Keuangan',
  CUSTOMER: 'Pelanggan',
  INTERNAL_PROCESS: 'Proses Internal',
  LEARNING_GROWTH: 'Pembelajaran & Pertumbuhan',
};

export function labelPerspektif(kode: string | null | undefined): string {
  const kunci = String(kode ?? '').trim().toUpperCase();
  if (!kunci) return '';
  return LABEL_PERSPEKTIF[kunci] ?? kode!.toString().trim();
}
