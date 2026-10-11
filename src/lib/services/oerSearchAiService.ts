/**
 * OER Search AI Service — pencarian materi gratis (Open Educational Resources)
 * berbantuan AI dengan acuan Professional Learning Module (PLM) perusahaan.
 *
 * Alur:
 *  1. Terima kata kunci keahlian (mis. "typescript", "leadership") + opsi
 *     konteks posisi. Bila posisi disertakan, PLM perusahaan dipakai sebagai
 *     acuan agar rekomendasi selaras jalur belajar perusahaan.
 *  2. Minta AI mengembalikan daftar modul NYATA (judul, penyedia, url https,
 *     format PDF/DOC/VIDEO) dari portal OER gratis.
 *  3. Validasi setiap url terhadap whitelist domain tepercaya. Bila AI tidak
 *     tersedia / semua url tidak valid → fallback katalog OER terkurasi.
 */
import { matchOerResources, isTrustedOerUrl, type OerResource } from '@/lib/services/oerCatalogService';
import { plmReferenceForPrompt, plmSkillKeywords } from '@/lib/services/companyLearningCatalog';

export interface OerSearchResult extends OerResource {
  /** Format materi: PDF/DOC/VIDEO/PAGE. */
  format: 'PDF' | 'DOC' | 'VIDEO' | 'PAGE';
  /** Tingkat (bila diketahui). */
  level?: string | null;
  /** Apakah rekomendasi berasal dari AI (true) atau katalog terkurasi (false). */
  aiRecommended: boolean;
}

function guessFormat(url: string): OerSearchResult['format'] {
  const u = url.toLowerCase();
  if (u.includes('youtube.') || u.includes('youtu.be') || u.includes('video')) return 'VIDEO';
  if (u.endsWith('.pdf') || u.includes('.pdf')) return 'PDF';
  if (u.endsWith('.doc') || u.endsWith('.docx')) return 'DOC';
  return 'PAGE';
}

/** Fallback: katalog OER terkurasi dicocokkan dengan keyword + skill PLM. */
export function fallbackOerResults(query: string, positionTitle?: string | null, skills: string[] = [], limit = 6): OerSearchResult[] {
  const q = (query ?? '').trim();
  const kw = q ? q.split(/\s+/) : skills;
  const base = matchOerResources(kw, limit);
  const merged: OerSearchResult[] = base.map((r) => ({
    ...r,
    format: guessFormat(r.url),
    level: null,
    aiRecommended: false,
  }));
  return merged;
}

interface AiOerItem { title?: unknown; provider?: unknown; url?: unknown; format?: unknown; level?: unknown }

/** Ekstrak JSON array dari keluaran model (toleran terhadap teks pembungkus). */
function parseAiItems(raw: string): OerSearchResult[] {
  const text = String(raw ?? '').trim();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  let arr: unknown;
  try { arr = JSON.parse(text.slice(start, end + 1)); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const out: OerSearchResult[] = [];
  for (const it of arr as AiOerItem[]) {
    const title = typeof it?.title === 'string' ? it.title.trim().slice(0, 240) : '';
    const url = typeof it?.url === 'string' ? it.url.trim() : '';
    if (!title || !url) continue;
    // Keamanan: hanya tautan https domain tepercaya yang diterima.
    if (!isTrustedOerUrl(url)) continue;
    const provider = typeof it?.provider === 'string' && it.provider.trim() ? it.provider.trim().slice(0, 80) : 'OER';
    const fmtRaw = typeof it?.format === 'string' ? it.format.trim().toUpperCase() : '';
    const format: OerSearchResult['format'] = (['PDF', 'DOC', 'VIDEO', 'PAGE'] as const).includes(fmtRaw as any)
      ? (fmtRaw as OerSearchResult['format'])
      : guessFormat(url);
    const level = typeof it?.level === 'string' ? it.level.trim().slice(0, 40) : null;
    out.push({ title, url, provider, topics: [title.toLowerCase()], format, level, aiRecommended: true });
  }
  return out.slice(0, 12);
}

/**
 * Cari materi OER gratis berbantuan AI. Selalu memvalidasi tautan; bila AI
 * tidak dikonfigurasi atau hasil tidak valid → fallback katalog terkurasi.
 */
export async function searchOerWithAi(input: {
  query: string;
  positionTitle?: string | null;
  requiredSkills?: string[];
  limit?: number;
}): Promise<{ results: OerSearchResult[]; aiUsed: boolean; query: string }> {
  const query = (input.query ?? '').trim();
  const positionTitle = input.positionTitle ?? null;
  const requiredSkills = input.requiredSkills ?? [];
  const limit = Math.min(Math.max(input.limit ?? 6, 1), 12);

  // Kata kunci efektif: query eksplisit, atau kata kunci keahlian dari PLM posisi.
  const skillKeywords = positionTitle || requiredSkills.length
    ? plmSkillKeywords(positionTitle ?? '', requiredSkills)
    : [];
  const effectiveKeywords = query ? [query] : skillKeywords;
  const keywordList = Array.from(new Set([...effectiveKeywords, ...requiredSkills])).filter(Boolean);

  let aiUsed = false;
  let results: OerSearchResult[] = [];
  try {
    const { generateContent, isAiConfigured } = await import('@/lib/services/aiService');
    if (isAiConfigured()) {
      const plm = positionTitle || requiredSkills.length ? plmReferenceForPrompt(positionTitle ?? '', requiredSkills) : '';
      const prompt =
        'Anda membantu HR mencari materi pembelajaran GRATIS (Open Educational Resources) di internet untuk keahlian berikut.\n' +
        `Kata kunci keahlian: ${keywordList.join(', ') || query || '(umum)'}\n` +
        (positionTitle ? `Posisi: ${positionTitle}\n` : '') +
        (plm ? `Acuan Professional Learning Module perusahaan (jadikan dasar rekomendasi):\n${plm}\n` : '') +
        `\nKembalikan TEPAT ${limit} materi pembelajaran ASLI yang benar-benar ada di web, ` +
        'berformat dokumen/PDF maupun video, dari portal gratis tepercaya (OpenLearn, Microsoft Learn, AWS Skill Builder, Google Cloud Skills Boost, freeCodeCamp, MIT OpenCourseWare, Khan Academy, roadmap.sh, Coursera audit, edX audit). ' +
        'Keluaran HARUS JSON ARRAY valid tanpa teks lain, tanpa blok markdown. Setiap elemen: ' +
        '{"title": string, "provider": string, "url": string (https lengkap & benar), "format": "PDF"|"DOC"|"VIDEO"|"PAGE", "level": "Foundation"|"Intermediate"|"Advanced"|null}. ' +
        'url WAJIB https dan berasal dari domain tepercaya di atas. Utamakan format PDF/DOC untuk materi dokumen dan VIDEO untuk kuliah/tutorial. Jangan mengarang tautan.';
      const res = await generateContent(prompt, { maxOutputTokens: 1800, temperature: 0.2 });
      if (res?.text && res.text.trim()) {
        const parsed = parseAiItems(res.text);
        if (parsed.length > 0) { results = parsed; aiUsed = true; }
      }
    }
  } catch { /* fallback di bawah */ }

  if (results.length === 0) {
    results = fallbackOerResults(query, positionTitle, requiredSkills, limit);
  }

  return { results: results.slice(0, limit), aiUsed, query };
}
