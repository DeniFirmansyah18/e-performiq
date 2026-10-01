// AI service (server-side only) — provider-agnostic: Gemini, Groq & OpenRouter.
// Pilih provider via AI_PROVIDER ('gemini' | 'groq' | 'openrouter'); bila kosong,
// dipilih otomatis dari provider yang punya kunci. Bila provider utama gagal/kena
// rate limit, otomatis dicoba provider lain yang terkonfigurasi (fallback).
// Tanpa kunci sama sekali -> configured:false + pesan ramah (bukan crash/500).
import type { Db } from '@/lib/db/client';
import { buildFeatureContext } from '@/lib/services/aiContext';

export type AiProvider = 'gemini' | 'groq' | 'openrouter';

const PROVIDER_ORDER: AiProvider[] = ['gemini', 'groq', 'openrouter'];

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function groqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

export function openrouterConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

function isConfigured(provider: AiProvider): boolean {
  if (provider === 'gemini') return geminiConfigured();
  if (provider === 'groq') return groqConfigured();
  return openrouterConfigured();
}

/** Provider aktif (default: sesuai urutan prioritas yang punya kunci). */
export function activeProvider(): AiProvider {
  const explicit = (process.env.AI_PROVIDER || '').toLowerCase();
  if (explicit === 'gemini' || explicit === 'groq' || explicit === 'openrouter') return explicit;
  for (const p of PROVIDER_ORDER) if (isConfigured(p)) return p;
  return 'gemini';
}

export function isAiConfigured(): boolean {
  return PROVIDER_ORDER.some(isConfigured);
}

export interface GenerateResult {
  text: string;
  configured: boolean;
  error?: string;
  provider?: AiProvider;
}

interface ProviderResult {
  ok: boolean;
  text?: string;
  error?: string;
  /** True bila error bersifat sementara (rate limit / server sibuk) -> layak fallback. */
  retryable?: boolean;
}

async function callGemini(
  prompt: string,
  opts: { maxOutputTokens?: number; temperature?: number }
): Promise<ProviderResult> {
  // `gemini-flash-latest` otomatis menunjuk ke model Flash terbaru, sehingga
  // tidak "mati" ketika Google menghentikan versi lama (mis. gemini-2.0-flash).
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: opts.maxOutputTokens ?? 600,
          temperature: opts.temperature ?? 0.4,
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const retryable = res.status === 429 || res.status >= 500;
      return {
        ok: false,
        error: `Gemini error ${res.status}`,
        retryable,
        text: `Maaf, analisis AI gagal (status ${res.status}). ${String(detail).slice(0, 200)}`,
      };
    }
    const json: any = await res.json();
    const text: string =
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
    return { ok: true, text: text || 'Tidak ada keluaran dari model.' };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'network', retryable: true, text: 'Maaf, gagal menghubungi layanan AI.' };
  }
}

async function callGroq(
  prompt: string,
  opts: { maxOutputTokens?: number; temperature?: number }
): Promise<ProviderResult> {
  // Groq memakai API bergaya OpenAI. Model default: openai/gpt-oss-120b
  // (model chat aktif di Groq; nama model Groq sering berganti — cek
  // https://console.groq.com/docs/models bila terjadi error 404/model_not_found).
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: opts.maxOutputTokens ?? 600,
        temperature: opts.temperature ?? 0.4,
        // Model reasoning (gpt-oss, qwen3) bisa menaruh proses berpikir di
        // `reasoning_content`. Minta Groq mengirim reasoning terpisah agar
        // `content` tetap berisi jawaban akhir yang bersih.
        reasoning_format: 'parsed',
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const retryable = res.status === 429 || res.status >= 500;
      return {
        ok: false,
        error: `Groq error ${res.status}`,
        retryable,
        text: `Maaf, analisis AI gagal (status ${res.status}). ${String(detail).slice(0, 200)}`,
      };
    }
    const json: any = await res.json();
    const msg = json?.choices?.[0]?.message ?? {};
    // Prioritaskan `content` (jawaban akhir). Bila kosong (mis. model reasoning
    // menaruh segalanya di field reasoning), pakai `reasoning`/`reasoning_content`
    // sebagai cadangan. Groq gpt-oss memakai `reasoning`; sebagian model lain
    // memakai `reasoning_content`.
    const text: string =
      String(msg.content ?? '').trim() ||
      String(msg.reasoning ?? '').trim() ||
      String(msg.reasoning_content ?? '').trim();
    return { ok: true, text: text || 'Tidak ada keluaran dari model.' };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'network', retryable: true, text: 'Maaf, gagal menghubungi layanan AI.' };
  }
}

async function callOpenRouter(
  prompt: string,
  opts: { maxOutputTokens?: number; temperature?: number }
): Promise<ProviderResult> {
  // OpenRouter juga memakai API bergaya OpenAI. Model default: qwen/qwen3.8-27b:free.
  // Daftar model: https://openrouter.ai/models?max_price=0
  const model = process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-27b:free';
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        // Header opsional yang direkomendasikan OpenRouter (atribusi app).
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://e-performiq.vercel.app',
        'X-Title': 'E-PerformIQ',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: opts.maxOutputTokens ?? 600,
        temperature: opts.temperature ?? 0.4,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const retryable = res.status === 429 || res.status >= 500;
      return {
        ok: false,
        error: `OpenRouter error ${res.status}`,
        retryable,
        text: `Maaf, analisis AI gagal (status ${res.status}). ${String(detail).slice(0, 200)}`,
      };
    }
    const json: any = await res.json();
    const msg = json?.choices?.[0]?.message ?? {};
    // Sama seperti Groq: prioritaskan `content`, fallback ke field reasoning.
    const text: string =
      String(msg.content ?? '').trim() ||
      String(msg.reasoning ?? '').trim() ||
      String(msg.reasoning_content ?? '').trim();
    return { ok: true, text: text || 'Tidak ada keluaran dari model.' };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'network', retryable: true, text: 'Maaf, gagal menghubungi layanan AI.' };
  }
}

async function callProvider(
  provider: AiProvider,
  prompt: string,
  opts: { maxOutputTokens?: number; temperature?: number }
): Promise<ProviderResult> {
  if (provider === 'groq') return callGroq(prompt, opts);
  if (provider === 'openrouter') return callOpenRouter(prompt, opts);
  return callGemini(prompt, opts);
}

export async function generateContent(
  prompt: string,
  opts: { maxOutputTokens?: number; temperature?: number } = {}
): Promise<GenerateResult> {
  if (!isAiConfigured()) {
    return {
      configured: false,
      text:
        'AI belum dikonfigurasi. Set GEMINI_API_KEY, GROQ_API_KEY, atau OPENROUTER_API_KEY ' +
        'pada environment server untuk mengaktifkan analisis AI.',
    };
  }

  const primary = activeProvider();
  const first = await callProvider(primary, prompt, opts);
  if (first.ok) {
    return { configured: true, text: first.text as string, provider: primary };
  }

  // Fallback berantai: coba provider lain yang terkonfigurasi bila error
  // bersifat sementara (rate limit / server sibuk / network).
  if (first.retryable) {
    const others = PROVIDER_ORDER.filter((p) => p !== primary && isConfigured(p));
    for (const p of others) {
      const r = await callProvider(p, prompt, opts);
      if (r.ok) {
        return { configured: true, text: r.text as string, provider: p };
      }
    }
  }

  return {
    configured: true,
    error: first.error,
    provider: primary,
    text: first.text ?? 'Maaf, analisis AI sedang tidak tersedia. Coba lagi nanti.',
  };
}


const ROLE_HINT: Record<string, string> = {
  BOD: 'Dewan Direksi (fokus strategis & GCG)',
  HR_MANAGER: 'HR Manager (fokus lifecycle SDM)',
  PEOPLE_MANAGER: 'People Manager (fokus tim langsung)',
  EMPLOYEE: 'Karyawan (fokus pengembangan diri)',
  AUDITOR: 'Auditor Internal (fokus kepatuhan)',
};

/** Analisis AI untuk satu fitur, memakai ringkasan data nyata dari DB. */
export async function analyzeFeature(
  db: Db,
  feature: string,
  role: string
): Promise<{ insight: string; configured: boolean }> {
  const context = await buildFeatureContext(db, feature);
  const prompt =
    `Anda analis SDM korporat untuk aplikasi E-PerformIQ. Peran pengguna: ${ROLE_HINT[role] ?? role}.\n` +
    `Fitur: ${feature}. Ringkasan data (JSON):\n${JSON.stringify(context)}\n\n` +
    `Berikan: (1) Ringkasan singkat 2 kalimat tentang kondisi saat ini, ` +
    `(2) Tiga temuan penting, (3) Dua rekomendasi tindakan. ` +
    `Gunakan hanya data pada ringkasan di atas; jangan mengarang angka. Bahasa Indonesia, ringkas.`;
  const res = await generateContent(prompt, { maxOutputTokens: 500, temperature: 0.4 });
  return { insight: res.text, configured: res.configured };
}

/** Chat agent: menjawab pertanyaan seputar aplikasi dengan konteks agregat. */
export async function chat(
  db: Db,
  messages: { role: 'user' | 'model'; content: string }[],
  role: string
): Promise<{ reply: string; configured: boolean }> {
  const context = await buildFeatureContext(db, 'executive');
  const history = messages.map((m) => `${m.role === 'user' ? 'Pengguna' : 'Asisten'}: ${m.content}`).join('\n');
  const prompt =
    `Anda agen AI untuk aplikasi E-PerformIQ (manajemen kinerja & lifecycle karyawan). ` +
    `Peran pengguna: ${ROLE_HINT[role] ?? role}. Konteks data aplikasi (JSON): ${JSON.stringify(context)}.\n` +
    `Percakapan:\n${history}\nAsisten:` +
    `\nJawab singkat, akurat, dan hanya berdasarkan konteks aplikasi. Bahasa Indonesia.`;
  const res = await generateContent(prompt, { maxOutputTokens: 500, temperature: 0.5 });
  return { reply: res.text, configured: res.configured };
}
