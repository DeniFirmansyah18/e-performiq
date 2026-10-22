import { describe, it, expect } from 'vitest';
import { computeOvertimePay, computeOvertimePaySplit } from '@/lib/engines/payroll-engine';

const BASE = 10_000_000;
const HOURLY = BASE / 173;

describe('computeOvertimePay — hari kerja', () => {
  it('0 jam → 0', () => {
    expect(computeOvertimePay(BASE, 0)).toBe(0);
  });

  it('1 jam → 1,5× upah/jam', () => {
    expect(computeOvertimePay(BASE, 1)).toBe(Math.round(1.5 * HOURLY));
  });

  it('2 jam → 1,5× + 2×', () => {
    expect(computeOvertimePay(BASE, 2)).toBe(Math.round(3.5 * HOURLY));
  });

  it('dibatasi 4 jam per hari', () => {
    expect(computeOvertimePay(BASE, 8)).toBe(computeOvertimePay(BASE, 4));
  });

  it('default tetap WORKDAY saat dayType tidak diberikan', () => {
    expect(computeOvertimePay(BASE, 2)).toBe(computeOvertimePay(BASE, 2, 'WORKDAY'));
  });
});

describe('computeOvertimePay — hari libur/istirahat (2×/3×/4×)', () => {
  it('1 jam → 2× upah/jam', () => {
    expect(computeOvertimePay(BASE, 1, 'REST_DAY')).toBe(Math.round(2 * HOURLY));
  });

  it('7 jam → 7 × 2×', () => {
    expect(computeOvertimePay(BASE, 7, 'REST_DAY')).toBe(Math.round(14 * HOURLY));
  });

  it('8 jam → 7×2× + 1×3×', () => {
    expect(computeOvertimePay(BASE, 8, 'REST_DAY')).toBe(Math.round(17 * HOURLY));
  });

  it('9 jam → 7×2× + 1×3× + 1×4×', () => {
    expect(computeOvertimePay(BASE, 9, 'REST_DAY')).toBe(Math.round(21 * HOURLY));
  });

  it('10 jam → 7×2× + 1×3× + 2×4×', () => {
    expect(computeOvertimePay(BASE, 10, 'REST_DAY')).toBe(Math.round(25 * HOURLY));
  });

  it('dibatasi 10 jam per hari libur', () => {
    expect(computeOvertimePay(BASE, 20, 'REST_DAY')).toBe(computeOvertimePay(BASE, 10, 'REST_DAY'));
  });

  it('hari libur selalu lebih mahal dari hari kerja untuk jam yang sama', () => {
    for (const h of [1, 2, 4, 7, 8]) {
      expect(computeOvertimePay(BASE, h, 'REST_DAY')).toBeGreaterThan(computeOvertimePay(BASE, h, 'WORKDAY'));
    }
  });
});

describe('computeOvertimePaySplit', () => {
  it('menjumlahkan komponen hari kerja dan hari libur', () => {
    const split = computeOvertimePaySplit(BASE, { workdayHours: 2, restDayHours: 8 });
    expect(split).toBe(
      computeOvertimePay(BASE, 2, 'WORKDAY') + computeOvertimePay(BASE, 8, 'REST_DAY'),
    );
  });

  it('tanpa jam → 0', () => {
    expect(computeOvertimePaySplit(BASE, { workdayHours: 0, restDayHours: 0 })).toBe(0);
  });
});
