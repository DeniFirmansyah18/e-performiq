/**
 * Payroll Engine (WS-10) — kalkulasi gaji DETERMINISTIK (tanpa DB, tanpa AI).
 *
 * Komponen:
 *  - Gaji pokok (pro-rata bila hari kerja < sebulan)
 *  - Tunjangan tetap
 *  - Lembur (UU Ketenagakerjaan: jam pertama 1,5× upah/jam; jam berikutnya 2×)
 *  - Bonus & THR (1× gaji pokok)
 *  - Potongan BPJS Kesehatan (1% karyawan), JHT (2%), JP (1%)
 *  - PPh 21 (skema progresif tahunan PPh OP disetahunkan sederhana)
 *
 * Semua tarif diberi sebagai konstanta yang bisa ditimpa (config) agar auditabel.
 * Referensi tarif bersifat indikatif (bukan nasihat pajak); sesuaikan dengan
 * peraturan terbaru. Angka dibulatkan ke rupiah penuh.
 */

export interface PayrollRates {
  // BPJS Ketenagakerjaan & Kesehatan — porsi KARYAWAN.
  bpjsKesehatanRate: number; // 1%
  bpjsJhtRate: number;       // 2%
  bpjsJpRate: number;        // 1%
  // Porsi PEMBERI KERJA (info slip).
  employerKesehatanRate: number; // 4%
  employerJhtRate: number;       // 3.7%
  employerJpRate: number;        // 2%
  employerJkkRate: number;       // 0.24% (contoh risiko rendah)
  employerJkmRate: number;       // 0.3%
  // Batas upah BPJS (opsional; null = tanpa batas).
  bpjsKesehatanCap: number | null;
  bpjsJpCap: number | null;
}

export const DEFAULT_RATES: PayrollRates = {
  bpjsKesehatanRate: 0.01,
  bpjsJhtRate: 0.02,
  bpjsJpRate: 0.01,
  employerKesehatanRate: 0.04,
  employerJhtRate: 0.037,
  employerJpRate: 0.02,
  employerJkkRate: 0.0024,
  employerJkmRate: 0.003,
  bpjsKesehatanCap: 12_000_000,
  bpjsJpCap: 10_042_300,
};

/** Upah sebulan; bila hari kerja < hari standar → pro-rata. */
export function prorateBase(baseSalary: number, presentDays: number, workingDays: number): number {
  if (workingDays <= 0) return round0(baseSalary);
  const p = Math.max(0, Math.min(1, presentDays / workingDays));
  return round0(baseSalary * p);
}

/**
 * Upah lembur per UU Ketenagakerjaan (hari kerja):
 *  - jam ke-1: 1,5 × upah/jam
 *  - jam ke-2 dst: 2 × upah/jam
 * Upah/jam = 1/173 × upah sebulan.
 */
export function computeOvertimePay(baseSalary: number, overtimeHours: number): number {
  if (overtimeHours <= 0) return 0;
  const hourly = baseSalary / 173;
  const hours = Math.min(4, overtimeHours); // batas sah per hari (diakumulasi & dibatasi saat generate)
  let pay = 0;
  if (hours >= 1) pay += 1.5 * hourly;
  if (hours > 1) pay += (hours - 1) * 2 * hourly;
  return round0(pay);
}

/** THR = 1× gaji pokok (proporsional masa kerja bila < 12 bulan; di sini 1× penuh). */
export function computeThr(baseSalary: number, monthsOfService = 12): number {
  if (monthsOfService >= 12) return round0(baseSalary);
  return round0(baseSalary * (monthsOfService / 12));
}

export interface BpjsDeductions {
  kesehatan: number;
  jht: number;
  jp: number;
  totalEmployee: number;
  employer: {
    kesehatan: number;
    jht: number;
    jp: number;
    jkk: number;
    jkm: number;
    total: number;
  };
}

/** Potongan BPJS porsi karyawan + kontribusi pemberi kerja. */
export function computeBpjs(baseSalary: number, rates: PayrollRates = DEFAULT_RATES): BpjsDeductions {
  const kesBase = rates.bpjsKesehatanCap ? Math.min(baseSalary, rates.bpjsKesehatanCap) : baseSalary;
  const jpBase = rates.bpjsJpCap ? Math.min(baseSalary, rates.bpjsJpCap) : baseSalary;
  const kesehatan = round0(kesBase * rates.bpjsKesehatanRate);
  const jht = round0(baseSalary * rates.bpjsJhtRate);
  const jp = round0(jpBase * rates.bpjsJpRate);
  const employer = {
    kesehatan: round0(kesBase * rates.employerKesehatanRate),
    jht: round0(baseSalary * rates.employerJhtRate),
    jp: round0(jpBase * rates.employerJpRate),
    jkk: round0(baseSalary * rates.employerJkkRate),
    jkm: round0(baseSalary * rates.employerJkmRate),
    total: 0,
  };
  employer.total = employer.kesehatan + employer.jht + employer.jp + employer.jkk + employer.jkm;
  return { kesehatan, jht, jp, totalEmployee: kesehatan + jht + jp, employer };
}

/** Lapisan tarif PPh 21 progresif (PKP tahunan, UU HPP). */
export interface TaxBracket {
  upTo: number | null; // null = tak terbatas
  rate: number;        // mis. 0.05
}
export const PPH21_BRACKETS: TaxBracket[] = [
  { upTo: 60_000_000, rate: 0.05 },
  { upTo: 250_000_000, rate: 0.15 },
  { upTo: 500_000_000, rate: 0.25 },
  { upTo: 5_000_000_000, rate: 0.30 },
  { upTo: null, rate: 0.35 },
];
export const PTKP_ANNUAL = 54_000_000; // PTKP TK/0 setahun (indikatif)

/** PPh 21 tahunan dari PKP memakai lapisan progresif. */
export function computeAnnualTax(pkp: number, brackets: TaxBracket[] = PPH21_BRACKETS): number {
  let remaining = Math.max(0, pkp);
  let prevCap = 0;
  let tax = 0;
  for (const b of brackets) {
    const cap = b.upTo ?? Infinity;
    const slice = Math.min(remaining, cap - prevCap);
    if (slice > 0) {
      tax += slice * b.rate;
      remaining -= slice;
    }
    prevCap = cap;
    if (remaining <= 0) break;
  }
  return round0(tax);
}

/**
 * PPh 21 bulanan (disetahunkan sederhana, metode bukan pegawai tetap ber-NPWP).
 * PKP = (penghasilan bruto setahun − biaya jabatan 5% (maks 6 juta) − PTKP).
 */
export function computePph21Monthly(
  monthlyGrossForTax: number,
  opts: { ptkpAnnual?: number; brackets?: TaxBracket[] } = {},
): number {
  const annualGross = monthlyGrossForTax * 12;
  const biayaJabatan = Math.min(annualGross * 0.05, 6_000_000);
  const ptkp = opts.ptkpAnnual ?? PTKP_ANNUAL;
  const pkp = Math.max(0, annualGross - biayaJabatan - ptkp);
  const annualTax = computeAnnualTax(pkp, opts.brackets ?? PPH21_BRACKETS);
  return round0(annualTax / 12);
}

export interface PayrollItemInput {
  baseSalary: number;
  fixedAllowance?: number;
  overtimeHours?: number;
  bonus?: number;
  thr?: number;
  presentDays?: number;
  workingDays?: number;
  otherEarnings?: Array<{ code: string; amount: number }>;
  otherDeductions?: Array<{ code: string; amount: number }>;
  rates?: PayrollRates;
}

export interface PayrollItemResult {
  baseSalary: number;       // dasar penghitungan (pro-rata bila ada)
  grossBaseSalary: number;  // gaji pokok penuh (untuk info)
  fixedAllowance: number;
  overtimePay: number;
  bonus: number;
  thr: number;
  otherEarnings: Array<{ code: string; amount: number }>;
  gross: number;
  bpjs: BpjsDeductions;
  pph21: number;
  otherDeductions: Array<{ code: string; amount: number }>;
  totalDeductions: number;
  net: number;
}

/** Hitung satu item payroll secara lengkap & deterministik. */
export function computePayrollItem(input: PayrollItemInput): PayrollItemResult {
  const rates = input.rates ?? DEFAULT_RATES;
  const workingDays = input.workingDays ?? 22;
  const presentDays = input.presentDays ?? workingDays;
  const grossBaseSalary = round0(input.baseSalary);
  const baseSalary = prorateBase(grossBaseSalary, presentDays, workingDays);
  const fixedAllowance = round0(input.fixedAllowance ?? 0);
  const overtimePay = computeOvertimePay(grossBaseSalary, input.overtimeHours ?? 0);
  const bonus = round0(input.bonus ?? 0);
  const thr = round0(input.thr ?? 0);
  const otherEarnings = input.otherEarnings ?? [];

  const gross =
    baseSalary + fixedAllowance + overtimePay + bonus + thr +
    otherEarnings.reduce((s, e) => s + round0(e.amount), 0);

  // Potongan BPJS dihitung dari gaji pokok penuh (bukan pro-rata) — praktik umum.
  const bpjs = computeBpjs(grossBaseSalary, rates);

  // PPh21 atas penghasilan bruto kena pajak (gross − komponen non-pajak? disederhanakan: gross).
  const pph21 = computePph21Monthly(gross);

  const otherDeductions = input.otherDeductions ?? [];
  const totalDeductions =
    bpjs.totalEmployee + pph21 + otherDeductions.reduce((s, d) => s + round0(d.amount), 0);

  return {
    baseSalary,
    grossBaseSalary,
    fixedAllowance,
    overtimePay,
    bonus,
    thr,
    otherEarnings,
    gross: round0(gross),
    bpjs,
    pph21,
    otherDeductions,
    totalDeductions: round0(totalDeductions),
    net: round0(gross - totalDeductions),
  };
}

/** Pembulatan rupiah penuh (praktik payroll Indonesia; deterministik). */
export function round0(n: number): number {
  return Math.round(Number.isFinite(n) ? n : 0);
}
