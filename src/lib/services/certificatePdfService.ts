/**
 * Certificate PDF Service — selalu membuat PDF ASLI (bukan HTML-to-print)
 * memakai `pdf-lib`, sehingga berkas yang diunduh benar-benar dokumen PDF
 * berisi bukti penyelesaian onboarding/kursus + kode verifikasi publik.
 *
 * Deterministik & tanpa dependensi jaringan. Bila perusahaan punya logo, dapat
 * ditambahkan sebagai image di dalam layout di bawah.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface CertificatePdfInput {
  employeeName: string;
  courseTitle: string;
  certificateNo: string;
  verificationCode: string;
  issuedAt: string | Date | null;
  /** Base url publik untuk menautkan halaman verifikasi di footer. */
  verifyBaseUrl?: string;
}

const GREEN = rgb(0.00, 0.30, 0.22);
const DARK = rgb(0.06, 0.09, 0.16);
const GOLD = rgb(0.71, 0.54, 0.11);
const MUTED = rgb(0.39, 0.45, 0.55);

/** Bentuk teks aman (buang karakter non-WinAnsi agar font standar tak error). */
function safe(text: string): string {
  return String(text ?? '').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, ' ').slice(0, 200);
}

function fmtDate(d: string | Date | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Bangun dokumen PDF sertifikat (A4 landscape). */
export async function buildCertificatePdf(input: CertificatePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]); // A4 landscape (points)
  const { width, height } = page.getSize();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helvObl = await doc.embedFont(StandardFonts.HelveticaOblique);

  const margin = 36;
  // Bingkai ganda.
  page.drawRectangle({ x: margin, y: margin, width: width - margin * 2, height: height - margin * 2, borderColor: GREEN, borderWidth: 3 });
  page.drawRectangle({ x: margin + 8, y: margin + 8, width: width - (margin + 8) * 2, height: height - (margin + 8) * 2, borderColor: GOLD, borderWidth: 1 });

  const centerX = (t: string, font = helv, size = 12) => (width - font.widthOfTextAtSize(safe(t), size)) / 2;
  let y = height - 110;

  // Header penerbit.
  const header = 'HR COMMAND CENTER';
  page.drawText(header, { x: centerX(header, helvBold, 20), y, size: 20, font: helvBold, color: GREEN });
  y -= 22;
  const sub = 'Sistem Penilaian & Pengembangan Karyawan';
  page.drawText(sub, { x: centerX(sub, helv, 11), y, size: 11, font: helv, color: MUTED });

  // Judul.
  y -= 60;
  const title = 'SERTIFIKAT PENYELESAIAN';
  page.drawText(title, { x: centerX(title, helvBold, 30), y, size: 30, font: helvBold, color: DARK });
  y -= 34;
  const subtitle = 'Certificate of Completion';
  page.drawText(subtitle, { x: centerX(subtitle, helvObl, 14), y, size: 14, font: helvObl, color: GOLD });

  // Diberikan kepada.
  y -= 52;
  const given = 'Diberikan kepada:';
  page.drawText(given, { x: centerX(given, helv, 12), y, size: 12, font: helv, color: MUTED });

  y -= 34;
  const name = safe(input.employeeName || 'Karyawan');
  page.drawText(name, { x: centerX(name, helvBold, 24), y, size: 24, font: helvBold, color: DARK });
  // Garis bawah nama.
  const nameW = helvBold.widthOfTextAtSize(name, 24);
  page.drawLine({ start: { x: (width - nameW) / 2 - 20, y: y - 8 }, end: { x: (width + nameW) / 2 + 20, y: y - 8 }, thickness: 1, color: GOLD });

  y -= 44;
  const desc = 'telah menyelesaikan program pembelajaran:';
  page.drawText(desc, { x: centerX(desc, helv, 12), y, size: 12, font: helv, color: MUTED });

  y -= 30;
  const course = safe(input.courseTitle || 'Program Onboarding');
  page.drawText(course, { x: centerX(course, helvBold, 18), y, size: 18, font: helvBold, color: GREEN });

  // Blok metadata (kiri) + tanggal (kanan).
  const metaY = margin + 96;
  page.drawText(`No. Sertifikat: ${safe(input.certificateNo)}`, { x: margin + 40, y: metaY, size: 9, font: helv, color: MUTED });
  page.drawText(`Kode Verifikasi: ${safe(input.verificationCode)}`, { x: margin + 40, y: metaY - 14, size: 9, font: helv, color: MUTED });
  const issued = `Diterbitkan: ${fmtDate(input.issuedAt)}`;
  page.drawText(issued, { x: width - margin - 40 - helv.widthOfTextAtSize(issued, 9), y: metaY, size: 9, font: helv, color: MUTED });

  // Tanda tangan.
  const sigY = margin + 60;
  const sigX = width - margin - 220;
  page.drawLine({ start: { x: sigX, y: sigY + 34 }, end: { x: sigX + 180, y: sigY + 34 }, thickness: 0.8, color: MUTED });
  page.drawText('Human Capital / Learning & Development', { x: sigX + 6, y: sigY + 20, size: 9, font: helv, color: DARK });

  // Footer verifikasi.
  if (input.verifyBaseUrl) {
    const url = `${input.verifyBaseUrl.replace(/\/$/, '')}/certificates/verify/${input.verificationCode}`;
    page.drawText(`Verifikasi keaslian: ${safe(url)}`, { x: margin + 40, y: margin + 30, size: 8, font: helv, color: MUTED });
  }
  const note = 'Dokumen ini diterbitkan secara digital oleh HR Command Center dan dapat diverifikasi keasliannya.';
  page.drawText(note, { x: margin + 40, y: margin + 18, size: 8, font: helvObl, color: MUTED });

  return doc.save();
}
