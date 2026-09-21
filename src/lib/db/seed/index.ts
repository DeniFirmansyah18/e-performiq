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
      ('a0000000-0000-4000-8000-000000000104','a0000000-0000-4000-8000-000000000001','Satuan Pengawas Internal (SPI)','Corporate')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO job_positions (id, department_id, position_title, job_grade) VALUES
      ('a0000000-0000-4000-8000-000000000201','a0000000-0000-4000-8000-000000000103','Chief Executive Officer (CEO)','1'),
      ('a0000000-0000-4000-8000-000000000202','a0000000-0000-4000-8000-000000000102','VP of Human Capital','2'),
      ('a0000000-0000-4000-8000-000000000203','a0000000-0000-4000-8000-000000000101','Head of Engineering & Ops','2'),
      ('a0000000-0000-4000-8000-000000000204','a0000000-0000-4000-8000-000000000101','Senior Software Engineer','4'),
      ('a0000000-0000-4000-8000-000000000205','a0000000-0000-4000-8000-000000000104','Chief Internal Auditor','2'),
      ('a0000000-0000-4000-8000-000000000206','a0000000-0000-4000-8000-000000000102','HR System Administrator','3')
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
      ('b0000000-0000-4000-8000-000000000009','EMP-2024-0230','Rian Hidayat, S.Kom.','rian.hidayat@eperformiq.co.id','+62 815-4433-2211','a0000000-0000-4000-8000-000000000101','a0000000-0000-4000-8000-000000000204','b0000000-0000-4000-8000-000000000003','CONTRACT',12500000,'2024-02-15')
    ON CONFLICT (id) DO NOTHING;

    -- Users (6 roles)
    INSERT INTO users (id, employee_id, email, password_hash, role, is_active) VALUES
      ('e0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','hendra.gunawan@eperformiq.co.id','${hash}','BOD',TRUE),
      ('e0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','siti.nurhaliza@eperformiq.co.id','${hash}','HR_MANAGER',TRUE),
      ('e0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000003','danu.tech@eperformiq.co.id','${hash}','PEOPLE_MANAGER',TRUE),
      ('e0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000004','budi.pratama@eperformiq.co.id','${hash}','EMPLOYEE',TRUE),
      ('e0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000005','bambang.audit@eperformiq.co.id','${hash}','AUDITOR',TRUE),
      ('e0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000006','admin@eperformiq.co.id','${hash}','SUPER_ADMIN',TRUE)
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
      ('d0000000-0000-4000-8000-000000000001','2026-Q3','2026-07-01','2026-09-30','ACTIVE')
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
