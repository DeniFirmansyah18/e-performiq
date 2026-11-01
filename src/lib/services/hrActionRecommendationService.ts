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
  currentGpa: number | null;
  isGpaMet: boolean;
  /** Semua skill wajib sudah diasesmen dan levelnya memadai. */
  isSkillsMet: boolean;
  requiredSkills: string[];
  /** Skill wajib yang punya bukti asesmen dan levelnya sudah memadai. */
  verifiedSkills: string[];
  /** Skill wajib yang sudah diasesmen tetapi levelnya masih di bawah syarat. */
  missingSkills: string[];
  /** Skill wajib yang belum pernah diasesmen — bukan berarti kurang. */
  unverifiedSkills: string[];
  /** Rincian asesmen kompetensi terakhir untuk pegawai ini. */
  assessedSkills: Array<{ skillName: string; actualLevel: number; requiredLevel: number }>;
  readinessPercentage: number;
  isEligibleForPromotion: boolean;
}

export interface CareerGuidanceResult {
  employeeId: string;
  fullName: string;
  currentPositionId: string;
  currentPositionTitle: string;
  currentJobGrade: string;
  serviceMonths: number;
  currentGpa: number | null;
  assessedSkills: Array<{ skillName: string; actualLevel: number; requiredLevel: number }>;
  nextCareerPaths: CareerLadderStep[];
}

/** Batas dokumen dianggap terlambat diverifikasi (hari kerja). */
const DOCUMENT_PENDING_WORKDAYS = 3;

function parseSkills(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'object' && value !== null) return Object.keys(value);
  return [];
}

/**
 * Selisih bulan penuh antara dua tanggal (tahun/bulan kalender), bukan
 * pembulatan hari, agar masa kerja tidak melompat karena panjang bulan.
 */
function monthsBetween(fromDate: string, toDate: Date): number {
  const from = new Date(`${String(fromDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from.getTime())) return 0;
  const months =
    (toDate.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (toDate.getUTCMonth() - from.getUTCMonth());
  // Kurangi satu bulan bila tanggal acuan belum mencapai tanggal bergabung.
  const dayAdjust = toDate.getUTCDate() < from.getUTCDate() ? 1 : 0;
  return Math.max(0, months - dayAdjust);
}

export async function getActionRecommendations(db: Db): Promise<HrActionRecommendation[]> {
  const recommendations: HrActionRecommendation[] = [];

  // 1. Kontrak PKWT yang kritis atau sudah kedaluwarsa.
  const contracts = await getContractsSummary(db);
  for (const alert of contracts.alerts) {
    if (alert.urgency === 'CRITICAL_30' || alert.urgency === 'EXPIRED') {
      recommendations.push({
        id: `contract-${alert.employeeId}`,
        type: 'CONTRACT_EXPIRY',
        priority: alert.urgency === 'EXPIRED' ? 'HIGH' : 'HIGH',
        title: `Kontrak PKWT ${alert.fullName} Segera Berakhir`,
        description: `Sisa masa kontrak: ${alert.daysRemaining} hari (berakhir ${alert.contractEndDate}). Segera tentukan keputusan perpanjangan atau transisi permanen.`,
        targetEmployeeId: alert.employeeId,
        targetEmployeeName: alert.fullName,
        actionUrl: `/dashboard/hr-command?tab=directory&search=${encodeURIComponent(alert.employeeCode)}`,
        actionLabel: 'Tinjau Kontrak',
      });
    }
  }

  // 2. Beban kerja berlebih (risiko burnout).
  const workload = await calculateWorkloadSummary(db);
  for (const emp of workload.employees) {
    if (emp.status === 'OVER_UTILIZED') {
      recommendations.push({
        id: `workload-${emp.employeeId}`,
        type: 'OVERWORK_INTERVENTION',
        priority: 'MEDIUM',
        title: `Beban Kerja Berlebih: ${emp.fullName}`,
        description: `Total ${emp.totalHours} jam tercatat (${emp.workloadIntensityPercentage}% dari kapasitas ${emp.capacityHours} jam pada periode ini). Pertimbangkan rebalancing tugas untuk mencegah burnout.`,
        targetEmployeeId: emp.employeeId,
        targetEmployeeName: emp.fullName,
        actionUrl: `/dashboard/hr-command?tab=workload&employeeId=${emp.employeeId}`,
        actionLabel: 'Lihat Timesheet',
      });
    }
  }

  // 3. Talenta yang sudah memenuhi seluruh syarat jenjang karir berikutnya.
  const eligible = (await db.execute(sql`
    SELECT
      e.id,
      e.full_name,
      e.position_id,
      c.target_position_id,
      tp.position_title AS target_title
    FROM employees e
    JOIN career_path_levels c ON c.job_position_id = e.position_id
    JOIN job_positions tp ON tp.id = c.target_position_id
    WHERE e.status NOT IN ('RESIGNED', 'RETIRED')
      AND COALESCE(e.employment_status::text, '') NOT IN ('RESIGNED', 'RETIRED')
  `)) as unknown as {
    rows: Array<{
      id: string;
      full_name: string;
      position_id: string;
      target_position_id: string;
      target_title: string;
    }>;
  };

  const seenPromotion = new Set<string>();
  for (const row of eligible.rows ?? []) {
    if (seenPromotion.has(row.id)) continue;
    const guidance = await getCareerGuidanceForEmployee(db, row.id);
    const path = guidance.nextCareerPaths.find(
      (p) => p.targetPositionId === row.target_position_id
    );
    if (!path?.isEligibleForPromotion) continue;

    seenPromotion.add(row.id);
    recommendations.push({
      id: `promotion-${row.id}`,
      type: 'PROMOTION_READINESS',
      priority: 'LOW',
      title: `${row.full_name} Siap Promosi ke ${path.targetPositionTitle}`,
      description: `Kesiapan ${path.readinessPercentage}%: masa kerja ${path.currentServiceMonths} bulan (minimal ${path.minServiceMonths}), GPA ${path.currentGpa ?? '-'} (minimal ${path.minGpa}), dan ${path.verifiedSkills.length}/${path.requiredSkills.length} skill wajib terverifikasi. Ajukan evaluasi promosi melalui komite kinerja.`,
      targetEmployeeId: row.id,
      targetEmployeeName: row.full_name,
      actionUrl: `/dashboard/hr-command?tab=career-actions&employeeId=${row.id}`,
      actionLabel: 'Lihat Panduan Karir',
    });
  }

  // 4. Berkas kepegawaian yang menunggu verifikasi lebih dari 3 hari kerja.
  const pendingDocs = (await db.execute(sql`
    SELECT
      d.employee_id,
      e.full_name,
      COUNT(*)::int AS pending_count,
      MIN(d.created_at) AS oldest_created_at
    FROM employee_documents d
    JOIN employees e ON e.id = d.employee_id
    WHERE d.verification_status = 'PENDING'
      AND d.created_at <= NOW() - (${DOCUMENT_PENDING_WORKDAYS} * INTERVAL '1 day')
    GROUP BY d.employee_id, e.full_name
    ORDER BY MIN(d.created_at) ASC
  `)) as unknown as {
    rows: Array<{
      employee_id: string;
      full_name: string;
      pending_count: number;
      oldest_created_at: unknown;
    }>;
  };

  for (const doc of pendingDocs.rows ?? []) {
    recommendations.push({
      id: `document-${doc.employee_id}`,
      type: 'DOCUMENT_PENDING',
      priority: 'MEDIUM',
      title: `Verifikasi Berkas Tertunda: ${doc.full_name}`,
      description: `${doc.pending_count} berkas menunggu verifikasi lebih dari ${DOCUMENT_PENDING_WORKDAYS} hari. Segera tinjau agar kelengkapan dokumen kepegawaian tidak menghambat proses lain.`,
      targetEmployeeId: doc.employee_id,
      targetEmployeeName: doc.full_name,
      actionUrl: '/dashboard/hr-command?tab=lifecycle&phase=PRE&feature=document-verification',
      actionLabel: 'Buka Verifikasi Berkas',
    });
  }

  const PRIORITY_ORDER: Record<HrActionRecommendation['priority'], number> = {
    HIGH: 0,
    MEDIUM: 1,
    LOW: 2,
  };
  return recommendations.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
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
      e.join_date,
      (
        SELECT pa.composite_gpa
          FROM performance_appraisals pa
         WHERE pa.employee_id = e.id
         ORDER BY pa.created_at DESC NULLS LAST
         LIMIT 1
      )::float8 AS current_gpa
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
      current_gpa: number | null;
    }>;
  };

  const emp = empRes.rows?.[0];
  if (!emp) {
    throw new Error('Karyawan tidak ditemukan.');
  }

  const currentServiceMonths = monthsBetween(emp.join_date, new Date());
  const currentGpa = emp.current_gpa === null ? null : Number(emp.current_gpa);

  // Bukti asesmen kompetensi terakhir: dipakai untuk memisahkan skill yang
  // benar-benar kurang dari skill yang sekadar belum pernah dinilai.
  const competencyRes = (await db.execute(sql`
    SELECT
      cs.skill_name,
      cs.actual_level,
      cs.required_level
    FROM competency_scores cs
    WHERE cs.employee_id = ${employeeId}::uuid
      AND cs.period_id = (
        SELECT cs2.period_id
          FROM competency_scores cs2
         WHERE cs2.employee_id = ${employeeId}::uuid
         ORDER BY cs2.created_at DESC NULLS LAST
         LIMIT 1
      )
    ORDER BY cs.skill_name
  `)) as unknown as {
    rows: Array<{ skill_name: string; actual_level: number; required_level: number }>;
  };

  const assessedSkills = (competencyRes.rows ?? []).map((row) => ({
    skillName: row.skill_name,
    actualLevel: Number(row.actual_level),
    requiredLevel: Number(row.required_level),
  }));

  const assessedByName = new Map(
    assessedSkills.map((a) => [a.skillName.trim().toLowerCase(), a])
  );

  const careerRes = (await db.execute(sql`
    SELECT
      c.target_position_id,
      tp.position_title AS target_title,
      tp.job_grade AS target_grade,
      c.min_gpa,
      c.min_service_months,
      c.required_skills
    FROM career_path_levels c
    JOIN job_positions tp ON tp.id = c.target_position_id
    WHERE c.job_position_id = ${emp.position_id}::uuid
    ORDER BY c.min_service_months ASC
  `)) as unknown as {
    rows: Array<{
      target_position_id: string;
      target_title: string;
      target_grade: string;
      min_gpa: number;
      min_service_months: number;
      required_skills: unknown;
    }>;
  };

  // Posisi puncak tidak punya baris lanjutan: kembalikan daftar kosong
  // (bukan error) agar UI dapat menampilkan "sudah di jenjang tertinggi".
  const nextCareerPaths: CareerLadderStep[] = (careerRes.rows ?? []).map((row) => {
    const minServiceMonths = Number(row.min_service_months || 0);
    const minGpa = Number(row.min_gpa || 0);
    const isServiceMet = currentServiceMonths >= minServiceMonths;
    // Tanpa data appraisal, syarat GPA belum dapat dinyatakan terpenuhi.
    const isGpaMet = currentGpa !== null && currentGpa >= minGpa;
    const requiredSkills = parseSkills(row.required_skills);

    const verifiedSkills: string[] = [];
    const missingSkills: string[] = [];
    const unverifiedSkills: string[] = [];
    for (const skill of requiredSkills) {
      const assessed = assessedByName.get(skill.trim().toLowerCase());
      if (!assessed) {
        unverifiedSkills.push(skill);
      } else if (assessed.actualLevel >= assessed.requiredLevel) {
        verifiedSkills.push(skill);
      } else {
        missingSkills.push(skill);
      }
    }

    // Kesiapan harus mencerminkan SELURUH syarat. Sebelumnya hanya masa kerja
    // dan GPA yang dihitung sehingga pegawai dengan skill wajib yang belum
    // pernah diasesmen tetap tampil "100% siap" — menyesatkan komite promosi.
    // Skill yang belum diasesmen TIDAK boleh dianggap memenuhi syarat: tanpa
    // bukti penilaian, kelayakan belum dapat dinyatakan.
    const isSkillsMet = requiredSkills.length === 0 || missingSkills.length === 0 && unverifiedSkills.length === 0;
    const requirementsMet = [isServiceMet, isGpaMet, isSkillsMet];
    const metCount = requirementsMet.filter(Boolean).length;

    return {
      targetPositionId: row.target_position_id,
      targetPositionTitle: row.target_title,
      targetJobGrade: row.target_grade,
      minServiceMonths,
      currentServiceMonths,
      isServiceMet,
      minGpa,
      currentGpa,
      isGpaMet,
      isSkillsMet,
      requiredSkills,
      verifiedSkills,
      missingSkills,
      unverifiedSkills,
      assessedSkills,
      readinessPercentage: Math.round((metCount / requirementsMet.length) * 100),
      isEligibleForPromotion: isServiceMet && isGpaMet && isSkillsMet,
    };
  });

  return {
    employeeId: emp.id,
    fullName: emp.full_name,
    currentPositionId: emp.position_id,
    currentPositionTitle: emp.position_title,
    currentJobGrade: emp.job_grade,
    serviceMonths: currentServiceMonths,
    currentGpa,
    assessedSkills,
    nextCareerPaths,
  };
}

