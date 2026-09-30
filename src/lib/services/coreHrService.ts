import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import type { Db } from '@/lib/db/client';
import type { LeaveRequest } from '@/types';
import { getAttendanceFactRows, computeBradfordFactor } from './attendanceService';

/**

Profil risiko karyawan yang angkanya bersumber dari DATA NYATA
di database (menggantikan input bradfordFactor: 65 yang dulu hardcoded).
*/
export interface EmployeeRiskProfile {
employeeId: string;
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

/** Jendela lihat-balik untuk perhitungan Bradford (90 hari kalender). */
const BRADFORD_LOOKBACK_DAYS = 90;

function toISODate(d: Date): string {
return d.toISOString().slice(0, 10);
}

/** Sisa hari sampai kontrak berakhir; 0 bila tidak ada tanggal kontrak atau sudah lewat. */
export function computeContractDaysRemaining(
contractEndDate: string | null | undefined,
now: Date = new Date()
): number {
if (!contractEndDate) return 0;
const end = Date.parse(`${contractEndDate.slice(0, 10)}T00:00:00Z`);
if (Number.isNaN(end)) return 0;
const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
return Math.max(0, Math.round((end - start) / 86400000));
}

/**

Menyusun profil risiko satu karyawan dari database:
bradfordFactor: dihitung dari attendance_records 90 hari terakhir
peerReviewAvg: rata-rata average_core_value_score dari peer_reviews_360
overtimeHoursWeekly: rata-rata lembur mingguan dari attendance_records
contractDaysRemaining: sisa hari kontrak PKWT dari employees.contract_end_date (0 bila NULL)
*/
export async function buildRiskProfile(
db: Db,
employeeId: string
): Promise<EmployeeRiskProfile> {
const today = new Date();
const from = toISODate(new Date(today.getTime() - BRADFORD_LOOKBACK_DAYS * 86400000));
const to = toISODate(today);
const facts = await getAttendanceFactRows(db, employeeId, from, to);
const bradfordFactor = computeBradfordFactor(facts);

const peer = (await db.execute(sql`SELECT COALESCE(AVG(average_core_value_score), 4.2) AS "avgScore" FROM peer_reviews_360 WHERE evaluatee_id = ${employeeId}::uuid`)) as unknown as { rows: Array<Record<string, unknown>> };

const overtime = (await db.execute(sql`SELECT COALESCE(SUM(total_overtime_hours), 0) AS "totalOvertime" FROM attendance_records WHERE employee_id = ${employeeId}::uuid AND work_date >= ${from}::date`)) as unknown as { rows: Array<Record<string, unknown>> };

const totalOvertime = Number(overtime.rows[0]?.totalOvertime ?? 0);

const contract = (await db.execute(sql`SELECT contract_end_date::text AS "contractEndDate" FROM employees WHERE id = ${employeeId}::uuid`)) as unknown as { rows: Array<{ contractEndDate: string | null }> };

return {
employeeId,
bradfordFactor,
peerReviewAvg: Number(peer.rows[0]?.avgScore ?? 4.2),
overtimeHoursWeekly: Math.round(totalOvertime / (BRADFORD_LOOKBACK_DAYS / 7)),
contractDaysRemaining: computeContractDaysRemaining(contract.rows[0]?.contractEndDate ?? null),
};
}

/**

Menghitung potensi risiko pengunduran diri talenta kunci (Kotak 4 Flight Risk Engine)
*/
export function calculateFlightRisk(profile: EmployeeRiskProfile): FlightRiskResult {
const { bradfordFactor, peerReviewAvg, overtimeHoursWeekly, contractDaysRemaining } = profile;
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

Mengajukan permohonan cuti tahunan / izin mandiri
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

const res = await db.query(
`INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, total_days, reason) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`,
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
