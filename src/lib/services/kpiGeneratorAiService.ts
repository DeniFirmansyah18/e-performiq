/**
 * Generator KPI Korporat dari Visi & Misi perusahaan (BOD).
 *
 * Alur yang dilayani:
 *   BOD menetapkan VISI & MISI  ->  AI mengusulkan KPI korporat beserta
 *   pilar strategis, target, satuan, dan bobotnya  ->  BOD menyetujui  ->
 *   KPI diturunkan HR ke departemen, People Manager, posisi, lalu pegawai.
 *
 * AI dipakai bila terkonfigurasi; bila tidak, FALLBACK deterministik tetap
 * menghasilkan KPI yang NYATA (bukan contoh kosong) dengan menurunkannya dari
 * pilar strategis yang ada. Dengan begitu alur tetap berjalan tanpa AI.
 */

import type { Db } from '@/lib/db/client';
import { isAiConfigured, generateContent } from './aiService';
import { SARAN_JUMLAH_KPI } from './kpiCascade';

export interface UsulanKpi {
  kpiName: string;
  /** Nama pilar strategis yang didukung. */
  pillarName: string;
  perspective: string;
  targetValue: number;
  unitOfMeasure: string;
  /** Bobot dalam persen; total seluruh usulan = 100. */
  weightPct: number;
  /** Alasan singkat mengapa KPI ini mendukung visi/misi. */
  rationale: string;
}

export interface HasilUsulan {
  kpis: UsulanKpi[];
  /** AI dipakai atau fallback deterministik. */
  sumber: 'AI' | 'FALLBACK';
  catatan: string | null;
}

export interface KonteksPerusahaan {
  vision: string;
  mission: string;
  /** Pilar strategis yang sudah ada di sistem. */
  pilar: Array<{ perspective: string; pillarName: string; weight: number }>;
}

/** Satuan yang wajar dipakai KPI korporat. */
const SATUAN_VALID = ['%', 'IDR', 'UNIT', 'HARI', 'SKOR'];

/**
 * Normalkan bobot agar totalnya tepat 100%.
 *
 * Pembulatan AI sering menghasilkan 99 atau 101; bobot yang tidak 100 membuat
 * penilaian kinerja tidak sah, jadi diperbaiki otomatis di sini.
 */
export function normalkanBobot(bobot: number[]): number[] {
  const bersih = bobot.map((b) => (Number.isFinite(b) && b > 0 ? b : 0));
  const total = bersih.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    // Bagi rata bila seluruh bobot tidak sah.
    const n = bersih.length || 1;
    const rata = Math.floor(100 / n);
    const hasil = Array(n).fill(rata);
    hasil[0] += 100 - rata * n;
    return hasil;
  }
  const skala = bersih.map((b) => (b / total) * 100);
  const dibulatkan = skala.map((b) => Math.max(1, Math.round(b)));
  // Koreksi selisih pembulatan pada nilai terbesar.
  const selisih = 100 - dibulatkan.reduce((a, b) => a + b, 0);
  if (selisih !== 0) {
    const iMaks = dibulatkan.indexOf(Math.max(...dibulatkan));
    dibulatkan[iMaks] = Math.max(1, dibulatkan[iMaks] + selisih);
  }
  return dibulatkan;
}

/**
 * Fallback deterministik: turunkan KPI korporat dari pilar strategis.
 *
 * Setiap pilar menghasilkan satu KPI yang mendukung visi/misi, sehingga jumlah
 * dan bobotnya selalu konsisten dengan pilar yang benar-benar ada di sistem.
 */
export function fallbackUsulanKpi(ctx: KonteksPerusahaan): UsulanKpi[] {
  if (ctx.pilar.length === 0) return [];

  const bobot = normalkanBobot(ctx.pilar.map((p) => p.weight));
  return ctx.pilar.map((p, i) => ({
    kpiName: `Capaian ${p.pillarName}`,
    pillarName: p.pillarName,
    perspective: p.perspective,
    targetValue: p.perspective === 'FINANCIAL' ? 1_000_000_000 : 95,
    unitOfMeasure: p.perspective === 'FINANCIAL' ? 'IDR' : '%',
    weightPct: bobot[i],
    rationale: `Mendukung misi perusahaan melalui pilar ${p.pillarName}.`,
  }));
}

/** Validasi & bersihkan usulan AI agar layak disimpan. */
function sanitasiUsulan(
  mentah: unknown,
  ctx: KonteksPerusahaan
): UsulanKpi[] {
  if (!Array.isArray(mentah)) return [];
  const namaPilar = new Set(ctx.pilar.map((p) => p.pillarName));

  const bersih: UsulanKpi[] = [];
  for (const m of mentah) {
    if (!m || typeof m !== 'object') continue;
    const o = m as Record<string, unknown>;
    const nama = String(o.kpiName ?? o.kpi_name ?? '').trim();
    if (nama.length < 5 || nama.length > 255) continue;

    const target = Number(o.targetValue ?? o.target_value);
    if (!Number.isFinite(target) || target <= 0) continue;

    const satuan = String(o.unitOfMeasure ?? o.unit_of_measure ?? '%').toUpperCase();
    if (!SATUAN_VALID.includes(satuan)) continue;

    // Pilar WAJIB salah satu yang ada — mencegah AI mengarang pilar baru.
    const pilar = String(o.pillarName ?? o.pillar_name ?? '').trim();
    if (!namaPilar.has(pilar)) continue;

    const p = ctx.pilar.find((x) => x.pillarName === pilar)!;
    bersih.push({
      kpiName: nama,
      pillarName: pilar,
      perspective: p.perspective,
      targetValue: target,
      unitOfMeasure: satuan,
      weightPct: Number(o.weightPct ?? o.weight_pct ?? 0) || 0,
      rationale: String(o.rationale ?? '').trim().slice(0, 300),
    });
  }

  // Maksimal 5 KPI korporat (pedoman 3-5).
  const dibatasi = bersih.slice(0, SARAN_JUMLAH_KPI.PERUSAHAAN.maks);
  const bobot = normalkanBobot(dibatasi.map((k) => k.weightPct));
  return dibatasi.map((k, i) => ({ ...k, weightPct: bobot[i] }));
}

function bangunPrompt(ctx: KonteksPerusahaan): string {
  const daftarPilar = ctx.pilar
    .map((p) => `- ${p.perspective}: ${p.pillarName} (bobot ${p.weight}%)`)
    .join('\n');

  return `Anda konsultan manajemen kinerja. Susun KPI KORPORAT yang mendukung visi & misi berikut.

VISI: ${ctx.vision}
MISI: ${ctx.mission}

PILAR STRATEGIS (pilih HANYA dari daftar ini):
${daftarPilar}

Aturan:
1. Buat 3-5 KPI korporat berbahasa Indonesia.
2. Setiap KPI WAJIB memakai salah satu nama pilar di atas (tulis persis sama).
3. Target harus angka positif; satuan salah satu: % , IDR, UNIT, HARI, SKOR.
4. Total bobot (weightPct) harus tepat 100.
5. Sertakan alasan singkat (rationale) maksimal satu kalimat.

Balas HANYA JSON array tanpa penjelasan:
[{"kpiName":"...","pillarName":"...","targetValue":100,"unitOfMeasure":"%","weightPct":25,"rationale":"..."}]`;
}

/**
 * Hasilkan usulan KPI korporat dari visi & misi.
 *
 * AI dipakai bila terkonfigurasi; hasilnya divalidasi ketat (pilar harus ada,
 * target positif, bobot total 100). Bila AI gagal/tidak valid, fallback dipakai
 * sehingga BOD selalu mendapat usulan yang dapat langsung ditindaklanjuti.
 */
export async function usulkanKpiDariVisiMisi(ctx: KonteksPerusahaan): Promise<HasilUsulan> {
  if (!ctx.vision?.trim() || !ctx.mission?.trim()) {
    return {
      kpis: [],
      sumber: 'FALLBACK',
      catatan: 'Visi & misi belum diisi. Lengkapi terlebih dahulu agar KPI selaras.',
    };
  }
  if (ctx.pilar.length === 0) {
    return {
      kpis: [],
      sumber: 'FALLBACK',
      catatan: 'Belum ada pilar strategis. Tetapkan pilar strategis terlebih dahulu.',
    };
  }

  if (!isAiConfigured()) {
    return {
      kpis: fallbackUsulanKpi(ctx),
      sumber: 'FALLBACK',
      catatan: 'AI tidak terkonfigurasi — usulan disusun dari pilar strategis yang ada.',
    };
  }

  try {
    const hasil = await generateContent(bangunPrompt(ctx));
    const teks = String(hasil?.text ?? '');
    const mulai = teks.indexOf('[');
    const akhir = teks.lastIndexOf(']');
    if (mulai < 0 || akhir <= mulai) throw new Error('format tidak dikenali');

    const mentah = JSON.parse(teks.slice(mulai, akhir + 1));
    const kpis = sanitasiUsulan(mentah, ctx);
    if (kpis.length < SARAN_JUMLAH_KPI.PERUSAHAAN.min) throw new Error('usulan terlalu sedikit');

    return { kpis, sumber: 'AI', catatan: null };
  } catch {
    return {
      kpis: fallbackUsulanKpi(ctx),
      sumber: 'FALLBACK',
      catatan: 'AI tidak menghasilkan usulan yang valid — dipakai usulan dari pilar strategis.',
    };
  }
}

/** Baca visi, misi, dan pilar strategis dari basis data. */
export async function muatKonteksPerusahaan(db: Db, companyId: string): Promise<KonteksPerusahaan> {
  const { sql } = await import('drizzle-orm');
  const vm = (await db.execute(sql`
    SELECT vision, mission FROM company_vision_mission
     WHERE company_id = ${companyId}::uuid LIMIT 1
  `)) as unknown as { rows: Array<{ vision: string; mission: string }> };

  const pilar = (await db.execute(sql`
    SELECT perspective::text AS "perspective", pillar_name AS "pillarName",
           strategic_weight::float8 AS "weight"
      FROM strategic_pillars
     WHERE company_id = ${companyId}::uuid AND is_active = TRUE
     ORDER BY strategic_weight DESC
  `)) as unknown as { rows: Array<{ perspective: string; pillarName: string; weight: number }> };

  return {
    vision: vm.rows?.[0]?.vision ?? '',
    mission: vm.rows?.[0]?.mission ?? '',
    pilar: pilar.rows ?? [],
  };
}
