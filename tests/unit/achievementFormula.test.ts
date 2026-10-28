import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ACHIEVEMENT_FORMULA_VERSION,
  overallAchievement,
  measuredAchievement,
  measurementCoverage,
  measuredWeightOf,
  totalWeightOf,
  statusOf,
  type PillarMeasurement,
} from '@/lib/strategy/achievementFormula';

/** Data acuan: 3 pilar terukur + 1 pilar belum dinilai (25% bobot). */
const SEED_PILLARS: PillarMeasurement[] = [
  { weight: 25, achievement: 92.5, measured: true },
  { weight: 25, achievement: 102.5, measured: true },
  { weight: 25, achievement: 83.3, measured: true },
  { weight: 25, achievement: 0, measured: false },
];

describe('Rumus capaian RJMP (ADR 021)', () => {
  it('menghitung capaian resmi dari seluruh pilar, termasuk yang belum dinilai', () => {
    // (92.5+102.5+83.3+0)*25 / 100 = 69.575 -> 69.6
    expect(overallAchievement(SEED_PILLARS)).toBe(69.6);
  });

  it('tidak menormalisasi ulang pilar belum dinilai', () => {
    const tanpaPilarKosong = overallAchievement(
      SEED_PILLARS.filter((p) => p.measured)
    );
    // Bila renormalisasi dipakai, hasilnya 92.8 — itu yang DILARANG.
    expect(tanpaPilarKosong).toBe(92.8);
    expect(overallAchievement(SEED_PILLARS)).not.toBe(tanpaPilarKosong);
    expect(overallAchievement(SEED_PILLARS)).toBeLessThan(tanpaPilarKosong);
  });

  it('memisahkan capaian terukur, cakupan, dan bobot', () => {
    expect(measuredAchievement(SEED_PILLARS)).toBe(92.8);
    expect(measurementCoverage(SEED_PILLARS)).toBe(75);
    expect(measuredWeightOf(SEED_PILLARS)).toBe(75);
    expect(totalWeightOf(SEED_PILLARS)).toBe(100);
  });

  it('menyamakan capaian resmi dan terukur saat semua pilar terukur', () => {
    const semua = SEED_PILLARS.map((p) => ({ ...p, measured: true }));
    expect(measurementCoverage(semua)).toBe(100);
    expect(overallAchievement(semua)).toBe(measuredAchievement(semua));
  });

  it('aman terhadap pembagi nol dan nilai tidak hingga (tanpa NaN)', () => {
    expect(overallAchievement([])).toBe(0);
    expect(measuredAchievement([])).toBe(0);
    expect(measurementCoverage([])).toBe(0);
    expect(totalWeightOf([])).toBe(0);

    const noWeight = [{ weight: 0, achievement: 100, measured: true }];
    expect(overallAchievement(noWeight)).toBe(0);
    expect(measurementCoverage(noWeight)).toBe(0);

    const notFinite = [{ weight: 100, achievement: Number.NaN, measured: true }];
    expect(overallAchievement(notFinite)).toBe(0);
    expect(Number.isFinite(measuredAchievement(notFinite))).toBe(true);
  });

  it('tidak pernah melaporkan cakupan di atas 100%', () => {
    const aneh = [
      { weight: 150, achievement: 100, measured: true },
      { weight: 150, achievement: 100, measured: true },
    ];
    expect(measurementCoverage(aneh)).toBeLessThanOrEqual(100);
  });

  it('membedakan belum dinilai dari di bawah target', () => {
    expect(statusOf(0, false)).toBe('NO_DATA');
    expect(statusOf(0, true)).toBe('BELOW_TARGET');
    expect(statusOf(Number.NaN, true)).toBe('NO_DATA');
    expect(statusOf(100, true)).toBe('ACHIEVED');
    expect(statusOf(99.9, true)).toBe('BELOW_TARGET');
  });
});

describe('Penguncian rumus ke dokumen (ADR 021)', () => {
  const adrPath = resolve(process.cwd(), 'docs/decisions/021-rjmp-achievement-formula-lock.md');

  it('ADR 021 ada dan memuat versi rumus yang sama dengan kode', () => {
    const adr = readFileSync(adrPath, 'utf8');
    expect(adr).toContain(ACHIEVEMENT_FORMULA_VERSION);
  });

  it('ADR 021 melarang renormalisasi secara eksplisit', () => {
    const adr = readFileSync(adrPath, 'utf8');
    expect(adr).toMatch(/renormalisasi/i);
    expect(adr).toMatch(/tidak\s+\*\*?dikeluarkan\*\*?|tidak[^\n]*dikeluarkan dari penyebut/i);
  });

  it('ADR 021 memuat aturan dua periode dan register cascade', () => {
    const adr = readFileSync(adrPath, 'utf8');
    expect(adr).toContain('UNMEASURED_CONSECUTIVE_PERIODS');
    expect(adr).toMatch(/cascade/i);
  });
});