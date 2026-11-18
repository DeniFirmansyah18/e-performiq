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
    { pillarId: 'pillar-1', perspective: 'FINANCIAL', pillarName: 'Pertumbuhan Pendapatan', weight: 25 },
    { pillarId: 'pillar-2', perspective: 'CUSTOMER', pillarName: 'Kepuasan Stakeholder', weight: 25 },
    { pillarId: 'pillar-3', perspective: 'INTERNAL_PROCESS', pillarName: 'Keunggulan Operasional', weight: 25 },
    { pillarId: 'pillar-4', perspective: 'LEARNING_GROWTH', pillarName: 'Kapabilitas Human Capital', weight: 25 },
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

  it('menggunakan nama dan alasan sederhana tanpa mengubah identitas pilar', () => {
    const expected: Record<string, [string, string]> = {
      FINANCIAL: [
        'Pertumbuhan Pendapatan dan Penggunaan Anggaran yang Hemat',
        'Mengukur pertumbuhan pendapatan dan penggunaan anggaran yang hemat.',
      ],
      CUSTOMER: [
        'Pelayanan yang Memuaskan',
        'Mengukur apakah pengguna layanan merasa puas.',
      ],
      INTERNAL_PROCESS: [
        'Proses Kerja Tertib dan Andal',
        'Mengukur apakah pekerjaan selesai dengan tertib dan sesuai aturan.',
      ],
      LEARNING_GROWTH: [
        'Kemampuan dan Budaya Kerja Karyawan',
        'Mengukur peningkatan kemampuan dan budaya kerja karyawan.',
      ],
    };

    for (const [index, pilar] of Array.from(CTX.pilar.entries())) {
      const [kpi] = fallbackUsulanKpi({ ...CTX, pilar: [pilar] });
      expect(kpi.kpiName).toBe(expected[pilar.perspective][0]);
      expect(kpi.rationale).toBe(expected[pilar.perspective][1]);
      expect(kpi.pillarName).toBe(pilar.pillarName);
      expect(kpi.targetValue).toBe(pilar.perspective === 'FINANCIAL' ? 1_000_000_000 : 95);
      expect(kpi.unitOfMeasure).toBe(pilar.perspective === 'FINANCIAL' ? 'IDR' : '%');
      expect(kpi.weightPct).toBe(100);
      void index;
    }
  });

  it('nama pilar khusus memakai bahasa netral tanpa menyalin istilahnya', () => {
    const custom = {
      pillarId: 'custom',
      perspective: 'CUSTOM',
      pillarName: 'Zero Fatal SLA Compliance',
      weight: 100,
    };
    const [kpi] = fallbackUsulanKpi({ ...CTX, pilar: [custom] });
    expect(kpi.kpiName).toBe('Hasil pada pilar ini');
    expect(kpi.rationale).toBe('Mengukur hasil yang dicapai pada pilar ini.');
    expect(kpi.pillarName).toBe(custom.pillarName);
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
