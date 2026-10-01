// AI service (server-side only) — provider-agnostic: Gemini & Groq.
// Pilih provider via AI_PROVIDER ('gemini' | 'groq'); bila kosong, dipilih
// otomatis dari provider yang punya kunci. Bila provider utama gagal/kena rate
// limit, otomatis dicoba provider lain yang terkonfigurasi (fallback).
// Tanpa kunci sama sekali -> configured:false + pesan ramah (bukan crash/500).
import type { Db } from '@/lib/db/client';
import { buildFeatureContext } from '@/lib/services/aiContext';

export type AiProvider = 'gemini' | 'groq';

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function groqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

/** Provider aktif (default: gemini bila ada kunci, else groq). */
export function activeProvider(): AiProvider {
  const explicit = (process.env.AI_PROVIDER || '').toLowerCase();
  if (explicit === 'groq') return 'groq';
  if (explicit === 'gemini') return 'gemini';
  if (geminiConfigured()) return 'gemini';
  if (groqConfigured()) return 'groq';
  return 'gemini';
}

export function isAiConfigured(): boolean {
  return geminiConfigured() || groqConfigured();
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
  // Groq memakai API bergaya OpenAI. Model default: Llama 3.3 70B (penalaran terbaik di Groq).
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
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
    const text: string = json?.choices?.[0]?.message?.content ?? '';
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
  return provider === 'groq' ? callGroq(prompt, opts) : callGemini(prompt, opts);
}

export async function generateContent(
  prompt: string,
  opts: { maxOutputTokens?: number; temperature?: number } = {}
): Promise<GenerateResult> {
  if (!isAiConfigured()) {
    return {
      configured: false,
      text:
        'AI belum dikonfigurasi. Set GEMINI_API_KEY (atau GROQ_API_KEY dengan AI_PROVIDER=groq) ' +
        'pada environment server untuk mengaktifkan analisis AI.',
    };
  }

  const primary = activeProvider();
  const first = await callProvider(primary, prompt, opts);
  if (first.ok) {
    return { configured: true, text: first.text as string, provider: primary };
  }

  // Fallback: coba provider lain bila error bersifat sementara (rate limit/server).
  const alternate: AiProvider = primary === 'gemini' ? 'groq' : 'gemini';
  const alternateAvailable = alternate === 'groq' ? groqConfigured() : geminiConfigured();
  if (first.retryable && alternateAvailable) {
    const second = await callProvider(alternate, prompt, opts);
    if (second.ok) {
      return { configured: true, text: second.text as string, provider: alternate };
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
