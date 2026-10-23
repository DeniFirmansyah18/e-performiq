import { describe, it, expect } from 'vitest';
import {
  bandFor, computeAttritionRisk, computeBurnoutRisk, computeFlightRisk,
  type RiskSignals,
} from '@/lib/engines/flightRiskEngine';

const zero: RiskSignals = {
  absentDays30: 0, lateDays30: 0, redDays30: 0,
  overtimeHours30: 0, longestWorkStreak: 0,
  avgDpi30: null, dpiTrend: null, entryAdherence: null,
  tenureMonths: 0,
};
const signals = (over: Partial<RiskSignals>): RiskSignals => ({ ...zero, ...over });

const pointsOf = (factors: Array<{ code: string; points: number }>, code: string) =>
  factors.find((f) => f.code === code)?.points;

describe('bandFor', () => {
  it('memetakan ambang tepat pada batasnya', () => {
    expect(bandFor(0)).toBe('LOW');
    expect(bandFor(24)).toBe('LOW');
    expect(bandFor(25)).toBe('MODERATE');
    expect(bandFor(49)).toBe('MODERATE');
    expect(bandFor(50)).toBe('HIGH');
    expect(bandFor(74)).toBe('HIGH');
    expect(bandFor(75)).toBe('CRITICAL');
    expect(bandFor(100)).toBe('CRITICAL');
  });
});

describe('computeAttritionRisk', () => {
  it('tanpa sinyal → skor 0, band LOW, semua faktor nol', () => {
    const res = computeAttritionRisk(zero);
    expect(res.score).toBe(0);
    expect(res.band).toBe('LOW');
    expect(res.factors).toHaveLength(9);
    expect(res.factors.every((f) => f.points === 0)).toBe(true);
  });

  it('karyawan sehat tetap 0 walau ada satu keterlambatan', () => {
    const res = computeAttritionRisk(signals({
      lateDays30: 1, overtimeHours30: 2, longestWorkStreak: 5,
      avgDpi30: 95, dpiTrend: 3, entryAdherence: 0.98, tenureMonths: 40,
    }));
    expect(res.score).toBe(0);
    expect(res.band).toBe('LOW');
  });

  it('menjumlahkan bobot sesuai tabel plan (kasus sedang = 45)', () => {
    const res = computeAttritionRisk(signals({
      absentDays30: 3, redDays30: 4, avgDpi30: 80, dpiTrend: -2,
      entryAdherence: 0.5, tenureMonths: 6,
    }));
    expect(pointsOf(res.factors, 'ABSENCE')).toBe(9);
    expect(pointsOf(res.factors, 'LOW_DPI')).toBe(10);
    expect(pointsOf(res.factors, 'RED_DAYS')).toBe(8);
    expect(pointsOf(res.factors, 'DPI_DECLINE')).toBe(8);
    expect(pointsOf(res.factors, 'LOW_ADHERENCE')).toBe(10);
    expect(pointsOf(res.factors, 'EARLY_TENURE')).toBe(0);
    expect(res.score).toBe(45);
    expect(res.band).toBe('MODERATE');
  });

  it('kasus ekstrem menjumlah 100 dan berhenti di CRITICAL', () => {
    const res = computeAttritionRisk(signals({
      absentDays30: 12, redDays30: 15, avgDpi30: 60, dpiTrend: -6,
      entryAdherence: 0.3, tenureMonths: 6,
    }));
    expect(pointsOf(res.factors, 'ABSENCE')).toBe(30);
    expect(pointsOf(res.factors, 'LOW_DPI')).toBe(20);
    expect(pointsOf(res.factors, 'RED_DAYS')).toBe(20);
    expect(pointsOf(res.factors, 'DPI_DECLINE')).toBe(15);
    expect(pointsOf(res.factors, 'LOW_ADHERENCE')).toBe(10);
    expect(pointsOf(res.factors, 'EARLY_TENURE')).toBe(5);
    expect(res.score).toBe(100);
    expect(res.band).toBe('CRITICAL');
  });

  it('skor tidak pernah melebihi 100', () => {
    const res = computeAttritionRisk(signals({
      absentDays30: 99, redDays30: 99, avgDpi30: 10, dpiTrend: -50,
      entryAdherence: 0, tenureMonths: 1,
    }));
    expect(res.score).toBe(100);
  });

  it('DPI tidak tersedia tidak dianggap berisiko', () => {
    const res = computeAttritionRisk(signals({ avgDpi30: null, dpiTrend: null }));
    expect(pointsOf(res.factors, 'LOW_DPI')).toBe(0);
    expect(pointsOf(res.factors, 'DPI_DECLINE')).toBe(0);
    expect(pointsOf(res.factors, 'EARLY_TENURE')).toBe(0);
    expect(res.score).toBe(0);
  });

  it('tren positif tidak menambah poin', () => {
    const res = computeAttritionRisk(signals({ dpiTrend: 4 }));
    expect(pointsOf(res.factors, 'DPI_DECLINE')).toBe(0);
  });

  it('setiap faktor membawa maxPoints untuk keperluan UI', () => {
    const res = computeAttritionRisk(zero);
    const byCode = (code: string) => res.factors.find((f) => f.code === code);
    expect(byCode('ABSENCE')?.maxPoints).toBe(30);
    expect(byCode('LOW_DPI')?.maxPoints).toBe(20);
    expect(byCode('RED_DAYS')?.maxPoints).toBe(20);
    expect(byCode('DPI_DECLINE')?.maxPoints).toBe(15);
    expect(byCode('LOW_ADHERENCE')?.maxPoints).toBe(10);
    expect(byCode('EARLY_TENURE')?.maxPoints).toBe(5);
  });
});

describe('computeBurnoutRisk', () => {
  it('tanpa sinyal → 0 dan LOW', () => {
    const res = computeBurnoutRisk(zero);
    expect(res.score).toBe(0);
    expect(res.band).toBe('LOW');
    expect(res.factors).toHaveLength(6);
  });

  it('lembur 12 jam saja belum menaikkan band', () => {
    const res = computeBurnoutRisk(signals({ overtimeHours30: 12 }));
    expect(pointsOf(res.factors, 'OVERTIME_LOAD')).toBe(12);
    expect(res.score).toBe(12);
    expect(res.band).toBe('LOW');
  });

  it('beban lembur bertingkat 10/20/40', () => {
    expect(pointsOf(computeBurnoutRisk(signals({ overtimeHours30: 9 })).factors, 'OVERTIME_LOAD')).toBe(0);
    expect(pointsOf(computeBurnoutRisk(signals({ overtimeHours30: 10 })).factors, 'OVERTIME_LOAD')).toBe(12);
    expect(pointsOf(computeBurnoutRisk(signals({ overtimeHours30: 20 })).factors, 'OVERTIME_LOAD')).toBe(25);
    expect(pointsOf(computeBurnoutRisk(signals({ overtimeHours30: 40 })).factors, 'OVERTIME_LOAD')).toBe(40);
  });

  it('streak 12 hari kerja beruntun menambah 20', () => {
    expect(pointsOf(computeBurnoutRisk(signals({ longestWorkStreak: 11 })).factors, 'LONG_STREAK')).toBe(0);
    expect(pointsOf(computeBurnoutRisk(signals({ longestWorkStreak: 12 })).factors, 'LONG_STREAK')).toBe(20);
  });

  it('kasus ekstrem menjumlah 100', () => {
    const res = computeBurnoutRisk(signals({
      overtimeHours30: 45, longestWorkStreak: 20, lateDays30: 15,
      redDays30: 15, dpiTrend: -1,
    }));
    expect(pointsOf(res.factors, 'OVERTIME_LOAD')).toBe(40);
    expect(pointsOf(res.factors, 'LONG_STREAK')).toBe(20);
    expect(pointsOf(res.factors, 'LATE_FATIGUE')).toBe(20);
    expect(pointsOf(res.factors, 'RED_DAYS')).toBe(10);
    expect(pointsOf(res.factors, 'DPI_DECLINE')).toBe(10);
    expect(res.score).toBe(100);
    expect(res.band).toBe('CRITICAL');
  });

  it('tren DPI turun sedikit pun menambah 10 (ambang lebih sensitif dari attrition)', () => {
    const res = computeBurnoutRisk(signals({ dpiTrend: -0.5 }));
    expect(pointsOf(res.factors, 'DPI_DECLINE')).toBe(10);
  });
});

describe('sinyal warisan (Bradford, peer review, kontrak, lembur mingguan)', () => {
  it('profil buruk menghasilkan poin tinggi dan peringatan panjang', () => {
    const res = computeAttritionRisk(signals({
      bradfordFactor: 65, peerReviewAvg: 2.8, contractDaysRemaining: 40,
    }));
    expect(pointsOf(res.factors, 'BRADFORD')).toBe(25);
    expect(pointsOf(res.factors, 'PEER_REVIEW')).toBe(20);
    expect(pointsOf(res.factors, 'CONTRACT_END')).toBe(15);
    expect(res.score).toBe(60);
    expect(res.band).toBe('HIGH');

    const bradford = res.factors.find((f) => f.code === 'BRADFORD');
    expect(bradford?.label).toBe('Indeks Bradford tinggi');
    expect(bradford?.warning).toBe('Indeks Bradford absensi mengindikasikan ketidakhadiran berulang');
  });

  it('profil stabil tidak menambah poin', () => {
    const res = computeAttritionRisk(signals({
      bradfordFactor: 5, peerReviewAvg: 4.5, contractDaysRemaining: 300,
    }));
    expect(res.score).toBe(0);
  });

  it('kontrak yang sudah lewat (0 hari) tidak dihitung sebagai risiko', () => {
    const res = computeAttritionRisk(signals({ contractDaysRemaining: 0 }));
    expect(pointsOf(res.factors, 'CONTRACT_END')).toBe(0);
  });

  it('lembur mingguan > 10 jam menambah beban burnout', () => {
    const res = computeBurnoutRisk(signals({ overtimeHoursWeekly: 14 }));
    expect(pointsOf(res.factors, 'OVERTIME_WEEKLY')).toBe(30);
    expect(res.factors.find((f) => f.code === 'OVERTIME_WEEKLY')?.warning)
      .toBe('Beban lembur berlebih berisiko memicu kelelahan kerja (burnout)');
    expect(pointsOf(computeBurnoutRisk(signals({ overtimeHoursWeekly: 2 })).factors, 'OVERTIME_WEEKLY')).toBe(0);
  });

  it('lembur harian dan lembur mingguan tidak dijumlahkan bila keduanya diisi', () => {
    const res = computeBurnoutRisk(signals({ overtimeHours30: 45, overtimeHoursWeekly: 14 }));
    expect(pointsOf(res.factors, 'OVERTIME_LOAD')).toBe(40);
    expect(pointsOf(res.factors, 'OVERTIME_WEEKLY')).toBe(0);
  });
});

describe('computeFlightRisk', () => {
  it('overall mengambil band tertinggi dari dua skor', () => {
    const res = computeFlightRisk(signals({
      overtimeHours30: 20, longestWorkStreak: 12, lateDays30: 10,
    }));
    expect(res.attrition.band).toBe('LOW');
    expect(res.burnout.band).toBe('HIGH');
    expect(res.overall).toBe('HIGH');
  });

  it('keduanya rendah → overall LOW', () => {
    const res = computeFlightRisk(zero);
    expect(res.overall).toBe('LOW');
  });

  it('attrition lebih tinggi → overall mengikuti attrition', () => {
    const res = computeFlightRisk(signals({
      absentDays30: 10, redDays30: 10, avgDpi30: 60, dpiTrend: -6,
      entryAdherence: 0.2, tenureMonths: 3,
    }));
    expect(res.attrition.band).toBe('CRITICAL');
    // Burnout hanya memakai red days (10) + tren turun (10) = 20 → LOW.
    expect(res.burnout.band).toBe('LOW');
    expect(res.overall).toBe('CRITICAL');
  });
});
