import { generateContent, isAiConfigured } from './aiService';

/**
 * Generator usulan KPI TURUNAN untuk rantai BOD -> HR -> People Manager -> Pegawai.
 *
 * Dipakai saat:
 *   - HR membagi KPI korporat (dari BOD) menjadi KPI divisi/departemen,
 *   - HR/People Manager membagi KPI divisi menjadi KPI manajer,
 *   - People Manager membagi KPI manajer menjadi KPI posisi/pegawai.
 *
 * Prinsip sama dengan generator korporat: AI dipakai bila tersedia; bila tidak
 * atau keluarannya tidak valid, FALLBACK deterministik tetap memberi usulan
 * yang nyata (diturunkan dari KPI induk + pemiliknya), bukan contoh kosong.
 */

export type TingkatTurunan = 'DEPARTEMEN' | 'MANAJER' | 'POSISI';

export interface UsulanTurunan {
  kpiTitle: string;
  targetValue: number;
  unitOfMeasure: string;
  /** Bobot dalam persen; total seluruh usulan = 100. */
  weightPct: number;
  rationale: string;
}

export interface KonteksTurunan {
  tingkat: TingkatTurunan;
  /** Judul KPI induk, mis. "Skor kepuasan pasien total". */
  indukJudul: string;
  indukTarget: number;
  indukSatuan: string;
  /** Nama pemilik tingkat ini: departemen / nama people manager / posisi. */
  pemilik: string;
  /** Konteks perusahaan agar usulan tetap selaras visi & misi. */
  visi?: string;
  misi?: string;
}

const SATUAN_VALID = ['%', 'IDR', 'UNIT', 'HARI', 'SKOR'];
export const MIN_USULAN = 2;
export const MAKS_USULAN = 5;

/** Normalisasi bobot agar total tepat 100 (pembulatan AI sering 99/101). */
export function normalkanBobotTurunan(bobot: number[]): number[] {
  const bersih = bobot.map((b) => (Number.isFinite(b) && b > 0 ? b : 0));
  const total = bersih.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    const rata = Math.floor((100 / Math.max(1, bersih.length)) * 100) / 100;
    const hasil = bersih.map(() => rata);
    // Sisa pembulatan diberikan ke item pertama agar total persis 100.
    if (hasil.length > 0) {
      hasil[0] = Math.round((100 - rata * (hasil.length - 1)) * 100) / 100;
    }
    return hasil;
  }
  const diskala = bersih.map((b) => (b / total) * 100);
  const dibulatkan = diskala.map((b) => Math.round(b * 100) / 100);
  // Selisih pembulatan ditambahkan ke item terbesar agar total tepat 100.
  const selisih = Math.round((100 - dibulatkan.reduce((a, b) => a + b, 0)) * 100) / 100;
  if (selisih !== 0) {
    let idx = 0;
    for (let i = 1; i < dibulatkan.length; i += 1) {
      if (dibulatkan[i] > dibulatkan[idx]) idx = i;
    }
    dibulatkan[idx] = Math.round((dibulatkan[idx] + selisih) * 100) / 100;
  }
  return dibulatkan;
}

const LABEL_TINGKAT: Record<TingkatTurunan, string> = {
  DEPARTEMEN: 'divisi/departemen',
  MANAJER: 'people manager',
  POSISI: 'posisi jabatan',
};

/**
 * Fallback deterministik: pecah KPI induk menjadi beberapa ukuran yang wajar
 * untuk tingkat di bawahnya, memakai pemilik sebagai penajam.
 */
export function usulkanTurunanFallback(ctx: KonteksTurunan): UsulanTurunan[] {
  const judul = ctx.indukJudul.trim();
  const pemilik = ctx.pemilik.trim();
  const satuan = SATUAN_VALID.includes(ctx.indukSatuan.toUpperCase())
    ? ctx.indukSatuan.toUpperCase()
    : '%';
  const target = Number.isFinite(ctx.indukTarget) && ctx.indukTarget > 0 ? ctx.indukTarget : 100;

  const usulan: UsulanTurunan[] = [
    {
      kpiTitle: `Kontribusi ${pemilik} terhadap ${judul}`,
      targetValue: Number((target * 0.4).toFixed(2)),
      unitOfMeasure: satuan,
      weightPct: 40,
      rationale: `Mengukur seberapa besar ${pemilik} menopang sasaran induk "${judul}".`,
    },
    {
      kpiTitle: `Kepatuhan proses ${pemilik} dalam mendukung ${judul}`,
      targetValue: 95,
      unitOfMeasure: '%',
      weightPct: 35,
      rationale: 'Menjaga konsistensi pelaksanaan proses agar sasaran induk tercapai.',
    },
    {
      kpiTitle: `Peningkatan mutu berkelanjutan ${pemilik}`,
      targetValue: 10,
      unitOfMeasure: '%',
      weightPct: 25,
      rationale: 'Mendorong perbaikan berkelanjutan sebagai penopang jangka panjang.',
    },
  ];

  const bobot = normalkanBobotTurunan(usulan.map((u) => u.weightPct));
  return usulan.map((u, i) => ({ ...u, weightPct: bobot[i] }));
}

function bangunPrompt(ctx: KonteksTurunan): string {
  const barisVisi = ctx.visi?.trim() ? `VISI PERUSAHAAN: ${ctx.visi.trim()}\n` : '';
  const barisMisi = ctx.misi?.trim() ? `MISI PERUSAHAAN: ${ctx.misi.trim()}\n` : '';
  return (
    `Anda konsultan manajemen kinerja. Susun KPI untuk ${LABEL_TINGKAT[ctx.tingkat]} ` +
    `bernama "${ctx.pemilik}" yang menurunkan KPI induk berikut.\n\n` +
    `KPI INDUK: ${ctx.indukJudul} (target ${ctx.indukTarget} ${ctx.indukSatuan})\n` +
    barisVisi +
    barisMisi +
    `\nAturan:\n` +
    `1. Buat 2-5 KPI yang SPESIFIK untuk "${ctx.pemilik}" dan benar-benar menurunkan KPI induk.\n` +
    `2. Sesuaikan istilah dengan bidang kerja "${ctx.pemilik}" (jangan generik).\n` +
    `3. Target harus angka positif; satuan salah satu: %, IDR, UNIT, HARI, SKOR.\n` +
    `4. Total weightPct tepat 100.\n` +
    `5. Sertakan rationale satu kalimat yang menghubungkan ke KPI induk.\n\n` +
    `Balas HANYA JSON array tanpa penjelasan:\n` +
    `[{"kpiTitle":"...","targetValue":100,"unitOfMeasure":"%","weightPct":40,"rationale":"..."}]`
  );
}

/** Bersihkan & validasi keluaran AI agar layak ditampilkan/diambil BOD-HR-PM. */
export function sanitasiTurunan(mentah: unknown): UsulanTurunan[] {
  if (!Array.isArray(mentah)) return [];
  const bersih: UsulanTurunan[] = [];

  for (const m of mentah) {
    if (!m || typeof m !== 'object') continue;
    const o = m as Record<string, unknown>;
    const judul = String(o.kpiTitle ?? o.kpi_title ?? o.title ?? '').trim();
    if (judul.length < 5 || judul.length > 255) continue;

    const target = Number(o.targetValue ?? o.target_value);
    if (!Number.isFinite(target) || target <= 0) continue;

    const satuan = String(o.unitOfMeasure ?? o.unit_of_measure ?? '%').toUpperCase();
    if (!SATUAN_VALID.includes(satuan)) continue;

    bersih.push({
      kpiTitle: judul,
      targetValue: target,
      unitOfMeasure: satuan,
      weightPct: Number(o.weightPct ?? o.weight_pct ?? 0) || 0,
      rationale: String(o.rationale ?? o.rasional ?? '').trim().slice(0, 300),
    });
  }

  const dibatasi = bersih.slice(0, MAKS_USULAN);
  const bobot = normalkanBobotTurunan(dibatasi.map((u) => u.weightPct));
  return dibatasi.map((u, i) => ({ ...u, weightPct: bobot[i] }));
}

export interface HasilTurunan {
  usulan: UsulanTurunan[];
  sumber: 'AI' | 'FALLBACK';
  catatan: string | null;
}

/**
 * Hasilkan usulan KPI turunan: AI bila tersedia & valid, selain itu fallback.
 */
export async function usulkanKpiTurunan(ctx: KonteksTurunan): Promise<HasilTurunan> {
  if (!ctx.indukJudul?.trim() || !ctx.pemilik?.trim()) {
    return {
      usulan: [],
      sumber: 'FALLBACK',
      catatan: 'KPI induk atau pemilik tingkat ini belum ditentukan.',
    };
  }

  if (!isAiConfigured()) {
    return {
      usulan: usulkanTurunanFallback(ctx),
      sumber: 'FALLBACK',
      catatan: 'AI tidak terkonfigurasi; usulan disusun deterministik dari KPI induk.',
    };
  }

  try {
    const hasil = await generateContent(bangunPrompt(ctx), {
      maxOutputTokens: 1024,
      temperature: 0.3,
    });
    const teks = String(hasil?.text ?? '');
    const mulai = teks.indexOf('[');
    const akhir = teks.lastIndexOf(']');
    if (mulai < 0 || akhir <= mulai) throw new Error('format tidak dikenali');

    const mentah = JSON.parse(teks.slice(mulai, akhir + 1));
    const usulan = sanitasiTurunan(mentah);
    if (usulan.length < MIN_USULAN) throw new Error('usulan terlalu sedikit');

    return { usulan, sumber: 'AI', catatan: null };
  } catch {
    return {
      usulan: usulkanTurunanFallback(ctx),
      sumber: 'FALLBACK',
      catatan: 'AI tidak menghasilkan usulan yang valid; dipakai penurunan deterministik dari KPI induk.',
    };
  }
}
