import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export async function insertOffboardingRequest(
  db: Db,
  data: {
    employeeId: string;
    reasonForLeaving: string;
    resignationNoticeDate: string;
    lastWorkingDay: string;
    isRegrettableAttrition?: boolean;
  }
) {
  const result = await db.execute(sql`
    INSERT INTO offboarding_requests (
      employee_id, reason_for_leaving, resignation_notice_date,
      last_working_day, is_regrettable_attrition, status
    ) VALUES (
      ${data.employeeId}::uuid,
      ${data.reasonForLeaving},
      ${data.resignationNoticeDate}::date,
      ${data.lastWorkingDay}::date,
      ${data.isRegrettableAttrition ?? false},
      'INITIATED'
    ) RETURNING id, employee_id as "employeeId", status, last_working_day as "lastWorkingDay"
  `);

  const request = result.rows[0] as any;

  // Insert standard 3 clearance checklist items
  await db.execute(sql`
    INSERT INTO knowledge_handovers (offboarding_request_id, handover_item_name, category, handover_to_employee_id, is_verified) VALUES
      (${request.id}::uuid, 'Dokumentasi Blueprint Proyek & Transfer Pengetahuan', 'DOCUMENTATION', ${data.employeeId}::uuid, FALSE),
      (${request.id}::uuid, 'Pencabutan Akses Kredensial, Email Korporat & VPN', 'ACCESS_KEY', ${data.employeeId}::uuid, FALSE),
      (${request.id}::uuid, 'Pengembalian Laptop Perusahaan, Token & ID Card', 'PHYSICAL_ASSET', ${data.employeeId}::uuid, FALSE)
  `);

  return request;
}

export async function selectOffboardingRequests(db: Db) {
  const result = await db.execute(sql`
    SELECT o.id, o.employee_id as "employeeId", o.reason_for_leaving as "reasonForLeaving",
           o.resignation_notice_date as "resignationNoticeDate", o.last_working_day as "lastWorkingDay",
           o.is_regrettable_attrition as "isRegrettableAttrition", o.status,
           o.created_at as "createdAt",
           e.full_name as "employeeName", e.employee_code as "employeeCode",
           e.base_salary as "baseSalary", e.join_date as "joinDate",
           d.department_name as "department", jp.position_title as "position",
           sc.id as "severanceId", sc.total_disbursement as "severanceTotal", sc.is_paid as "isSeverancePaid"
      FROM offboarding_requests o
      JOIN employees e ON e.id = o.employee_id
      JOIN departments d ON d.id = e.department_id
      JOIN job_positions jp ON jp.id = e.position_id
      LEFT JOIN severance_calculations sc ON sc.offboarding_request_id = o.id
     ORDER BY o.created_at DESC
  `);
  return result.rows as any[];
}

export async function selectOffboardingById(db: Db, id: string) {
  const result = await db.execute(sql`
    SELECT o.id, o.employee_id as "employeeId", o.reason_for_leaving as "reasonForLeaving",
           o.resignation_notice_date as "resignationNoticeDate", o.last_working_day as "lastWorkingDay",
           o.is_regrettable_attrition as "isRegrettableAttrition", o.status,
           e.full_name as "employeeName", e.base_salary as "baseSalary", e.join_date as "joinDate"
      FROM offboarding_requests o
      JOIN employees e ON e.id = o.employee_id
     WHERE o.id = ${id}::uuid
  `);
  return (result.rows[0] as any) ?? null;
}

export async function selectHandoversByRequest(db: Db, requestId: string) {
  const result = await db.execute(sql`
    SELECT h.id, h.offboarding_request_id as "offboardingRequestId",
           h.handover_item_name as "itemName", h.category,
           h.handover_to_employee_id as "handoverToEmployeeId",
           h.is_verified as "isVerified", h.verified_by as "verifiedBy", h.verified_at as "verifiedAt",
           e.full_name as "handoverToName"
      FROM knowledge_handovers h
      JOIN employees e ON e.id = h.handover_to_employee_id
     WHERE h.offboarding_request_id = ${requestId}::uuid
     ORDER BY h.id ASC
  `);
  return result.rows as any[];
}

export async function updateHandoverVerification(
  db: Db,
  handoverId: string,
  verifierId: string
) {
  const result = await db.execute(sql`
    UPDATE knowledge_handovers
       SET is_verified = TRUE,
           verified_by = ${verifierId}::uuid,
           verified_at = CURRENT_TIMESTAMP
     WHERE id = ${handoverId}::uuid
    RETURNING id, offboarding_request_id as "offboardingRequestId", is_verified as "isVerified"
  `);
  return result.rows[0] as any;
}

export async function upsertSeveranceRecord(
  db: Db,
  data: {
    offboardingRequestId: string;
    serviceYears: number;
    baseSalary: number;
    severancePay: number;
    serviceAppreciationPay: number;
    compensationPay: number;
    dplkTopupAmount: number;
    totalDisbursement: number;
    slaDisbursedDays?: number;
  }
) {
  const result = await db.execute(sql`
    INSERT INTO severance_calculations (
      offboarding_request_id, service_years, base_salary,
      severance_pay, service_appreciation_pay, compensation_pay,
      dplk_topup_amount, total_disbursement, sla_disbursed_days, is_paid
    ) VALUES (
      ${data.offboardingRequestId}::uuid,
      ${data.serviceYears},
      ${data.baseSalary},
      ${data.severancePay},
      ${data.serviceAppreciationPay},
      ${data.compensationPay},
      ${data.dplkTopupAmount},
      ${data.totalDisbursement},
      ${data.slaDisbursedDays ?? 3},
      FALSE
    )
    ON CONFLICT (offboarding_request_id) DO UPDATE SET
      service_years = EXCLUDED.service_years,
      base_salary = EXCLUDED.base_salary,
      severance_pay = EXCLUDED.severance_pay,
      service_appreciation_pay = EXCLUDED.service_appreciation_pay,
      compensation_pay = EXCLUDED.compensation_pay,
      dplk_topup_amount = EXCLUDED.dplk_topup_amount,
      total_disbursement = EXCLUDED.total_disbursement
    RETURNING id, offboarding_request_id as "offboardingRequestId",
              service_years as "serviceYears", base_salary as "baseSalary",
              severance_pay as "severancePay", service_appreciation_pay as "serviceAppreciationPay",
              compensation_pay as "compensationPay", dplk_topup_amount as "dplkTopup",
              total_disbursement as "totalDisbursement", is_paid as "isPaid"
  `);
  const row = result.rows[0] as any;
  if (!row) return null;
  return {
    ...row,
    serviceYears: Number(row.serviceYears),
    baseSalary: Number(row.baseSalary),
    severancePay: Number(row.severancePay),
    serviceAppreciationPay: Number(row.serviceAppreciationPay),
    compensationPay: Number(row.compensationPay),
    dplkTopup: Number(row.dplkTopup),
    totalDisbursement: Number(row.totalDisbursement),
  };
}

export async function markSeverancePaid(db: Db, severanceId: string, paymentRef: string) {
  const result = await db.execute(sql`
    UPDATE severance_calculations
       SET is_paid = TRUE,
           payment_reference_no = ${paymentRef},
           paid_at = CURRENT_TIMESTAMP
     WHERE id = ${severanceId}::uuid
    RETURNING id, is_paid as "isPaid", payment_reference_no as "paymentReferenceNo", paid_at as "paidAt"
  `);
  return result.rows[0] as any;
}

export async function selectLifetimeContributions(db: Db, employeeId: string) {
  const result = await db.execute(sql`
    SELECT id, employee_id as "employeeId",
           achievement_title as "achievementTitle", achievement_type as "achievementType",
           quantified_impact_idr as "quantifiedImpactIdr", points_awarded as "pointsAwarded",
           date_achieved as "dateAchieved", created_at as "createdAt"
      FROM lifetime_contributions
     WHERE employee_id = ${employeeId}::uuid
     ORDER BY date_achieved DESC
  `);
  return result.rows as any[];
}
