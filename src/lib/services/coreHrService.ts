import { getDb } from '@/lib/db/client';
import type { LeaveRequest } from '@/types';

export interface FlightRiskInput {
  bradfordFactor: number;
  peerReviewAvg: number;
  overtimeHoursWeekly: number;
  contractDaysRemaining: number;
}

export interface FlightRiskResult {
  score: number; // 0 - 100
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  warnings: string[];
}

/**
 * Menghitung potensi risiko pengunduran diri talenta kunci (Kotak 4 Flight Risk Engine)
 */
export function calculateFlightRisk(input: FlightRiskInput): FlightRiskResult {
  const { bradfordFactor, peerReviewAvg, overtimeHoursWeekly, contractDaysRemaining } = input;
  let score = 10;
  const warnings: string[] = [];

  if (bradfordFactor > 45) {
    score += 35;
    warnings.push('Indeks Bradford absensi mengindikasikan ketidakhadiran berulang');
  }

  if (peerReviewAvg < 3.2) {
    score += 25;
    warnings.push('Penurunan indeks kepuasan interaksi tim & rekan kerja');
  }

  if (overtimeHoursWeekly > 10) {
    score += 20;
    warnings.push('Beban lembur berlebih berisiko memicu kelelahan kerja (burnout)');
  }

  if (contractDaysRemaining <= 60 && contractDaysRemaining > 0) {
    score += 15;
    warnings.push('Masa berlaku kontrak PKWT akan berakhir dalam 60 hari');
  }

  const level = score >= 60 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';

  return {
    score: Math.min(score, 100),
    level,
    warnings,
  };
}

/**
 * Mengajukan permohonan cuti tahunan / izin mandiri
 */
export async function submitLeaveRequest(payload: {
  employeeId: string;
  leaveType: 'ANNUAL' | 'SICK' | 'MATERNITY' | 'SPECIAL';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
}): Promise<LeaveRequest> {
  const db = await getDb();

  // Validasi batas cuti tahunan (maksimal 12 hari sesuai regulasi PP 35/2021)
  if (payload.leaveType === 'ANNUAL' && payload.totalDays > 12) {
    throw new Error('Pengajuan cuti tahunan melebihi batas kuota 12 hari kerja per tahun.');
  }

  const res = await db.query<any>(
    `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, total_days, reason)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *;`,
    [
      payload.employeeId,
      payload.leaveType,
      payload.startDate,
      payload.endDate,
      payload.totalDays,
      payload.reason,
    ]
  );

  const row = res.rows[0];
  return {
    id: row.id,
    employeeId: row.employee_id,
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    totalDays: Number(row.total_days),
    reason: row.reason,
    status: row.status,
    approverId: row.approver_id,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
  };
}
