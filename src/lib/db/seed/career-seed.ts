/**
 * Seed data lowongan pekerjaan publik (Career Portal - /careers).
 *
 * Menghadirkan beragam lowongan lintas departemen (Teknologi, Human Capital,
 * Audit Internal, dan Komite Talenta) dengan deskripsi profesional, persyaratan keahlian,
 * lokasi kerja (On-site, Hybrid, Remote), tipe kontrak, kuota, serta rentang kompensasi.
 *
 * Idempoten: Menggunakan UUID deterministik + ON CONFLICT (id) DO UPDATE.
 */
import type { SqlClient } from '@/lib/db/client';

function q(v: string | null | undefined): string {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function jsonArray(values: string[]): string {
  return `'${JSON.stringify(values).replace(/'/g, "''")}'::jsonb`;
}

export interface CareerPostingSeed {
  id: string;
  departmentId: string;
  positionId: string;
  positionTitle: string;
  jobGrade: string;
  manpowerPlanId: string;
  postingTitle: string;
  description: string;
  requiredSkills: string[];
  minEducation: string;
  minExperienceYears: number;
  workLocation: string;
  employmentType: string;
  quota: number;
  hired: number;
  salaryMin: number;
  salaryMax: number;
  status: 'OPEN' | 'FILLED' | 'CLOSED';
}

const DEPT_IT = 'a0000000-0000-4000-8000-000000000101';
const DEPT_HC = 'a0000000-0000-4000-8000-000000000102';
const DEPT_SPI = 'a0000000-0000-4000-8000-000000000104';
const DEPT_KALIBRASI = 'a0000000-0000-4000-8000-000000000105';

export const CAREER_POSTINGS: CareerPostingSeed[] = [
  {
    id: '87000000-0000-4000-8000-000000000001',
    departmentId: DEPT_IT,
    positionId: 'a0000000-0000-4000-8000-000000000204',
    positionTitle: 'Senior Software Engineer',
    jobGrade: '4',
    manpowerPlanId: '50000000-0000-4000-8000-000000000001',
    postingTitle: 'Senior Software Engineer (Full Stack Next.js & TypeScript)',
    description: 'Kami mencari Senior Full Stack Engineer berpengalaman untuk memimpin pengembangan arsitektur HR Command Center, analitik performa eksekutif, dan sistem otomatisasi tata kelola enterprise berbasis Next.js 14, TypeScript, dan PostgreSQL.',
    requiredSkills: ['Next.js', 'TypeScript', 'React', 'PostgreSQL', 'Tailwind CSS', 'Docker', 'REST API'],
    minEducation: 'S1',
    minExperienceYears: 3,
    workLocation: 'Jakarta Selatan (Hybrid)',
    employmentType: 'TETAP (PKWTT)',
    quota: 5,
    hired: 2,
    salaryMin: 22000000,
    salaryMax: 32000000,
    status: 'OPEN',
  },
  {
    id: '87000000-0000-4000-8000-000000000002',
    departmentId: DEPT_IT,
    positionId: 'a0000000-0000-4000-8000-000000000210',
    positionTitle: 'Lead Cloud & DevOps Engineer',
    jobGrade: '3',
    manpowerPlanId: '50000000-0000-4000-8000-000000000010',
    postingTitle: 'Lead Cloud Infrastructure & DevOps Engineer',
    description: 'Bertanggung jawab atas keandalan infrastruktur cloud, pipeline CI/CD otomatis, container orchestration dengan Kubernetes, serta pemantauan SLA zero-downtime untuk seluruh layanan terdistribusi korporasi.',
    requiredSkills: ['Kubernetes', 'AWS', 'Docker', 'Terraform', 'CI/CD Pipeline', 'Linux', 'Prometheus'],
    minEducation: 'S1',
    minExperienceYears: 4,
    workLocation: 'Jakarta Selatan (Hybrid)',
    employmentType: 'TETAP (PKWTT)',
    quota: 3,
    hired: 1,
    salaryMin: 24000000,
    salaryMax: 36000000,
    status: 'OPEN',
  },
  {
    id: '87000000-0000-4000-8000-000000000003',
    departmentId: DEPT_IT,
    positionId: 'a0000000-0000-4000-8000-000000000211',
    positionTitle: 'Lead UI/UX & Product Designer',
    jobGrade: '3',
    manpowerPlanId: '50000000-0000-4000-8000-000000000011',
    postingTitle: 'Lead UI/UX Designer & Design Systems Specialist',
    description: 'Mengembangkan standar desain antarmuka enterprise kelas dunia, memelihara design system berbasis token, memimpin riset pengalaman pengguna, dan memastikan aksesibilitas (WCAG) pada portal web dan mobile.',
    requiredSkills: ['Figma', 'Design Systems', 'User Research', 'Prototyping', 'WCAG Accessibility', 'Micro-interactions'],
    minEducation: 'S1',
    minExperienceYears: 3,
    workLocation: 'Jakarta Selatan (Hybrid)',
    employmentType: 'TETAP (PKWTT)',
    quota: 2,
    hired: 0,
    salaryMin: 18000000,
    salaryMax: 26000000,
    status: 'OPEN',
  },
  {
    id: '87000000-0000-4000-8000-000000000004',
    departmentId: DEPT_IT,
    positionId: 'a0000000-0000-4000-8000-000000000212',
    positionTitle: 'Data Engineer & Analytics Specialist',
    jobGrade: '4',
    manpowerPlanId: '50000000-0000-4000-8000-000000000012',
    postingTitle: 'Data Engineer & Business Intelligence Lead',
    description: 'Membangun pipeline ingestion data real-time, data warehouse analitik talenta & payroll, integrasi lakehouse, serta pemodelan dashboard metrik kinerja BSC untuk level direksi (C-Level).',
    requiredSkills: ['Python', 'SQL', 'Data Warehousing', 'Apache Kafka', 'PostgreSQL', 'dbt', 'Metabase'],
    minEducation: 'S1',
    minExperienceYears: 2,
    workLocation: 'Jakarta Selatan (Hybrid)',
    employmentType: 'TETAP (PKWTT)',
    quota: 4,
    hired: 1,
    salaryMin: 16000000,
    salaryMax: 24000000,
    status: 'OPEN',
  },
  {
    id: '87000000-0000-4000-8000-000000000005',
    departmentId: DEPT_HC,
    positionId: 'a0000000-0000-4000-8000-000000000206',
    positionTitle: 'HR System Administrator',
    jobGrade: '3',
    manpowerPlanId: '50000000-0000-4000-8000-000000000002',
    postingTitle: 'HR System Administrator & People Analytics',
    description: 'Mengelola operasional HRIS enterprise, konfigurasi workflow persetujuan absensi & lembur, pemeliharaan master data karyawan, serta penyusunan laporan analitik perputaran talenta (flight risk).',
    requiredSkills: ['HRIS', 'People Analytics', 'SQL', 'Advanced Excel', 'UU Ketenagakerjaan', 'Data Governance'],
    minEducation: 'S1',
    minExperienceYears: 2,
    workLocation: 'Jakarta Pusat (On-site)',
    employmentType: 'TETAP (PKWTT)',
    quota: 3,
    hired: 1,
    salaryMin: 12000000,
    salaryMax: 18000000,
    status: 'OPEN',
  },
  {
    id: '87000000-0000-4000-8000-000000000006',
    departmentId: DEPT_HC,
    positionId: 'a0000000-0000-4000-8000-000000000213',
    positionTitle: 'Senior Talent Acquisition Lead',
    jobGrade: '3',
    manpowerPlanId: '50000000-0000-4000-8000-000000000013',
    postingTitle: 'Senior Talent Acquisition & Employer Branding',
    description: 'Memimpin end-to-end recruitment untuk posisi strategis dan teknologi, menyusun strategi employer branding di kampus dan platform profesional, serta memastikan SLA pemenuhan headcount tercapai dengan kualitas prima.',
    requiredSkills: ['Technical Sourcing', 'Behavioral Interview', 'Employer Branding', 'Applicant Tracking System (ATS)', 'Headhunting'],
    minEducation: 'S1',
    minExperienceYears: 3,
    workLocation: 'Jakarta Pusat (Hybrid)',
    employmentType: 'TETAP (PKWTT)',
    quota: 2,
    hired: 0,
    salaryMin: 14000000,
    salaryMax: 20000000,
    status: 'OPEN',
  },
  {
    id: '87000000-0000-4000-8000-000000000007',
    departmentId: DEPT_HC,
    positionId: 'a0000000-0000-4000-8000-000000000214',
    positionTitle: 'Learning & Organizational Development Specialist',
    jobGrade: '4',
    manpowerPlanId: '50000000-0000-4000-8000-000000000014',
    postingTitle: 'People Development & Organizational Learning Lead',
    description: 'Menganalisis kebutuhan pelatihan organisasi (TNA), mendesain kurikulum pelatihan kompetensi teknis dan kepemimpinan, mengelola platform e-learning, serta mengevaluasi efektivitas pelatihan dengan model Kirkpatrick.',
    requiredSkills: ['Training Need Analysis', 'Curriculum Design', 'LMS Management', 'Leadership Development', 'Kirkpatrick Model'],
    minEducation: 'S1',
    minExperienceYears: 2,
    workLocation: 'Jakarta Pusat (Hybrid)',
    employmentType: 'KONTRAK (PKWT)',
    quota: 3,
    hired: 1,
    salaryMin: 11000000,
    salaryMax: 16000000,
    status: 'OPEN',
  },
  {
    id: '87000000-0000-4000-8000-000000000008',
    departmentId: DEPT_SPI,
    positionId: 'a0000000-0000-4000-8000-000000000205',
    positionTitle: 'Chief Internal Auditor',
    jobGrade: '2',
    manpowerPlanId: '50000000-0000-4000-8000-000000000003',
    postingTitle: 'Senior Internal Auditor (Operasional & Sistem Informasi)',
    description: 'Melaksanakan audit berbasis risiko (risk-based audit) terhadap proses operasional, keuangan, dan tata kelola TI perusahaan, menyusun kertas kerja audit, serta mengawal tindak lanjut temuan kepatuhan GCG.',
    requiredSkills: ['Risk-Based Auditing', 'COSO Internal Control', 'Information System Audit', 'Fraud Investigation', 'Audit Reporting'],
    minEducation: 'S1',
    minExperienceYears: 4,
    workLocation: 'Jakarta Pusat (On-site)',
    employmentType: 'TETAP (PKWTT)',
    quota: 3,
    hired: 1,
    salaryMin: 17000000,
    salaryMax: 25000000,
    status: 'OPEN',
  },
  {
    id: '87000000-0000-4000-8000-000000000009',
    departmentId: DEPT_SPI,
    positionId: 'a0000000-0000-4000-8000-000000000215',
    positionTitle: 'Risk & Governance Compliance Analyst',
    jobGrade: '4',
    manpowerPlanId: '50000000-0000-4000-8000-000000000015',
    postingTitle: 'Risk Management & Corporate Governance Analyst',
    description: 'Membantu identifikasi profil risiko korporat, penyusunan register risiko unit bisnis, pengawasan kepatuhan regulasi Good Corporate Governance (GCG), serta mitigasi risiko kepatuhan operasional.',
    requiredSkills: ['ISO 31000 Risk Management', 'Risk Register', 'GCG Assessment', 'Compliance Analysis', 'Business Continuity Plan'],
    minEducation: 'S1',
    minExperienceYears: 2,
    workLocation: 'Jakarta Pusat (On-site)',
    employmentType: 'TETAP (PKWTT)',
    quota: 2,
    hired: 0,
    salaryMin: 13000000,
    salaryMax: 19000000,
    status: 'OPEN',
  },
  {
    id: '87000000-0000-4000-8000-000000000010',
    departmentId: DEPT_KALIBRASI,
    positionId: 'a0000000-0000-4000-8000-000000000207',
    positionTitle: 'Lead Talent Assessor & Facilitator',
    jobGrade: '2',
    manpowerPlanId: '50000000-0000-4000-8000-000000000016',
    postingTitle: 'Talent Assessor & Succession Planning Specialist',
    description: 'Memfasilitasi sesi kalibrasi matriks 9-Box pimpinan divisi, menyusun profil gap kompetensi suksesor posisi kunci, serta merumuskan Individual Development Plan (IDP) bagi talenta berpotensi tinggi (HiPo).',
    requiredSkills: ['9-Box Matrix', 'Assessment Center', 'Competency Mapping', 'Succession Pipeline', 'Facilitation & Coaching'],
    minEducation: 'S1',
    minExperienceYears: 3,
    workLocation: 'Jakarta Pusat (Hybrid)',
    employmentType: 'TETAP (PKWTT)',
    quota: 2,
    hired: 1,
    salaryMin: 16000000,
    salaryMax: 23000000,
    status: 'OPEN',
  },
  {
    id: '87000000-0000-4000-8000-000000000011',
    departmentId: DEPT_IT,
    positionId: 'a0000000-0000-4000-8000-000000000216',
    positionTitle: 'Mobile Application Developer',
    jobGrade: '4',
    manpowerPlanId: '50000000-0000-4000-8000-000000000017',
    postingTitle: 'Mobile Developer (React Native & Mobile Performance)',
    description: 'Mengembangkan aplikasi Employee Portal versi mobile untuk absensi berbasis GPS & biometrik, pengajuan cuti instan, slip gaji terenkripsi, serta integrasi push notification dengan pengalaman pengguna yang sangat mulus.',
    requiredSkills: ['React Native', 'TypeScript', 'Mobile Performance', 'REST API', 'Expo', 'iOS / Android Native Modules'],
    minEducation: 'S1',
    minExperienceYears: 2,
    workLocation: 'Bandung (Remote / WFH)',
    employmentType: 'KONTRAK (PKWT)',
    quota: 3,
    hired: 1,
    salaryMin: 14000000,
    salaryMax: 21000000,
    status: 'OPEN',
  },
  {
    id: '87000000-0000-4000-8000-000000000012',
    departmentId: DEPT_IT,
    positionId: 'a0000000-0000-4000-8000-000000000217',
    positionTitle: 'Cyber Security & IT Governance Specialist',
    jobGrade: '3',
    manpowerPlanId: '50000000-0000-4000-8000-000000000018',
    postingTitle: 'Cyber Security & Information Protection Lead',
    description: 'Menjaga keamanan data sensitif perusahaan, melaksanakan vulnerability assessment dan penetrasi berkala, audit kepatuhan ISO 27001 dan UU Perlindungan Data Pribadi (UU PDP), serta merespons insiden siber.',
    requiredSkills: ['Penetration Testing', 'ISO 27001', 'UU PDP Compliance', 'OWASP Top 10', 'Incident Response', 'Network Security'],
    minEducation: 'S1',
    minExperienceYears: 3,
    workLocation: 'Jakarta Selatan (Hybrid)',
    employmentType: 'TETAP (PKWTT)',
    quota: 2,
    hired: 0,
    salaryMin: 20000000,
    salaryMax: 30000000,
    status: 'OPEN',
  },
  {
    id: '87000000-0000-4000-8000-000000000013',
    departmentId: DEPT_HC,
    positionId: 'a0000000-0000-4000-8000-000000000218',
    positionTitle: 'Compensation & Benefit Specialist',
    jobGrade: '4',
    manpowerPlanId: '50000000-0000-4000-8000-000000000019',
    postingTitle: 'Compensation, Benefit & Total Rewards Specialist',
    description: 'Mengelola perhitungan payroll bulanan, simulasi perhitungan PPh 21 TER, rekonsiliasi iuran BPJS Ketenagakerjaan & BPJS Kesehatan, analisis survei gaji industri, serta struktur skala upah perusahaan.',
    requiredSkills: ['Payroll Administration', 'PPh 21 TER', 'BPJS Kesehatan & Ketenagakerjaan', 'Salary Structure', 'Excel Modeling'],
    minEducation: 'S1',
    minExperienceYears: 3,
    workLocation: 'Jakarta Pusat (On-site)',
    employmentType: 'TETAP (PKWTT)',
    quota: 2,
    hired: 0,
    salaryMin: 13000000,
    salaryMax: 19000000,
    status: 'OPEN',
  },
  {
    id: '87000000-0000-4000-8000-000000000014',
    departmentId: DEPT_IT,
    positionId: 'a0000000-0000-4000-8000-000000000219',
    positionTitle: 'Junior Software Engineer (Internship)',
    jobGrade: '5',
    manpowerPlanId: '50000000-0000-4000-8000-000000000020',
    postingTitle: 'Frontend & UI Engineering Intern (Program Magang)',
    description: 'Peluang belajar dan berkontribusi langsung dalam pengembangan komponen UI modern, pengujian unit front-end, serta kolaborasi erat bersama tim software engineering dan desainer produk.',
    requiredSkills: ['JavaScript / TypeScript', 'React / Next.js Dasar', 'HTML5 & CSS3', 'Tailwind CSS', 'Git'],
    minEducation: 'D3',
    minExperienceYears: 0,
    workLocation: 'Jakarta Selatan (Hybrid)',
    employmentType: 'MAGANG (INTERNSHIP)',
    quota: 4,
    hired: 2,
    salaryMin: 4500000,
    salaryMax: 6000000,
    status: 'OPEN',
  },
  {
    id: '87000000-0000-4000-8000-000000000015',
    departmentId: DEPT_IT,
    positionId: 'a0000000-0000-4000-8000-000000000220',
    positionTitle: 'Technical Support & Operations Specialist',
    jobGrade: '5',
    manpowerPlanId: '50000000-0000-4000-8000-000000000021',
    postingTitle: 'Technical Operations & Customer Support Lead',
    description: 'Menangani eskalasi tiket bantuan teknis pengguna, monitoring ketersediaan server & database, penyusunan panduan operasional sistem (SOP), serta koordinasi pemecahan kendala pengguna enterprise.',
    requiredSkills: ['IT Helpdesk', 'SLA Management', 'SQL Troubleshooting', 'Linux Basics', 'Customer Communication'],
    minEducation: 'D3',
    minExperienceYears: 1,
    workLocation: 'Jakarta Selatan (On-site)',
    employmentType: 'KONTRAK (PKWT)',
    quota: 2,
    hired: 2,
    salaryMin: 8500000,
    salaryMax: 12000000,
    status: 'FILLED',
  },
];

export async function seedJobPostings(client: SqlClient): Promise<void> {
  // 1. Pastikan seluruh posisi jabatan tersedia
  for (const p of CAREER_POSTINGS) {
    await client.exec(`
      INSERT INTO job_positions (id, department_id, position_title, job_grade)
      VALUES (${q(p.positionId)}, ${q(p.departmentId)}, ${q(p.positionTitle)}, ${q(p.jobGrade)})
      ON CONFLICT (id) DO UPDATE SET
        department_id = EXCLUDED.department_id,
        position_title = EXCLUDED.position_title,
        job_grade = EXCLUDED.job_grade;
    `);
  }

  // 2. Pastikan manpower plan tersedia
  for (const p of CAREER_POSTINGS) {
    const totalBudget = p.quota * p.salaryMax * 12;
    const utilizedBudget = p.hired * p.salaryMin * 12;
    await client.exec(`
      INSERT INTO manpower_plans (
        id, department_id, position_id, fiscal_year, approved_quota,
        allocated_budget, utilized_budget, hired_count
      )
      VALUES (
        ${q(p.manpowerPlanId)}, ${q(p.departmentId)}, ${q(p.positionId)}, 2026, ${p.quota},
        ${totalBudget}, ${utilizedBudget}, ${p.hired}
      )
      ON CONFLICT (id) DO UPDATE SET
        department_id = EXCLUDED.department_id,
        position_id = EXCLUDED.position_id,
        approved_quota = EXCLUDED.approved_quota,
        hired_count = EXCLUDED.hired_count;
    `);
  }

  // 3. Masukkan / perbarui seluruh data lowongan pekerjaan publik
  for (const p of CAREER_POSTINGS) {
    await client.exec(`
      INSERT INTO job_postings (
        id, manpower_plan_id, position_id, department_id, posting_title,
        description, required_skills, is_internal_only, is_public, status,
        min_education, min_experience_years, work_location, salary_min, salary_max,
        employment_type, quota, posted_at
      )
      VALUES (
        ${q(p.id)}, ${q(p.manpowerPlanId)}, ${q(p.positionId)}, ${q(p.departmentId)}, ${q(p.postingTitle)},
        ${q(p.description)}, ${jsonArray(p.requiredSkills)}, FALSE, TRUE, ${q(p.status)},
        ${q(p.minEducation)}, ${p.minExperienceYears}, ${q(p.workLocation)}, ${p.salaryMin}, ${p.salaryMax},
        ${q(p.employmentType)}, ${p.quota}, CURRENT_TIMESTAMP - INTERVAL '5 days'
      )
      ON CONFLICT (id) DO UPDATE SET
        department_id = EXCLUDED.department_id,
        position_id = EXCLUDED.position_id,
        manpower_plan_id = EXCLUDED.manpower_plan_id,
        posting_title = EXCLUDED.posting_title,
        description = EXCLUDED.description,
        required_skills = EXCLUDED.required_skills,
        is_internal_only = EXCLUDED.is_internal_only,
        is_public = TRUE,
        status = EXCLUDED.status,
        min_education = EXCLUDED.min_education,
        min_experience_years = EXCLUDED.min_experience_years,
        work_location = EXCLUDED.work_location,
        salary_min = EXCLUDED.salary_min,
        salary_max = EXCLUDED.salary_max,
        employment_type = EXCLUDED.employment_type,
        quota = EXCLUDED.quota;
    `);
  }
}
