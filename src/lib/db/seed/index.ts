import { PGlite } from '@electric-sql/pglite';
import { hashPassword } from '@/lib/auth/password';
import type { UserRole } from '@/types';

export const DEMO_PASSWORD = 'enterprise2026';
export const SEED_PERIOD_CODE = '2026-Q3';

export const SEED_USER_EMAILS: ReadonlyArray<{ email: string; role: UserRole }> = [
  { email: 'hendra.gunawan@eperformiq.co.id', role: 'BOD' },
  { email: 'siti.nurhaliza@eperformiq.co.id', role: 'HR_MANAGER' },
  { email: 'danu.tech@eperformiq.co.id', role: 'PEOPLE_MANAGER' },
  { email: 'budi.pratama@eperformiq.co.id', role: 'EMPLOYEE' },
  { email: 'bambang.audit@eperformiq.co.id', role: 'AUDITOR' },
  { email: 'admin@eperformiq.co.id', role: 'SUPER_ADMIN' },
  { email: 'aris.assessor@eperformiq.co.id', role: 'ASSESSOR' },
];

/** Idempoten: seluruh INSERT memakai ON CONFLICT DO NOTHING (spec §10). */
export async function runSeed(client: PGlite): Promise<void> {
  const hash = await hashPassword(DEMO_PASSWORD);

  await client.exec(`
    INSERT INTO companies (id, company_name, legal_entity_code) VALUES
      ('a0000000-0000-4000-8000-000000000001','PT E-PerformIQ Nusantara','EPQ')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO departments (id, company_id, department_name, division_name) VALUES
      ('a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000001','Information Technology & Engineering','Technology'),
      ('a0000000-0000-4000-8000-000000000102','a0000000-0000-4000-8000-000000000001','Human Capital & Corporate Governance','Corporate'),
      ('a0000000-0000-4000-8000-000000000103','a0000000-0000-4000-8000-000000000001','Dewan Direksi (Board of Directors)','Corporate'),
      ('a0000000-0000-4000-8000-000000000104','a0000000-0000-4000-8000-000000000001','Satuan Pengawas Internal (SPI)','Corporate'),
      ('a0000000-0000-4000-8000-000000000105','a0000000-0000-4000-8000-000000000001','Komite Kalibrasi & Suksesi Talenta','Corporate')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO job_positions (id, department_id, position_title, job_grade) VALUES
      ('a0000000-0000-4000-8000-000000000201','a0000000-0000-4000-8000-000000000103','Chief Executive Officer (CEO)','1'),
      ('a0000000-0000-4000-8000-000000000202','a0000000-0000-4000-8000-000000000102','VP of Human Capital','2'),
      ('a0000000-0000-4000-8000-000000000203','a0000000-0000-4000-8000-000000000101','Head of Engineering & Ops','2'),
      ('a0000000-0000-4000-8000-000000000204','a0000000-0000-4000-8000-000000000101','Senior Software Engineer','4'),
      ('a0000000-0000-4000-8000-000000000205','a0000000-0000-4000-8000-000000000104','Chief Internal Auditor','2'),
      ('a0000000-0000-4000-8000-000000000206','a0000000-0000-4000-8000-000000000102','HR System Administrator','3'),
      ('a0000000-0000-4000-8000-000000000207','a0000000-0000-4000-8000-000000000105','Lead Talent Assessor & Facilitator','2')
    ON CONFLICT (id) DO NOTHING;

    -- Level 1: CEO
    INSERT INTO employees (id, employee_code, full_name, email, phone_number,
                           department_id, position_id, manager_id, status,
                           base_salary, join_date) VALUES
      ('b0000000-0000-4000-8000-000000000001','CEO-2019-0001','Ir. Hendra Gunawan, M.B.A.','hendra.gunawan@eperformiq.co.id','+62 811-0001-0001','a0000000-0000-4000-8000-000000000103','a0000000-0000-4000-8000-000000000201',NULL,'PERMANENT',95000000,'2019-01-02')
    ON CONFLICT (id) DO NOTHING;

    -- Level 2: Managers (reports to CEO)
    INSERT INTO employees (id, employee_code, full_name, email, phone_number,
                           department_id, position_id, manager_id, status,
                           base_salary, join_date) VALUES
      ('b0000000-0000-4000-8000-000000000002','HRM-2018-0002','Siti Nurhaliza, S.Psi., M.M.','siti.nurhaliza@eperformiq.co.id','+62 811-0002-0002','a0000000-0000-4000-8000-000000000102','a0000000-0000-4000-8000-000000000202','b0000000-0000-4000-8000-000000000001','PERMANENT',72000000,'2018-03-01'),
      ('b0000000-0000-4000-8000-000000000003','MGR-2020-0001','Raden Mas Danu, S.T., M.Kom.','danu.tech@eperformiq.co.id','+62 811-0003-0003','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000203','b0000000-0000-4000-8000-000000000001','PERMANENT',68000000,'2020-02-01'),
      ('b0000000-0000-4000-8000-000000000005','AUD-2017-0005','Bambang Soeprapto, Ak., CA','bambang.audit@eperformiq.co.id','+62 811-0005-0005','a0000000-0000-4000-8000-000000000104','a0000000-0000-4000-8000-000000000205','b0000000-0000-4000-8000-000000000001','PERMANENT',70000000,'2017-07-01')
    ON CONFLICT (id) DO NOTHING;

    -- Level 3: Individual Contributors (reports to Danu or Siti)
    INSERT INTO employees (id, employee_code, full_name, email, phone_number,
                           department_id, position_id, manager_id, status,
                           base_salary, join_date) VALUES
      ('b0000000-0000-4000-8000-000000000004','EMP-2022-0042','Budi Pratama','budi.pratama@eperformiq.co.id','+62 812-8899-1024','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000204','b0000000-0000-4000-8000-000000000003','PERMANENT',28500000,'2022-03-15'),
      ('b0000000-0000-4000-8000-000000000006','ADM-2023-0006','Rina Kusuma','admin@eperformiq.co.id','+62 811-0006-0006','a0000000-0000-4000-8000-000000000102','a0000000-0000-4000-8000-000000000206','b0000000-0000-4000-8000-000000000002','PERMANENT',22000000,'2023-05-10'),
      ('b0000000-0000-4000-8000-000000000007','EMP-2023-0108','Anisa Wijaya, S.Ds.','anisa.wijaya@eperformiq.co.id','+62 813-7766-3321','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000204','b0000000-0000-4000-8000-000000000003','PERMANENT',18000000,'2023-01-10'),
      ('b0000000-0000-4000-8000-000000000008','EMP-2021-0089','Dimas Prasetyo, S.Kom.','dimas.prasetyo@eperformiq.co.id','+62 811-9922-4411','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000204','b0000000-0000-4000-8000-000000000003','PERMANENT',24000000,'2021-06-01'),
      ('b0000000-0000-4000-8000-000000000009','EMP-2024-0230','Rian Hidayat, S.Kom.','rian.hidayat@eperformiq.co.id','+62 815-4433-2211','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000204','b0000000-0000-4000-8000-000000000003','PROBATION',12500000,'2024-02-15'),
      ('b0000000-0000-4000-8000-000000000010','EMP-2018-0010','Rizky Pratama, M.T.','rizky.pratama@eperformiq.co.id','+62 811-8899-7711','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000203','b0000000-0000-4000-8000-000000000001','RESIGNED',35000000,'2018-04-10'),
      ('b0000000-0000-4000-8000-000000000011','ASR-2020-0011','Dr. Aris Wicaksono, M.Psi.','aris.assessor@eperformiq.co.id','+62 811-0007-0007','a0000000-0000-4000-8000-000000000105','a0000000-0000-4000-8000-000000000207','b0000000-0000-4000-8000-000000000001','PERMANENT',75000000,'2020-05-01')
    ON CONFLICT (id) DO NOTHING;

    -- Users (7 roles)
    INSERT INTO users (id, employee_id, email, password_hash, role, is_active) VALUES
      ('e0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','hendra.gunawan@eperformiq.co.id','${hash}','BOD',TRUE),
      ('e0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','siti.nurhaliza@eperformiq.co.id','${hash}','HR_MANAGER',TRUE),
      ('e0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000003','danu.tech@eperformiq.co.id','${hash}','PEOPLE_MANAGER',TRUE),
      ('e0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000004','budi.pratama@eperformiq.co.id','${hash}','EMPLOYEE',TRUE),
      ('e0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000005','bambang.audit@eperformiq.co.id','${hash}','AUDITOR',TRUE),
      ('e0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000006','admin@eperformiq.co.id','${hash}','SUPER_ADMIN',TRUE),
      ('e0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000011','aris.assessor@eperformiq.co.id','${hash}','ASSESSOR',TRUE)
    ON CONFLICT (id) DO NOTHING;

    -- Strategic Pillars (BSC 4 Perspektif, sum = 100)
    INSERT INTO strategic_pillars (id, company_id, perspective, pillar_name, description, strategic_weight) VALUES
      ('c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','FINANCIAL','Pertumbuhan Pendapatan Berkelanjutan & Efisiensi Anggaran','Optimalisasi realisasi anggaran formasi MPP, EBITDA margin korporasi, dan efisiensi belanja operasional.',25),
      ('c0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','CUSTOMER','Kepuasan Stakeholder & Keunggulan Layanan Ekosistem','Indeks kepuasan pengguna internal (CSAT >= 85%) dan pemenuhan SLA rekrutmen tepat waktu.',25),
      ('c0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','INTERNAL_PROCESS','Keunggulan Operasional & Zero Fatal SOP Compliance','Kepatuhan tata kelola proses bisnis ISO 9001/30414, 0 fatal audit finding, keandalan sistem 99.9%.',25),
      ('c0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001','LEARNING_GROWTH','Kapabilitas Human Capital & Penguatan Budaya AKHLAK','Rata-rata 24 jam pelatihan/karyawan/tahun, retensi Top 20% Talent, dan indeks kepemimpinan 360.',25)
    ON CONFLICT (id) DO NOTHING;

    -- Corporate KPIs
    INSERT INTO corporate_kpis (id, strategic_pillar_id, period_year, kpi_code, kpi_name, target_value, unit_of_measure) VALUES
      ('c0000000-0000-4000-8000-000000000101','c0000000-0000-4000-8000-000000000001',2026,'CORP-FIN-01','Revenue Growth vs RKAP Target',15.0,'%_GROWTH'),
      ('c0000000-0000-4000-8000-000000000102','c0000000-0000-4000-8000-000000000002',2026,'CORP-CUS-01','Internal CSAT & NPS Score',90.0,'%_SCORE'),
      ('c0000000-0000-4000-8000-000000000103','c0000000-0000-4000-8000-000000000003',2026,'CORP-INT-01','Zero Fatal SOP & Operational SLA Adherence',98.0,'%_SLA'),
      ('c0000000-0000-4000-8000-000000000104','c0000000-0000-4000-8000-000000000004',2026,'CORP-LRN-01','Training Hours & Talent Retention Rate',24.0,'JAM/TAHUN')
    ON CONFLICT (id) DO NOTHING;

    -- Division KPIs (Engineering)
    INSERT INTO division_kpis (id, corporate_kpi_id, department_id, kpi_title, weight_pct, target_value) VALUES
      ('c0000000-0000-4000-8000-000000000201','c0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000101','Cost Efficiency IT Infrastructure per Transaction',25,100),
      ('c0000000-0000-4000-8000-000000000202','c0000000-0000-4000-8000-000000000102','a0000000-0000-4000-8000-000000000101','System Uptime & Response Time API < 200ms',25,99.9),
      ('c0000000-0000-4000-8000-000000000203','c0000000-0000-4000-8000-000000000103','a0000000-0000-4000-8000-000000000101','Cakupan Unit Testing & SonarQube Quality Gate',25,85),
      ('c0000000-0000-4000-8000-000000000204','c0000000-0000-4000-8000-000000000104','a0000000-0000-4000-8000-000000000101','Tech Mentoring & Knowledge Sharing Sesi Bulanan',25,6)
    ON CONFLICT (id) DO NOTHING;

    -- Appraisal Period
    INSERT INTO appraisal_periods (id, period_code, start_date, end_date, status) VALUES
      ('d0000000-0000-4000-8000-000000000001','2026-Q3','2026-07-01','2026-09-30','ACTIVE'),
      ('d0000000-0000-4000-8000-000000000002','2026-Q4','2026-10-01','2026-12-31','ACTIVE')
    ON CONFLICT (id) DO NOTHING;

    -- Budi's Individual KPIs (4 KPIs, weights 30, 25, 25, 20 sum=100)
    INSERT INTO individual_kpis (id, period_id, employee_id, strategic_pillar_id, division_kpi_id, kpi_title, target_value, actual_value, unit_of_measure, kpi_weight, status, approved_by, approved_at) VALUES
      ('f0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000202','Pencapaian SLA Waktu Tanggap & Resolusi Bug Produksi Tier-1',98.0,99.2,'% On-Time SLA',30,'APPROVED','e0000000-0000-4000-8000-000000000003','2026-07-10T08:00:00Z'),
      ('f0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000201','Optimasi Efisiensi Arsitektur Cloud & Penurunan Server Latency',200.0,185.0,'ms Latency',25,'APPROVED','e0000000-0000-4000-8000-000000000003','2026-07-10T08:00:00Z'),
      ('f0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000203','Cakupan Unit Testing & Kepatuhan SonarQube Quality Gate',85.0,88.5,'% Code Coverage',25,'APPROVED','e0000000-0000-4000-8000-000000000003','2026-07-10T08:00:00Z'),
      ('f0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000204','Mentoring Junior Developer & Pelaksanaan Tech Talk Bulanan',6.0,5.0,'Sesi',20,'APPROVED','e0000000-0000-4000-8000-000000000003','2026-07-10T08:00:00Z')
    ON CONFLICT (id) DO NOTHING;

    -- SOP logs
    INSERT INTO sop_compliance_logs (id, period_id, employee_id, total_assigned_tasks, sla_breach_count, procedure_errors, compliance_percentage, internal_audit_findings) VALUES
      ('10000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004',142,1,0,99.30,'Zero Non-Conformance (Audited ISO 27001)')
    ON CONFLICT (id) DO NOTHING;

    -- Competency Scores
    INSERT INTO competency_scores (id, period_id, employee_id, skill_name, skill_category, required_level, actual_level, score) VALUES
      ('20000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004','Cloud Native Architecture','HARD',4,4,85.00),
      ('20000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004','Cross-Functional Collaboration','SOFT',4,4,85.00)
    ON CONFLICT (id) DO NOTHING;

    -- Peer Reviews 360
    INSERT INTO peer_reviews_360 (id, period_id, evaluatee_id, evaluator_id, relationship_type, integrity_score, collaboration_score, innovation_score, feedback_notes) VALUES
      ('30000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000003','SUPERVISOR',4.8,4.5,4.2,'Kepemimpinan teknis sangat solid dalam arsitektur cloud microservices.')
    ON CONFLICT (id) DO NOTHING;

    -- Budi's Performance Appraisal (PRD §11.3 values)
    INSERT INTO performance_appraisals (id, period_id, employee_id, kpi_composite_score, sop_compliance_score, competency_score, core_values_score, total_percentage_score, composite_gpa, performance_rating, potential_score, nine_box_quadrant, is_calibrated, calibrated_by, calibrated_at, calibration_notes) VALUES
      ('40000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004',92.50,96.00,85.00,90.00,91.70,3.67,'A',4.20,'FUTURE_LEADER',TRUE,'e0000000-0000-4000-8000-000000000002','2026-09-18T10:00:00Z','Dikalibrasi oleh Komite Kinerja Human Capital')
    ON CONFLICT (id) DO NOTHING;

    -- Initial Audit Log
    INSERT INTO audit_logs (user_id, action_type, entity_name, record_id, description) VALUES
      ('e0000000-0000-4000-8000-000000000006','CREATE','system','init','Seed inisialisasi basis data sistem E-PerformIQ v1.0.0')
    ON CONFLICT DO NOTHING;

    -- ================= 9 TABEL TAMBAHAN (Pre-Emp, Post-Emp, VMAI) =================
    -- 1. Manpower Plans
    INSERT INTO manpower_plans (id, department_id, position_id, fiscal_year, approved_quota, allocated_budget, utilized_budget, hired_count) VALUES
      ('50000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000204',2026,10,1200000000,960000000,8),
      ('50000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000102','a0000000-0000-4000-8000-000000000206',2026,5,550000000,530000000,5),
      ('50000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000104','a0000000-0000-4000-8000-000000000205',2026,4,480000000,350000000,3)
    ON CONFLICT (id) DO NOTHING;

    -- 2. Hiring Requisitions
    INSERT INTO hiring_requisitions (id, manpower_plan_id, requisition_code, requested_date, approved_date, sla_target_days) VALUES
      ('51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','FPTK-2026-ENG-001','2026-06-01','2026-06-05',30),
      ('51000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','FPTK-2026-HC-002','2026-06-10','2026-06-12',25),
      ('51000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000003','FPTK-2026-SPI-003','2026-06-15','2026-06-18',35)
    ON CONFLICT (id) DO NOTHING;

    -- 3. Recruitment Assessments
    INSERT INTO recruitment_assessments (id, candidate_name, applied_position_id, hiring_requisition_id, psychometric_score, technical_test_score, competency_interview_score, computed_qoh_score, recruitment_cost, time_to_fill_days, hiring_status) VALUES
      ('52000000-0000-4000-8000-000000000001','Annisa Rahmawati, S.Kom.','a0000000-0000-4000-8000-000000000204','51000000-0000-4000-8000-000000000001',88.00,92.50,86.00,88.80,6500000,22,'HIRED'),
      ('52000000-0000-4000-8000-000000000002','Bambang Wicaksono, S.T.','a0000000-0000-4000-8000-000000000204','51000000-0000-4000-8000-000000000001',90.00,94.00,89.00,91.00,8200000,28,'OFFERED'),
      ('52000000-0000-4000-8000-000000000003','Citra Melinda, CFA','a0000000-0000-4000-8000-000000000205','51000000-0000-4000-8000-000000000003',78.00,82.00,80.00,80.00,7000000,35,'INTERVIEWED')
    ON CONFLICT (id) DO NOTHING;

    -- 4. Onboarding Milestones (Rian Hidayat)
    INSERT INTO onboarding_milestones (id, employee_id, day_30_score, day_60_score, day_90_score, manager_notes, probation_passed, conversion_date) VALUES
      ('53000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000009',88.00,86.50,89.00,'Adaptasi budaya sangat cepat. Pemahaman arsitektur komponen sangat matang. Direkomendasikan konversi ke Karyawan Tetap (PKWTT).',TRUE,'2026-10-01')
    ON CONFLICT (id) DO NOTHING;

    -- 5. Offboarding Requests (Rizky Pratama)
    INSERT INTO offboarding_requests (id, employee_id, reason_for_leaving, resignation_notice_date, last_working_day, is_regrettable_attrition, status) VALUES
      ('60000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000010','Melanjutkan Studi Doktoral (S3) Luar Negeri','2026-08-30','2026-09-30',TRUE,'CLEARANCE_IN_PROGRESS')
    ON CONFLICT (id) DO NOTHING;

    -- 6. Knowledge & Asset Handovers
    INSERT INTO knowledge_handovers (id, offboarding_request_id, handover_item_name, category, handover_to_employee_id, is_verified, verified_by, verified_at) VALUES
      ('61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','Arsitektur & Kredensial AWS Cloud Production (KMS & Root Access)','ACCESS_KEY','b0000000-0000-4000-8000-000000000004',TRUE,'b0000000-0000-4000-8000-000000000003','2026-09-18T16:00:00Z'),
      ('61000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001','Dokumentasi Blueprint Sistem Enterprise E-PerformIQ v1.0','DOCUMENTATION','b0000000-0000-4000-8000-000000000004',TRUE,'b0000000-0000-4000-8000-000000000003','2026-09-19T09:30:00Z'),
      ('61000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000001','Pengembalian Laptop MacBook Pro M3 Max & ID Card Akses Gedung','PHYSICAL_ASSET','b0000000-0000-4000-8000-000000000006',FALSE,NULL,NULL)
    ON CONFLICT (id) DO NOTHING;

    -- 7. Severance Calculations (PP 35/2021)
    INSERT INTO severance_calculations (id, offboarding_request_id, service_years, base_salary, severance_pay, service_appreciation_pay, compensation_pay, dplk_topup_amount, total_disbursement, sla_disbursed_days, is_paid, payment_reference_no, paid_at) VALUES
      ('62000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',8,35000000,0,0,5250000,168000000,173250000,3,FALSE,NULL,NULL)
    ON CONFLICT (id) DO NOTHING;

    -- 8. Lifetime Contributions (LCI Legacy Vault)
    INSERT INTO lifetime_contributions (id, employee_id, achievement_title, achievement_type, quantified_impact_idr, points_awarded, date_achieved) VALUES
      ('63000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004','Paten Sistem Kompresi Data Log Kinerja Karyawan Berbasis Delta Z-Score','PATENT',450000000,150,'2025-11-12'),
      ('63000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000004','Kaizen Inovasi: Otomatisasi Pipeline CI/CD Mengurangi Biaya Cloud 30%','KAIZEN_SAVING',280000000,100,'2026-04-18'),
      ('63000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000010','Arsitektur Enterprise Core Service Berkecepatan 30.000 req/detik','PATENT',800000000,200,'2024-08-20')
    ON CONFLICT (id) DO NOTHING;

    -- 9. VMAI Scorecards
    INSERT INTO vmai_scorecards (id, period_id, overall_vmai_score, alignment_status, financial_pillar_score, customer_pillar_score, internal_pillar_score, growth_pillar_score, gcg_compliance_factor, benchmark_deviation) VALUES
      ('70000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001',89.40,'ALIGNED',92.40,87.10,94.80,83.30,1.00,4.40)
    ON CONFLICT (id) DO NOTHING;
  `);
}

// Dijalankan langsung via `npm run db:seed`
if (process.argv[1]?.includes('seed')) {
  const client = new PGlite(process.env.PGLITE_DATA_DIR ?? '.pglite');
  runSeed(client)
    .then(async () => {
      console.log('Seed selesai.');
      await client.close();
    })
    .catch(async (err) => {
      console.error('Seed gagal:', err);
      await client.close();
      process.exit(1);
    });
}
