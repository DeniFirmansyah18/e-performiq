/**
 * KPI Portfolio PDF Service — membuat PDF ASLI (pdf-lib) berisi rekapitulasi
 * portofolio KPI seorang karyawan untuk satu periode, bersumber langsung dari
 * tabel `individual_kpis` + `performance_appraisals`. Deterministik, tanpa
 * dependensi jaringan.
 */
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';

export interface KpiPortfolioRow {
  kpiTitle: string;
  strategicPillarName?: string | null;
  unit: string;
  targetValue: number;
  actualValue: number;
  kpiWeight: number;
  achievementPercentage: number;
  status: string;
}

export interface KpiPortfolioPdfInput {
  employeeName: string;
  employeeCode: string;
  departmentName?: string | null;
  positionTitle?: string | null;
  periodCode: string;
  kpiScore?: number | null; // kpi_composite_score
  totalScore?: number | null; // total_percentage_score
  gpa?: number | null;
  rating?: string | null;
  rows: KpiPortfolioRow[];
  generatedAt?: Date;
}

const GREEN = rgb(0.00, 0.30, 0.22);
const GREEN_LIGHT = rgb(0.89, 0.95, 0.93);
const DARK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.39, 0.45, 0.55);
const LINE = rgb(0.80, 0.84, 0.88);
const WHITE = rgb(1, 1, 1);

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 42;
const CONTENT_W = A4[0] - MARGIN * 2;

/** Buang karakter non-WinAnsi agar font standar pdf-lib tak error. */
function safe(text: string): string {
  return String(text ?? '').replace(/[^\x20-\x7E\u00A0-\u00FF]/g, ' ').trim();
}

/** Potong teks agar muat dalam lebar tertentu (ellipsis bila perlu). */
function clip(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let t = safe(text);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + '...', size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '...';
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtNum(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString('id-ID');
}

export async function buildKpiPortfolioPdf(input: KpiPortfolioPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage(A4);
  const { width, height } = page.getSize();

  const draw = (p: PDFPage, text: string, x: number, y: number, size: number, font = helv, color = DARK) =>
    p.drawText(safe(text), { x, y, size, font, color });

  // ── Header band ──────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 96, width, height: 96, color: GREEN });
  draw(page, 'E-PERFORMIQ', MARGIN, height - 44, 18, helvBold, WHITE);
  draw(page, 'Rekapitulasi Portofolio KPI Karyawan', MARGIN, height - 66, 12, helv, GREEN_LIGHT);
  const gen = `Dicetak: ${fmtDate(input.generatedAt ?? new Date())}`;
  draw(page, gen, width - MARGIN - helv.widthOfTextAtSize(safe(gen), 9), height - 44, 9, helv, GREEN_LIGHT);

  // ── Identitas karyawan ───────────────────────────────────────
  let y = height - 130;
  draw(page, 'IDENTITAS KARYAWAN', MARGIN, y, 10, helvBold, GREEN);
  y -= 16;
  const ident: Array<[string, string]> = [
    ['Nama', input.employeeName],
    ['NIP', input.employeeCode || '-'],
    ['Jabatan', input.positionTitle || '-'],
    ['Unit Kerja', input.departmentName || '-'],
    ['Periode Penilaian', input.periodCode || '-'],
  ];
  ident.forEach(([label, val], i) => {
    const col = i % 2;
    const rowY = y - Math.floor(i / 2) * 15;
    const x = MARGIN + col * (CONTENT_W / 2);
    draw(page, `${label}`, x, rowY, 9, helvBold, MUTED);
    draw(page, `: ${val}`, x + 80, rowY, 9, helv, DARK);
  });
  y = y - Math.ceil(ident.length / 2) * 15 - 8;

  // ── Ringkasan skor ───────────────────────────────────────────
  if (input.kpiScore != null || input.totalScore != null || input.gpa != null || input.rating) {
    y -= 12;
    draw(page, 'RINGKASAN PENILAIAN', MARGIN, y, 10, helvBold, GREEN);
    y -= 10;
    const cards: Array<[string, string]> = [
      ['Skor KPI', input.kpiScore != null ? `${fmtNum(input.kpiScore)}%` : '-'],
      ['Skor Total', input.totalScore != null ? `${fmtNum(input.totalScore)}%` : '-'],
      ['GPA', input.gpa != null ? fmtNum(input.gpa) : '-'],
      ['Peringkat', input.rating || '-'],
    ];
    const cw = CONTENT_W / cards.length;
    const ch = 44;
    cards.forEach(([label, val], i) => {
      const cx = MARGIN + i * cw;
      page.drawRectangle({ x: cx + 3, y: y - ch, width: cw - 6, height: ch, color: GREEN_LIGHT, borderColor: LINE, borderWidth: 0.5 });
      const vw = helvBold.widthOfTextAtSize(safe(val), 15);
      draw(page, val, cx + (cw - vw) / 2, y - 26, 15, helvBold, GREEN);
      const lw = helv.widthOfTextAtSize(safe(label), 8);
      draw(page, label, cx + (cw - lw) / 2, y - 38, 8, helv, MUTED);
    });
    y -= ch + 8;
  }

  // ── Tabel KPI ────────────────────────────────────────────────
  const cols = [
    { key: 'no', label: '#', w: 22, align: 'left' as const },
    { key: 'title', label: 'Indikator Kinerja (KPI)', w: 190, align: 'left' as const },
    { key: 'target', label: 'Target', w: 58, align: 'right' as const },
    { key: 'actual', label: 'Realisasi', w: 58, align: 'right' as const },
    { key: 'unit', label: 'Satuan', w: 48, align: 'left' as const },
    { key: 'weight', label: 'Bobot', w: 44, align: 'right' as const },
    { key: 'ach', label: 'Capaian', w: 55, align: 'right' as const },
    { key: 'status', label: 'Status', w: 50, align: 'left' as const },
  ];
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  const scale = CONTENT_W / totalW;
  const colX: number[] = [];
  let acc = MARGIN;
  cols.forEach((c) => {
    colX.push(acc);
    acc += c.w * scale;
  });

  const drawTableHeader = (p: PDFPage, atY: number) => {
    p.drawRectangle({ x: MARGIN, y: atY - 18, width: CONTENT_W, height: 18, color: GREEN });
    cols.forEach((c, i) => {
      const label = clip(c.label, helvBold, 8, c.w * scale - 6);
      const tw = helvBold.widthOfTextAtSize(label, 8);
      const x = c.align === 'right' ? colX[i] + c.w * scale - 4 - tw : colX[i] + 4;
      p.drawText(label, { x, y: atY - 12.5, size: 8, font: helvBold, color: WHITE });
    });
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + 24) {
      // footer halaman lalu halaman baru
      drawFooter(doc, page, helv, input.periodCode);
      page = doc.addPage(A4);
      y = height - MARGIN;
      draw(page, 'REKAPITULASI PORTOFOLIO KPI (LANJUTAN)', MARGIN, y - 4, 10, helvBold, GREEN);
      y -= 24;
      drawTableHeader(page, y);
      y -= 18;
    }
  };

  y -= 14;
  draw(page, 'RINCIAN INDIKATOR KINERJA', MARGIN, y, 10, helvBold, GREEN);
  y -= 14;
  drawTableHeader(page, y);
  y -= 18;

  if (input.rows.length === 0) {
    draw(page, 'Belum ada KPI pada periode ini.', MARGIN + 4, y - 10, 9, helv, MUTED);
    y -= 20;
  }

  input.rows.forEach((r, idx) => {
    ensureSpace(20);
    const rowH = 18;
    if (idx % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: y - rowH + 3, width: CONTENT_W, height: rowH, color: rgb(0.97, 0.98, 0.99) });
    }
    page.drawLine({ start: { x: MARGIN, y: y - rowH + 3 }, end: { x: MARGIN + CONTENT_W, y: y - rowH + 3 }, thickness: 0.4, color: LINE });

    const cellY = y - 10;
    const vals: Array<[string, number, 'left' | 'right']> = [
      [String(idx + 1), 0, 'left'],
      [clip(r.kpiTitle, helv, 8, cols[1].w * scale - 6), 1, 'left'],
      [fmtNum(r.targetValue), 2, 'right'],
      [fmtNum(r.actualValue), 3, 'right'],
      [r.unit || '%', 4, 'left'],
      [`${fmtNum(r.kpiWeight)}%`, 5, 'right'],
      [`${fmtNum(r.achievementPercentage)}%`, 6, 'right'],
      [r.status, 7, 'left'],
    ];
    vals.forEach(([text, ci, align]) => {
      const font = ci === 1 ? helv : helv;
      const size = 8;
      const cw = cols[ci].w * scale;
      const tw = font.widthOfTextAtSize(safe(text), size);
      const x = align === 'right' ? colX[ci] + cw - 4 - tw : colX[ci] + 4;
      const color = ci === 6 ? GREEN : DARK;
      page.drawText(safe(text), { x, y: cellY, size, font, color });
    });
    y -= rowH;
  });

  // total bobot
  if (input.rows.length > 0) {
    const totalWeight = input.rows.reduce((s, r) => s + (Number(r.kpiWeight) || 0), 0);
    ensureSpace(20);
    draw(page, `Total Bobot: ${fmtNum(totalWeight)}%`, MARGIN, y - 6, 8, helvBold, MUTED);
    y -= 18;
  }

  drawFooter(doc, page, helv, input.periodCode);

  return doc.save();
}

function drawFooter(doc: PDFDocument, page: PDFPage, helv: PDFFont, periodCode: string) {
  const { width } = page.getSize();
  const note = `Dokumen ini dihasilkan otomatis oleh E-PerformIQ dari basis data kepegawaian. Periode ${safe(periodCode)}.`;
  const size = 7;
  const tw = helv.widthOfTextAtSize(safe(note), size);
  page.drawLine({ start: { x: MARGIN, y: 34 }, end: { x: width - MARGIN, y: 34 }, thickness: 0.4, color: LINE });
  page.drawText(safe(note), { x: (width - tw) / 2, y: 24, size, font: helv, color: MUTED });
}
