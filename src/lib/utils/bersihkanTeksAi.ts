/**
 * Pembersih teks AI dari penanda markdown.
 *
 * Diletakkan di modul tersendiri (bukan di targetAchievementAi.ts) karena
 * berkas itu mengimpor aiService yang memakai `node:path`. Komponen klien
 * tidak boleh menarik modul server, jadi fungsi murni ini dipisah.
 */

/**
 * Membersihkan penanda markdown dari teks AI agar tampil sebagai teks biasa.
 *
 * Model kadang tetap mengirim penanda tebal (**...**), judul (###), atau
 * backtick walau sudah diminta tidak. Komponen menampilkan teks apa adanya,
 * jadi penanda itu akan terlihat sebagai simbol aneh bagi pengguna.
 */
export function bersihkanTeksAi(teks: string): string {
  if (!teks) return '';
  let hasil = teks
    // Tebal/miring: **teks**, __teks__, *teks*, _teks_
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s.,:;)]|$)/g, '$1$2')
    // Judul markdown di awal baris: ### Judul
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    // Backtick
    .replace(/`/g, '')
    // Penanda kutipan di awal baris
    .replace(/^\s*>\s?/gm, '');

  // Rapikan spasi di ujung baris, tetapi pertahankan baris baru.
  hasil = hasil
    .split('\n')
    .map((b) => b.replace(/[ \t]+$/g, ''))
    .join('\n');

  return hasil;
}
