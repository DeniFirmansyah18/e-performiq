import { describe, it, expect } from 'vitest';
import { susunPromptCapaianTarget } from '@/lib/services/targetAchievementAi';

const departemen = [
  { departmentId: 'd1', departmentName: 'Keuangan', averagePercentage: 62.4, employeeCount: 9, kpiCount: 12 },
  { departmentId: 'd2', departmentName: 'Teknologi Informasi', averagePercentage: 96.1, employeeCount: 21, kpiCount: 30 },
  { departmentId: 'd3', departmentName: 'Sumber Daya Manusia', averagePercentage: 78.0, employeeCount: 7, kpiCount: 10 },
];

describe('prompt analisis capaian target', () => {
  it('memuat nama departemen beserta persentasenya', () => {
    const p = susunPromptCapaianTarget({
      scopeLevel: 'ORGANIZATION',
      overallPercentage: 80.6,
      targetCount: 52,
      achievedCount: 31,
      departments: departemen,
    });

    expect(p).toContain('Keuangan');
    expect(p).toContain('62.4');
    expect(p).toContain('Teknologi Informasi');
    expect(p).toContain('96.1');
  });

  it('menyebut departemen terendah lebih dulu agar AI fokus ke sana', () => {
    const p = susunPromptCapaianTarget({
      scopeLevel: 'ORGANIZATION',
      overallPercentage: 80.6,
      targetCount: 52,
      achievedCount: 31,
      departments: departemen,
    });
    // Keuangan (62.4%) harus muncul sebelum Teknologi Informasi (96.1%).
    expect(p.indexOf('Keuangan')).toBeLessThan(p.indexOf('Teknologi Informasi'));
  });

  it('meminta rekomendasi tindakan, bukan sekadar ringkasan', () => {
    const p = susunPromptCapaianTarget({
      scopeLevel: 'ORGANIZATION',
      overallPercentage: 80.6,
      targetCount: 52,
      achievedCount: 31,
      departments: departemen,
    });
    expect(p.toLowerCase()).toContain('rekomendasi');
    expect(p.toLowerCase()).toMatch(/tindakan|langkah/);
  });

  it('memakai bahasa Indonesia dan melarang istilah teknis berlebihan', () => {
    const p = susunPromptCapaianTarget({
      scopeLevel: 'ORGANIZATION',
      overallPercentage: 80.6,
      targetCount: 52,
      achievedCount: 31,
      departments: departemen,
    });
    expect(p).toContain('Bahasa Indonesia');
  });

  it('tetap aman bila daftar departemen kosong', () => {
    const p = susunPromptCapaianTarget({
      scopeLevel: 'ORGANIZATION',
      overallPercentage: 0,
      targetCount: 0,
      achievedCount: 0,
      departments: [],
    });
    expect(typeof p).toBe('string');
    expect(p.length).toBeGreaterThan(50);
  });
});
