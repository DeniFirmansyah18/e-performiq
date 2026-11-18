import { describe, it, expect, vi } from 'vitest';

const ai = vi.hoisted(() => ({
  isAiConfigured: vi.fn(() => true),
  generateContent: vi.fn(async () => ({
    text: JSON.stringify([
      { kpiName: 'Pelayanan pengguna', pillarName: 'Kepuasan Stakeholder', targetValue: 95, unitOfMeasure: '%', weightPct: 100, rationale: 'Mengukur kepuasan pengguna layanan.' },
    ]),
  })),
}));

vi.mock('@/lib/services/aiService', () => ai);

import { usulkanKpiDariVisiMisi } from '@/lib/services/kpiGeneratorAiService';

describe('prompt generator KPI', () => {
  it('meminta bahasa Indonesia umum tanpa jargon untuk nama dan alasan', async () => {
    await usulkanKpiDariVisiMisi({
      vision: 'Visi',
      mission: 'Misi',
      pilar: [{ pillarId: 'p1', perspective: 'CUSTOMER', pillarName: 'Kepuasan Stakeholder', weight: 100 }],
    });

    const calls = ai.generateContent.mock.calls as unknown as Array<[string]>;
    const prompt = String(calls[0]?.[0] ?? '');
    expect(prompt).toMatch(/bahasa Indonesia yang sederhana/i);
    expect(prompt).toMatch(/tanpa jargon/i);
    expect(prompt).toMatch(/istilah asing yang tidak perlu/i);
    expect(prompt).toMatch(/mudah dipahami masyarakat umum/i);
    expect(prompt).toMatch(/nama KPI dan alasan/i);
    expect(prompt).toMatch(/nama pilar.*persis sama/i);
  });
});
