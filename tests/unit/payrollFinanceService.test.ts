import { describe, it, expect } from 'vitest';
import { calculateCostOfWorkforce } from '@/lib/services/payrollFinanceService';

describe('Kotak 5: Payroll & Workforce ROI Engine', () => {
  it('menghitung rasio efisiensi biaya tenaga kerja (TCOW) terhadap output target', () => {
    const result = calculateCostOfWorkforce({
      totalPayrollIDR: 150_000_000,
      totalClaimsIDR: 12_000_000,
      totalOutputValueIDR: 450_000_000,
    });
    // Rasio pengeluaran SDM terhadap output bisnis
    expect(result.tcowRatio).toBeCloseTo(0.36, 2);
    expect(result.roiMultiplier).toBeGreaterThan(2.0);
  });
});
