// Gemini AI service (server-side only). Memanggil REST generativelanguage tanpa SDK.
// Tanpa GEMINI_API_KEY -> configured:false + pesan ramah (bukan crash/500).

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
