import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('aiService', () => {
  const OLD = process.env;
  beforeEach(() => { vi.resetModules(); process.env = { ...OLD }; });
  afterEach(() => { process.env = OLD; vi.restoreAllMocks(); });

  it('isAiConfigured false tanpa GEMINI_API_KEY', async () => {
    delete process.env.GEMINI_API_KEY;
    const { isAiConfigured } = await import('@/lib/services/aiService');
    expect(isAiConfigured()).toBe(false);
  });

  it('generateContent mengembalikan configured:false tanpa kunci (tanpa fetch)', async () => {
    delete process.env.GEMINI_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({} as any);
    const { generateContent } = await import('@/lib/services/aiService');
    const r = await generateContent('halo');
    expect(r.configured).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('generateContent memanggil Gemini & mengembalikan teks saat dikonfigurasi', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'insight xyz' }] } }] }),
    } as any);
    const { generateContent } = await import('@/lib/services/aiService');
    const r = await generateContent('halo');
    expect(r.configured).toBe(true);
    expect(r.text).toBe('insight xyz');
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
});
