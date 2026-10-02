import { describe, it, expect } from 'vitest';
import {
  prorateBase,
  computeOvertimePay,
  computeThr,
  computeBpjs,
  computeAnnualTax,
  computePph21Monthly,
  computePayrollItem,
  computePayrollItem as compute,
  DEFAULT_RATES,
  PPH21_BRACKETS,
} from '@/lib/engines/payroll-engine';

describe('WS-10 payroll engine (deterministik)', () => {
  describe('prorateBase', () => {
    it('full month → gaji penuh', () => {
      expect(prorateBase(10_000_000, 22, 22)).toBe(10_000_000);
    });
    it('pro-rata 11/22 hari → separuh', () => {
      expect(prorateBase(10_000_000, 11, 22)).toBe(5_000_000);
    });
    it('workingDays 0 → gaji penuh (tidak NaN)', () => {
      expect(prorateBase(10_000_000, 0, 0)).toBe(10_000_000);
    });
    it('presentDays > workingDays dibatasi', () => {
      expect(prorateBase(10_000_000, 30, 22)).toBe(10_000_000);
    });
  });

  describe('computeOvertimePay (UU: jam-1 1,5×; sisanya 2×)', () => {
    // upah/jam = 1/173 × 10.000.000 = 57.803,47
    const base = 10_000_000;
    it('0 jam → 0', () => expect(computeOvertimePay(base, 0)).toBe(0));
    it('1 jam → 1,5 × upah/jam', () => {
      expect(computeOvertimePay(base, 1)).toBe(Math.round(1.5 * (base / 173)));
    });
    it('2 jam → 1,5× + 2× = 3,5 × upah/jam', () => {
      expect(computeOvertimePay(base, 2)).toBe(Math.round(3.5 * (base / 173)));
    });
    it('cap 4 jam', () => {
      expect(computeOvertimePay(base, 8)).toBe(computeOvertimePay(base, 4));
    });
  });

  describe('computeThr', () => {
    it('masa kerja ≥ 12 bulan → 1× gaji', () => {
      expect(computeThr(8_000_000, 24)).toBe(8_000_000);
    });
    it('masa kerja 6 bulan → proporsional 0,5×', () => {
      expect(computeThr(8_000_000, 6)).toBe(4_000_000);
    });
  });

  describe('computeBpjs', () => {
    it('potongan karyawan 1% + 2% + 1% dari gaji pokok (di bawah cap)', () => {
      const r = computeBpjs(8_000_000);
      expect(r.kesehatan).toBe(80_000);
      expect(r.jht).toBe(160_000);
      expect(r.jp).toBe(80_000);
      expect(r.totalEmployee).toBe(320_000);
    });
    it('menghormati cap upah kesehatan', () => {
      const r = computeBpjs(20_000_000);
      // 1% × 12.000.000 (cap) = 120.000
      expect(r.kesehatan).toBe(120_000);
    });
    it('kontribusi pemberi kerja > 0', () => {
      const r = computeBpjs(8_000_000);
      expect(r.employer.total).toBeGreaterThan(0);
    });
  });

  describe('computeAnnualTax (progresif)', () => {
    it('PKP 0 → 0', () => expect(computeAnnualTax(0)).toBe(0));
    it('PKP 60jt → 5% = 3jt', () => expect(computeAnnualTax(60_000_000)).toBe(3_000_000));
    it('PKP 100jt → 60jt×5% + 40jt×15% = 3jt + 6jt = 9jt', () => {
      expect(computeAnnualTax(100_000_000)).toBe(9_000_000);
    });
    it('monoton naik', () => {
      expect(computeAnnualTax(200_000_000)).toBeGreaterThan(computeAnnualTax(100_000_000));
    });
  });

  describe('computePph21Monthly', () => {
    it('gaji rendah (di bawah PTKP) → 0', () => {
      expect(computePph21Monthly(4_000_000)).toBe(0);
    });
    it('gaji tinggi → > 0', () => {
      expect(computePph21Monthly(20_000_000)).toBeGreaterThan(0);
    });
    it('deterministik (dua panggilan sama)', () => {
      expect(computePph21Monthly(15_000_000)).toBe(computePph21Monthly(15_000_000));
    });
  });

  describe('computePayrollItem (integrasi)', () => {
    it('contoh lengkap: bruto = pokok + tunjangan + lembur + bonus + THR; net = bruto − potongan', () => {
      const r = compute({
        baseSalary: 10_000_000, fixedAllowance: 2_500_000, overtimeHours: 2, bonus: 1_000_000,
        thr: 10_000_000, presentDays: 22, workingDays: 22,
      });
      expect(r.baseSalary).toBe(10_000_000);
      expect(r.overtimePay).toBe(Math.round(3.5 * (10_000_000 / 173)));
      expect(r.gross).toBe(10_000_000 + 2_500_000 + r.overtimePay + 1_000_000 + 10_000_000);
      expect(r.totalDeductions).toBe(r.bpjs.totalEmployee + r.pph21);
      expect(r.net).toBe(r.gross - r.totalDeductions);
    });

    it('pro-rata: 11 dari 22 hari → pokok separuh', () => {
      const r = compute({ baseSalary: 10_000_000, presentDays: 11, workingDays: 22 });
      expect(r.baseSalary).toBe(5_000_000);
    });

    it('otherEarnings & otherDeductions ikut dihitung', () => {
      const r = compute({
        baseSalary: 8_000_000, presentDays: 22, workingDays: 22,
        otherEarnings: [{ code: 'TRANSPORT', amount: 500_000 }],
        otherDeductions: [{ code: 'PINJAMAN', amount: 300_000 }],
      });
      expect(r.gross).toBe(8_000_000 + 500_000);
      expect(r.totalDeductions).toBe(r.bpjs.totalEmployee + r.pph21 + 300_000);
    });

    it('net tidak pernah NaN', () => {
      const r = compute({ baseSalary: 0, presentDays: 0, workingDays: 22 });
      expect(Number.isFinite(r.net)).toBe(true);
    });
  });

  it('DEFAULT_RATES sesuai tarif indikatif', () => {
    expect(DEFAULT_RATES.bpjsKesehatanRate).toBe(0.01);
    expect(DEFAULT_RATES.employerJhtRate).toBeCloseTo(0.037, 4);
    expect(PPH21_BRACKETS[0].rate).toBe(0.05);
  });
});
