import { describe, it, expect } from 'vitest';
import {
  normalkanBobot,
  fallbackUsulanKpi,
  usulkanKpiDariVisiMisi,
  type KonteksPerusahaan,
} from '@/lib/services/kpiGeneratorAiService';

const CTX: KonteksPerusahaan = {
  vision: 'Menjadi perusahaan kelas dunia dengan tata kelola unggul.',
  mission: 'Membangun ekosistem kinerja terintegrasi | Mengembangkan talenta',
  pilar: [
    { perspective: 'FINANCIAL', pillarName: 'Pertumbuhan Pendapatan', weight: 25 },
    { perspective: 'CUSTOMER', pillarName: 'Kepuasan Stakeholder', weight: 25 },
    { perspective: 'INTERNAL_PROCESS', pillarName: 'Keunggulan Operasional', weight: 25 },
    { perspective: 'LEARNING_GROWTH', pillarName: 'Kapabilitas Human Capital', weight: 25 },
  ],
};

describe('normalisasi bobot KPI', () => {
  it('memperbaiki bobot yang totalnya 99 atau 101 menjadi tepat 100', () => {
    expect(normalkanBobot([30, 30, 30, 9]).reduce((a, b) => a + b, 0)).toBe(100);
    expect(normalkanBobot([30, 30, 30, 11]).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('membagi rata bila seluruh bobot tidak sah', () => {
    const r = normalkanBobot([0, 0, 0, 0]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(100);
    expect(r.every((x) => x > 0)).toBe(true);
  });

  it('tidak pernah menghasilkan bobot 0 atau negatif', () => {
    const r = normalkanBobot([90, 9, 1, 0]);
    expect(r.every((x) => x >= 1)).toBe(true);
    expect(r.reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe('fallback usulan KPI dari pilar strategis', () => {
  it('menghasilkan satu KPI per pilar dengan bobot total 100', () => {
    const kpis = fallbackUsulanKpi(CTX);
    expect(kpis.length).toBe(CTX.pilar.length);
    expect(kpis.reduce((a, k) => a + k.weightPct, 0)).toBe(100);
  });

  it('setiap KPI menyebut pilar yang benar-benar ada', () => {
    const nama = new Set(CTX.pilar.map((p) => p.pillarName));
    for (const k of fallbackUsulanKpi(CTX)) expect(nama.has(k.pillarName)).toBe(true);
  });

  it('target positif dan satuan wajar', () => {
    for (const k of fallbackUsulanKpi(CTX)) {
      expect(k.targetValue).toBeGreaterThan(0);
      expect(['%', 'IDR', 'UNIT', 'HARI', 'SKOR']).toContain(k.unitOfMeasure);
    }
  });

  it('tanpa pilar → tidak ada usulan', () => {
    expect(fallbackUsulanKpi({ ...CTX, pilar: [] })).toEqual([]);
  });
});

describe('usulkanKpiDariVisiMisi', () => {
  it('menolak bila visi/misi kosong, dengan catatan jelas', async () => {
    const r = await usulkanKpiDariVisiMisi({ ...CTX, vision: '', mission: '' });
    expect(r.kpis).toEqual([]);
    expect(r.catatan).toMatch(/visi & misi/i);
  });

  it('menolak bila belum ada pilar strategis', async () => {
    const r = await usulkanKpiDariVisiMisi({ ...CTX, pilar: [] });
    expect(r.kpis).toEqual([]);
    expect(r.catatan).toMatch(/pilar strategis/i);
  });

  it('selalu memberi usulan nyata (AI atau fallback) bila data lengkap', async () => {
    const r = await usulkanKpiDariVisiMisi(CTX);
    expect(r.kpis.length).toBeGreaterThanOrEqual(3);
    expect(['AI', 'FALLBACK']).toContain(r.sumber);
    expect(r.kpis.reduce((a, k) => a + k.weightPct, 0)).toBe(100);
  });
});
