/**
 * Validasi struktural berkas PDF tanpa bergantung pada pustaka berat.
 *
 * Yang diperiksa (PRD v2 §5.9 — berkas wajib PDF):
 *  1. magic bytes `%PDF-` di awal berkas,
 *  2. versi header yang wajar (1.x / 2.x),
 *  3. trailer `%%EOF` di ekor berkas,
 *  4. jumlah halaman dari `/Count` tidak melebihi batas,
 *  5. tidak mengandung penanda HTML/JS (PDF yang menyamar).
 *
 * Ini BUKAN pemindai malware. Pemindaian dilakukan terpisah oleh hook ClamAV
 * (`scanFile`), yang bersifat opsional.
 */

export interface PdfValidationResult {
  ok: boolean;
  pageCount: number | null;
  reason?: string;
}

export interface PdfValidationOptions {
  maxPages: number;
}

const HTML_MARKERS = [/<html/i, /<script/i, /<iframe/i, /javascript:/i];

export async function validatePdf(
  body: Buffer,
  options: PdfValidationOptions,
): Promise<PdfValidationResult> {
  if (body.length === 0) {
    return { ok: false, pageCount: null, reason: 'Berkas kosong.' };
  }

  const head = body.subarray(0, 1024).toString('latin1');
  if (!head.startsWith('%PDF-')) {
    return { ok: false, pageCount: null, reason: 'Berkas bukan PDF (magic bytes tidak cocok).' };
  }

  const version = head.slice(5, 8);
  if (!/^[12]\.[0-9]$/.test(version)) {
    return { ok: false, pageCount: null, reason: `Versi PDF '${version}' tidak dikenali.` };
  }

  // Trailer boleh berada di 2 KB terakhir (setelah aliran biner).
  const tail = body.subarray(Math.max(0, body.length - 2048)).toString('latin1');
  if (!tail.includes('%%EOF')) {
    return {
      ok: false,
      pageCount: null,
      reason: 'Struktur PDF tidak lengkap (trailer %%EOF tidak ditemukan).',
    };
  }

  const text = body.toString('latin1');
  if (HTML_MARKERS.some((re) => re.test(text))) {
    return { ok: false, pageCount: null, reason: 'Berkas berisi penanda HTML/JS, bukan PDF murni.' };
  }

  // Jumlah halaman: ambil /Count terbesar dari pohon halaman.
  // `Array.from` dipakai agar lolos typecheck pada target es5.
  const counts = Array.from(text.matchAll(/\/Count\s+(\d+)/g)).map((m) => Number(m[1]));
  const pageCount = counts.length > 0 ? Math.max(...counts) : null;

  if (pageCount !== null && pageCount > options.maxPages) {
    return {
      ok: false,
      pageCount,
      reason: `Jumlah halaman ${pageCount} melebihi batas ${options.maxPages}.`,
    };
  }

  return { ok: true, pageCount };
}
