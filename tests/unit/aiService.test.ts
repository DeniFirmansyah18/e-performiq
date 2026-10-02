import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('aiService', () => {
  const OLD = process.env;
  beforeEach(() => { vi.resetModules(); process.env = { ...OLD }; delete process.env.AI_PROVIDER; delete process.env.GEMINI_API_KEY; delete process.env.GROQ_API_KEY; delete process.env.OPENROUTER_API_KEY; });
  afterEach(() => { process.env = OLD; vi.restoreAllMocks(); });

  it('isAiConfigured false tanpa kunci apa pun', async () => {
    const { isAiConfigured } = await import('@/lib/services/aiService');
    expect(isAiConfigured()).toBe(false);
  });

  it('generateContent mengembalikan configured:false tanpa kunci (tanpa fetch)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({} as any);
    const { generateContent } = await import('@/lib/services/aiService');
    const r = await generateContent('halo');
    expect(r.configured).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('generateContent memanggil Gemini & mengembalikan teks saat dikonfigurasi', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-flash-latest';
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'insight xyz' }] } }] }),
    } as any);
    const { generateContent } = await import('@/lib/services/aiService');
    const r = await generateContent('halo');
    expect(r.configured).toBe(true);
    expect(r.text).toBe('insight xyz');
    expect(r.provider).toBe('gemini');
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(String(fetchSpy.mock.calls[0][0])).toContain('generativelanguage.googleapis.com');
  });

  it('generateContent menangani error HTTP dengan pesan ramah', async () => {
    process.env.GEMINI_API_KEY = 'bad';
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' } as any);
    const { generateContent } = await import('@/lib/services/aiService');
    const r = await generateContent('halo');
    expect(r.configured).toBe(true);
    expect(r.error).toBeTruthy();
    expect(r.text.length).toBeGreaterThan(0);
  });

  it('memakai Groq bila AI_PROVIDER=groq', async () => {
    process.env.AI_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'gsk-test';
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true, json: async () => ({ choices: [{ message: { content: 'jawaban groq' } }] }),
    } as any);
    const { generateContent } = await import('@/lib/services/aiService');
    const r = await generateContent('halo');
    expect(r.provider).toBe('groq');
    expect(r.text).toBe('jawaban groq');
    expect(String(fetchSpy.mock.calls[0][0])).toContain('api.groq.com');
  });

  it('Groq: fallback ke reasoning_content bila content kosong', async () => {
    process.env.AI_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'gsk-test';
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true, json: async () => ({ choices: [{ message: { content: '', reasoning_content: 'jawaban dari reasoning' } }] }),
    } as any);
    const { generateContent } = await import('@/lib/services/aiService');
    const r = await generateContent('halo');
    expect(r.provider).toBe('groq');
    expect(r.text).toBe('jawaban dari reasoning');
  });

  it('fallback ke Groq saat Gemini kena rate limit (429)', async () => {
    process.env.GEMINI_API_KEY = 'k';
    process.env.GROQ_API_KEY = 'g';
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any)
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'rate limited' } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: 'fallback ok' } }] }) } as any);
    const { generateContent } = await import('@/lib/services/aiService');
    const r = await generateContent('halo');
    expect(r.provider).toBe('groq');
    expect(r.text).toBe('fallback ok');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('activeProvider auto-pilih groq bila hanya GROQ_API_KEY tersedia', async () => {
    process.env.GROQ_API_KEY = 'g';
    const { activeProvider } = await import('@/lib/services/aiService');
    expect(activeProvider()).toBe('groq');
  });

  it('memakai OpenRouter bila AI_PROVIDER=openrouter (qwen3.8 free)', async () => {
    process.env.AI_PROVIDER = 'openrouter';
    process.env.OPENROUTER_API_KEY = 'or-test';
    process.env.OPENROUTER_MODEL = 'qwen/qwen3.8-27b:free';
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true, json: async () => ({ choices: [{ message: { content: 'jawaban openrouter' } }] }),
    } as any);
    const { generateContent } = await import('@/lib/services/aiService');
    const r = await generateContent('halo');
    expect(r.provider).toBe('openrouter');
    expect(r.text).toBe('jawaban openrouter');
    expect(String(fetchSpy.mock.calls[0][0])).toContain('openrouter.ai');
  });

  it('fallback berantai: Gemini 429 -> Groq gagal -> OpenRouter berhasil', async () => {
    process.env.GEMINI_API_KEY = 'g';
    process.env.GROQ_API_KEY = 'q';
    process.env.OPENROUTER_API_KEY = 'o';
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any)
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'limited' } as any)
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'busy' } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: 'dari openrouter' } }] }) } as any);
    const { generateContent } = await import('@/lib/services/aiService');
    const r = await generateContent('halo');
    expect(r.provider).toBe('openrouter');
    expect(r.text).toBe('dari openrouter');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('mengirim system message + menurunkan temperature (konsistensi bahasa)', async () => {
    process.env.AI_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'g';
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    } as any);
    const { generateContent } = await import('@/lib/services/aiService');
    await generateContent('halo');
    const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as any).body));
    expect(body.messages[0].role).toBe('system');
    expect(String(body.messages[0].content)).toContain('Bahasa Indonesia');
    expect(body.temperature).toBeLessThanOrEqual(0.3);
  });

  it('membersihkan blok thinking dari keluaran', async () => {
    process.env.AI_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'g';
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: ' thinkingbla bla <｜end▁of▁thinking｜>**Ringkasan:** Kondisi baik.' } }] }),
    } as any);
    const { generateContent } = await import('@/lib/services/aiService');
    const r = await generateContent('halo');
    expect(r.text).not.toContain('think');
    expect(r.text).toContain('**Ringkasan:**');
  });
});

