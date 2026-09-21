# Implementation Plan — Bagian 3: Services, Routes & UI

> Lanjutan dari `2026-09-21-eperformiq-part2-auth-data.md`.
> **Untuk agen pelaksana:** gunakan superpowers:subagent-driven-development atau superpowers:executing-plans.
> Prasyarat: Task 1–9 selesai dan seluruh tesnya hijau.

---

### Task 10: Bersihkan Engine dan Tambah Helper Masa Kerja

**Files:**
- Modify: `src/lib/engines/vmai-engine.ts`
- Modify: `src/lib/engines/severance-engine.ts`
- Create: `tests/unit/engines.test.ts`

**Interfaces:**
- Consumes: tidak ada (engine wajib tetap murni)
- Produces:
  - `calculateVMAI(pillars, gcgComplianceFactor?): VMAIScorecard` — tanpa angka hardcoded
  - `calculateServiceYears(joinDate: string | Date, endDate: string | Date): number`
  - `calculateCompositeGPA`, `determineNineBox`, `calculateSeverance` — tidak berubah

- [ ] **Step 1: Tulis tes yang gagal**

`tests/unit/engines.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calculateVMAI } from '@/lib/engines/vmai-engine';
import { calculateServiceYears, calculateSeverance } from '@/lib/engines/severance-engine';
import { calculateCompositeGPA } from '@/lib/engines/gpa-engine';
import type { StrategicPillar } from '@/types';

const pillar = (
  perspective: StrategicPillar['perspective'],
  achieved: number,
  weight = 25
): StrategicPillar => ({
  id: `p-${perspective}`, perspective, pillarName: perspective,
  description: '', strategicWeight: weight, achievedScore: achieved, targetScore: 100,
});

describe('VMAI engine', () => {
  it('menghitung rata-rata terbobot dari pilar, tanpa angka hardcoded', () => {
    const result = calculateVMAI([
      pillar('FINANCIAL', 90), pillar('CUSTOMER', 80),
      pillar('INTERNAL_PROCESS', 70), pillar('LEARNING_GROWTH', 60),
    ]);
    // (25*90 + 25*80 + 25*70 + 25*60) / 100 = 75
    expect(result.overallVMAI).toBeCloseTo(75, 2);
  });

  it('mengembalikan nol untuk daftar pilar kosong, bukan angka palsu', () => {
    // Bug lama: engine menyisipkan 92.4/87.1/94.8/83.3 sehingga
    // daftar kosong tetap menghasilkan 89.4.
    expect(calculateVMAI([]).overallVMAI).toBe(0);
  });

  it('menerapkan GCG compliance factor sebagai pengali', () => {
    const pillars = [pillar('FINANCIAL', 100), pillar('CUSTOMER', 100),
                     pillar('INTERNAL_PROCESS', 100), pillar('LEARNING_GROWTH', 100)];
    expect(calculateVMAI(pillars, 0.8).overallVMAI).toBeCloseTo(80, 2);
  });

  it('memetakan skor tiap perspektif ke field yang benar', () => {
    const r = calculateVMAI([
      pillar('FINANCIAL', 90), pillar('CUSTOMER', 80),
      pillar('INTERNAL_PROCESS', 70), pillar('LEARNING_GROWTH', 60),
    ]);
    expect(r.perspectives.financial.score).toBe(90);
    expect(r.perspectives.customer.score).toBe(80);
    expect(r.perspectives.internalProcess.score).toBe(70);
    expect(r.perspectives.learningGrowth.score).toBe(60);
  });

  it('mengklasifikasikan status sesuai ambang PRD §4.2', () => {
    expect(calculateVMAI([pillar('FINANCIAL', 96)]).alignmentStatus).toBe('EXCEPTIONAL');
    expect(calculateVMAI([pillar('FINANCIAL', 90)]).alignmentStatus).toBe('ALIGNED');
    expect(calculateVMAI([pillar('FINANCIAL', 75)]).alignmentStatus).toBe('SUB_STANDARD');
    expect(calculateVMAI([pillar('FINANCIAL', 50)]).alignmentStatus).toBe('CRITICAL');
  });
});

describe('service years', () => {
  it('menghitung tahun penuh dari dua tanggal', () => {
    expect(calculateServiceYears('2020-02-01', '2026-09-21')).toBe(6);
  });

  it('tidak membulatkan ke atas sebelum tanggal ulang tahun', () => {
    expect(calculateServiceYears('2020-10-01', '2026-09-21')).toBe(5);
  });

  it('menerima objek Date', () => {
    expect(calculateServiceYears(new Date('2024-01-01'), new Date('2026-01-01'))).toBe(2);
  });

  it('mengembalikan 0 untuk tanggal akhir sebelum tanggal mulai', () => {
    expect(calculateServiceYears('2026-01-01', '2025-01-01')).toBe(0);
  });

  it('menghasilkan 0 tahun untuk masa kerja di bawah satu tahun', () => {
    expect(calculateServiceYears('2026-01-01', '2026-06-01')).toBe(0);
  });
});

describe('GPA engine (regresi)', () => {
  it('menghitung 91.70% dan GPA 3.67 untuk input PRD §11.3', () => {
    const r = calculateCompositeGPA({
      kpiScore: 92.5, sopScore: 96, competencyScore: 85,
      coreValuesScore: 90, potentialScore: 3.8,
    });
    expect(r.totalPercentage).toBeCloseTo(91.7, 2);
    expect(r.compositeGPA).toBeCloseTo(3.67, 2);
    expect(r.rating).toBe('A');
  });

  it('menghasilkan 0 untuk seluruh skor nol', () => {
    const r = calculateCompositeGPA({
      kpiScore: 0, sopScore: 0, competencyScore: 0, coreValuesScore: 0,
    });
    expect(r.totalPercentage).toBe(0);
    expect(r.compositeGPA).toBe(0);
  });
});

describe('severance engine (regresi PP 35/2021)', () => {
  it('memberi 1 bulan UP untuk masa kerja kurang dari 1 tahun', () => {
    const r = calculateSeverance({
      serviceYears: 0, baseSalary: 10000000, reasonType: 'EFFICIENCY',
    });
    expect(r.severancePay).toBe(10000000);
  });

  it('tidak memberi UP untuk resign sukarela', () => {
    const r = calculateSeverance({
      serviceYears: 6, baseSalary: 10000000, reasonType: 'RESIGNATION',
    });
    expect(r.severancePay).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan tes untuk memastikan gagal**

```bash
npx vitest run tests/unit/engines.test.ts
```

Diharapkan: GAGAL pada `calculateServiceYears is not a function` dan pada `mengembalikan nol untuk daftar pilar kosong` (karena bug angka hardcoded).

- [ ] **Step 3: Bersihkan `vmai-engine.ts`**

Ganti isi `calculateVMAI` menjadi perhitungan penuh tanpa angka literal. Buang objek `perspectives` yang berisi `92.4`, `87.1`, `94.8`, `83.3`:

```ts
// GANTI seluruh blok `const perspectives = {...}` dan forEach di bawahnya
// dengan versi ini:
const PERSPECTIVE_KEY = {
  FINANCIAL: 'financial',
  CUSTOMER: 'customer',
  INTERNAL_PROCESS: 'internalProcess',
  LEARNING_GROWTH: 'learningGrowth',
} as const;

const perspectives = {
  financial: { score: 0, status: 'NO_DATA', driver: 'Belum ada pilar Financial' },
  customer: { score: 0, status: 'NO_DATA', driver: 'Belum ada pilar Customer' },
  internalProcess: { score: 0, status: 'NO_DATA', driver: 'Belum ada pilar Internal Process' },
  learningGrowth: { score: 0, status: 'NO_DATA', driver: 'Belum ada pilar Learning & Growth' },
};

pillars.forEach((p) => {
  const ratio = p.targetScore > 0 ? p.achievedScore / p.targetScore : 0;
  weightedScoreSum += p.strategicWeight * ratio * 100;
  totalWeights += p.strategicWeight;

  const key = PERSPECTIVE_KEY[p.perspective];
  const normal