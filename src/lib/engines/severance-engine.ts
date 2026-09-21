// Severance & Pension Handover Estimator (PP No. 35/2021 & UU Cipta Kerja)
// (PRD Section 3.3 & Section 10.2 Table 15)

export function calculateServiceYears(joinDate: string | Date, endDate: string | Date): number {
  const start = new Date(joinDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return 0;
  }
  let years = end.getFullYear() - start.getFullYear();
  const m = end.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < start.getDate())) {
    years--;
  }
  return Math.max(0, years);
}

export interface SeveranceInput {
  serviceYears: number;
  baseSalary: number;
  reasonType: 'RESIGNATION' | 'PENSION' | 'EFFICIENCY' | 'CONTRACT_END';
  dplkTopup?: number;
}

export interface SeveranceOutput {
  serviceYears: number;
  baseSalary: number;
  upMultiplier: number;           // Bulan Uang Pesangon (UP)
  severancePay: number;           // UP IDR
  upmkMultiplier: number;         // Bulan Uang Penghargaan Masa Kerja (UPMK)
  serviceAppreciationPay: number; // UPMK IDR
  compensationPay: number;        // Uang Penggantian Hak (UPH - 15%)
  dplkTopup: number;
  totalDisbursement: number;
  legalReference: string;
}

export function calculateSeverance(input: SeveranceInput): SeveranceOutput {
  const { serviceYears, baseSalary, reasonType, dplkTopup = 0 } = input;

  // 1. Uang Pesangon (UP) - Pasal 40 PP 35/2021
  let upMonths = 0;
  if (serviceYears < 1) upMonths = 1;
  else if (serviceYears < 2) upMonths = 2;
  else if (serviceYears < 3) upMonths = 3;
  else if (serviceYears < 4) upMonths = 4;
  else if (serviceYears < 5) upMonths = 5;
  else if (serviceYears < 6) upMonths = 6;
  else if (serviceYears < 7) upMonths = 7;
  else if (serviceYears < 8) upMonths = 8;
  else upMonths = 9; // 8 tahun atau lebih

  // Jika Resign sukarela, regulasi menetapkan hanya UPH + Uang Pisah (DPLK),
  // Namun untuk Pensiun atau PHK Efisiensi mendapatkan 1.0x - 1.75x UP
  let factorUP = 1.0;
  if (reasonType === 'RESIGNATION') {
    factorUP = 0; // Resign sukarela tidak mendapatkan UP sesuai PP 35/2021 ps 50
  } else if (reasonType === 'PENSION') {
    factorUP = 1.75; // Pensiun normal 1.75x UP
  } else if (reasonType === 'EFFICIENCY') {
    factorUP = 1.0;
  }

  const severancePay = Math.round(upMonths * baseSalary * factorUP);

  // 2. Uang Penghargaan Masa Kerja (UPMK) - Pasal 40 PP 35/2021
  let upmkMonths = 0;
  if (serviceYears >= 3 && serviceYears < 6) upmkMonths = 2;
  else if (serviceYears >= 6 && serviceYears < 9) upmkMonths = 3;
  else if (serviceYears >= 9 && serviceYears < 12) upmkMonths = 4;
  else if (serviceYears >= 12 && serviceYears < 15) upmkMonths = 5;
  else if (serviceYears >= 15 && serviceYears < 18) upmkMonths = 6;
  else if (serviceYears >= 18 && serviceYears < 21) upmkMonths = 7;
  else if (serviceYears >= 21 && serviceYears < 24) upmkMonths = 8;
  else if (serviceYears >= 24) upmkMonths = 10;

  let factorUPMK = 1.0;
  if (reasonType === 'RESIGNATION') {
    factorUPMK = 0; // Tidak dapat UPMK standar kecuali kebijakan PKB
  }

  const serviceAppreciationPay = Math.round(upmkMonths * baseSalary * factorUPMK);

  // 3. Uang Penggantian Hak (UPH) - 15% dari (UP + UPMK) jika ada, atau sisa cuti + ongkos
  const compensationPay = Math.round((severancePay + serviceAppreciationPay) * 0.15);

  const totalDisbursement = severancePay + serviceAppreciationPay + compensationPay + dplkTopup;

  return {
    serviceYears,
    baseSalary,
    upMultiplier: upMonths * factorUP,
    severancePay,
    upmkMultiplier: upmkMonths * factorUPMK,
    serviceAppreciationPay,
    compensationPay,
    dplkTopup,
    totalDisbursement,
    legalReference: 'Peraturan Pemerintah Republik Indonesia No. 35 Tahun 2021',
  };
}
