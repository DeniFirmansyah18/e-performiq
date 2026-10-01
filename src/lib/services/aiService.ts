// Gemini AI service (server-side only). Memanggil REST generativelanguage tanpa SDK.
// Tanpa GEMINI_API_KEY -> configured:false + pesan ramah (bukan crash/500).
import type { Db } from '@/lib/db/client';
import { buildFeatureContext } from '@/lib/services/aiContext';

export function isAiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export interface GenerateResult {
  text: string;
  configured: boolean;
  error?: string;
}

export async function generateContent(
  prompt: string,
  opts: { maxOutputTokens?: number; temperature?: number } = {}
): Promise<GenerateResult> {
  if (!isAiConfigured()) {
    return {
      configured: false,
      text: 'AI belum dikonfigurasi. Set GEMINI_API_KEY untuk mengaktifkan analisis AI.',
    };
  }
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
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
      return {
        configured: true,
        error: `Gemini error ${res.status}`,
        text: `Maaf, analisis AI gagal (status ${res.status}). ${String(detail).slice(0, 200)}`,
      };
    }
    const json: any = await res.json();
    const text: string =
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
    return { configured: true, text: text || 'Tidak ada keluaran dari model.' };
  } catch (e: any) {
    return { configured: true, error: e?.message ?? 'network', text: 'Maaf, gagal menghubungi layanan AI.' };
  }
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
