import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { getContractsSummary } from './contractService';
import { calculateWorkloadSummary } from './workloadService';

export interface HrActionRecommendation {
  id: string;
  type: 'CONTRACT_EXPIRY' | 'OVERWORK_INTERVENTION' | 'PROMOTION_READINESS' | 'DOCUMENT_PENDING';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  targetEmployeeId?: string;
  targetEmployeeName?: string;
  actionUrl: string;
  actionLabel: string;
}

export interface CareerLadderStep {
  targetPositionId: string;
  targetPositionTitle: string;
  targetJobGrade: string;
  minServiceMonths: number;
  currentServiceMonths: number;
  isServiceMet: boolean;
  minGpa: number;
  currentGpa: number;
  isGpaMet: boolean;
  requiredSkills: string[];
  isEligibleForPromotion: boolean;
}

export interface CareerGuidanceResult {
  employeeId: string;
  fullName: string;
  currentPositionId: string;
  currentPositionTitle: string;
  currentJobGrade: string;
  serviceMonths: number;
  nextCareerPaths: CareerLadderStep[];
}

export async function getActionRecommendations(db: Db): Promise<HrActionRecommendation[]> {
  const recommendations: HrActionRecommendation[] = [];

  // 1. Rekomendasi kontrak PKWT
  const contracts = await getContractsSummary(db);
  for (const alert of contracts.alerts) {
    if (alert.urgency === 'CRITICAL_30' || alert.urgency === 'EXPIRED') {
      recommendations.push({
        id: `contract-${alert.employeeId}`,
        type: 'CONTRACT_EXPIRY',
        priority: 'HIGH',
        title: `Kontrak PKWT ${alert.fullName} Segera Berakhir`,
        description: `Sisa masa kontrak: ${alert.daysRemaining} hari (berakhir ${alert.contractEndDate}). Segera tentukan keputusan perpanjangan atau transisi permanen.`,
        targetEmployeeId: alert.employeeId,
        targetEmployeeName: alert.fullName,
        actionUrl: `/dashboard/hr-command?tab=directory&search=${encodeURIComponent(alert.employeeCode)}`,
        actionLabel: 'Tinjau Kontrak',
      });
    }
  }

  // 2. Rekomendasi beban kerja (over-utilized)
  const workload = await calculateWorkloadSummary(db);
  for (const emp of workload.employees) {
    if (emp.status === 'OVER_UTILIZED') {
      recommendations.push({
        id: `workload-${emp.employeeId}`,
        type: 'OVERWORK_INTERVENTION',
        priority: 'MEDIUM',
        title: `Beban Kerja Berlebih: ${emp.fullName}`,
        description: `Total jam kerja mencapai ${emp.totalHours} jam (${emp.workloadIntensityPercentage}% kapasitas). Pertimbangkan rebalancing tugas untuk mencegah burnout.`,
        targetEmployeeId: emp.employeeId,
        targetEmployeeName: emp.fullName,
        actionUrl: `/dashboard/hr-command?tab=workload&employeeId=${emp.employeeId}`,
        actionLabel: 'Lihat Timesheet',
      });
    }
  }

  return recommendations;
}

export async function getCareerGuidanceForEmployee(
  db: Db,
  employeeId: string
): Promise<CareerGuidanceResult> {
  const empRes = (await db.execute(sql`
    SELECT
      e.id,
      e.full_name,
      e.position_id,
      p.position_title,
      p.job_grade,
      e.join_date
    FROM employees e
    JOIN job_positions p ON p.id = e.position_id
    WHERE e.id = ${employeeId}::uuid
  `)) as unknown as {
    rows: Array<{
      id: string;
      full_name: string;
      position_id: string;
      position_title: string;
      job_grade: string;
      join_date: string;
    }>;
  };

  const emp = empRes.rows?.[0];
  if (!emp) {
    throw new Error('Karyawan tidak ditemukan.');
  }

  // Hitung masa kerja dalam bulan
  const join = new Date(emp.join_date);
  const now = new Date();
  const currentServiceMonths = Math.max(
    0,
    (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth())
  );

  // Ambil jenjang karir lanjutan
  const careerRes = (await db.execute(sql`
    SELECT
      c.target_position_id,
      tp.position_title as target_title,
      tp.job_grade as target_grade,
      c.min_gpa,
      c.min_service_months,
      c.required_skills
    FROM career_path_levels c
    JOIN job_positions tp ON tp.id = c.target_position_id
    WHERE c.job_position_id = ${emp.position_id}::uuid
  `)) as unknown as {
    rows: Array<{
      target_position_id: string;
      target_title: string;
      target_grade: string;
      min_gpa: number;
      min_service_months: number;
      required_skills: any;
    }>;
  };

  const currentGpa = 3.5; // Estimasi default GPA/Kinerja
  const nextCareerPaths: CareerLadderStep[] = (careerRes.rows ?? []).map((row) => {
    const isServiceMet = currentServiceMonths >= Number(row.min_service_months || 0);
    const isGpaMet = currentGpa >= Number(row.min_gpa || 0);
    const skills = Array.isArray(row.required_skills)
      ? row.required_skills
      : typeof row.required_skills === 'object' && row.required_skills !== null
      ? Object.keys(row.required_skills)
      : [];

    return {
      targetPositionId: row.target_position_id,
      targetPositionTitle: row.target_title,
      targetJobGrade: row.target_grade,
      minServiceMonths: Number(row.min_service_months || 0),
      currentServiceMonths,
      isServiceMet,
      minGpa: Number(row.min_gpa || 0),
      currentGpa,
      isGpaMet,
      requiredSkills: skills,
      isEligibleForPromotion: isServiceMet && isGpaMet,
    };
  });

  return {
    employeeId: emp.id,
    fullName: emp.full_name,
    currentPositionId: emp.position_id,
    currentPositionTitle: emp.position_title,
    currentJobGrade: emp.job_grade,
    serviceMonths: currentServiceMonths,
    nextCareerPaths,
  };
}
