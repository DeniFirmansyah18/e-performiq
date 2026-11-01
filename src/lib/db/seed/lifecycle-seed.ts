/**
 * Seed skenario siklus hidup karyawan end-to-end:
 * rekrutmen kandidat -> fase sebelum kerja -> saat kerja -> setelah kerja -> pensiun.
 *
 * Semua baris memakai id UUID tetap + ON CONFLICT DO NOTHING sehingga idempoten.
 * Setiap tabel di-INSERT lewat satu `exec` terpisah karena PGlite hanya
 * menerapkan statement pertama pada batch multi-statement.
 */

import type { SqlClient } from '../client';

export interface LifecycleSeedOptions {
  /** Hash password demo (bcrypt) — dipakai untuk akun kandidat & registrasi mandiri. */
  hash: string;
}

function q(v: string | null | undefined): string {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Kolom created_at dipakai berulang; bantu bentuk literal. */
const ts = (v: string) => q(v) + '::timestamptz';
const dt = (v: string) => q(v) + '::date';

// ---------------------------------------------------------------------------
// Id tetap (prefix yang belum terpakai oleh seed utama)
// ---------------------------------------------------------------------------
const ID = {
  // Kandidat & akun portal
  acct1: '11000000-0000-4000-8000-000000000001',
  acct2: '11000000-0000-4000-8000-000000000002',
  acct3: '11000000-0000-4000-8000-000000000003',
  cand1: '11000000-0000-4000-8000-000000000011',
  cand2: '11000000-0000-4000-8000-000000000012',
  cand3: '11000000-0000-4000-8000-000000000013',
  app1: '11000000-0000-4000-8000-000000000021',
  app2: '11000000-0000-4000-8000-000000000022',
  app3: '11000000-0000-4000-8000-000000000023',
  intv1: '11000000-0000-4000-8000-000000000031',
  intv2: '11000000-0000-4000-8000-000000000032',
  intv3: '11000000-0000-4000-8000-000000000033',
  eval1: '11000000-0000-4000-8000-000000000041',
  attempt1: '11000000-0000-4000-8000-000000000051',
  attempt2: '11000000-0000-4000-8000-000000000052',
  score1: '11000000-0000-4000-8000-000000000061',
  score2: '11000000-0000-4000-8000-000000000062',
  dec1: '11000000-0000-4000-8000-000000000071',
  dec2: '11000000-0000-4000-8000-000000000072',
  offer1: '11000000-0000-4000-8000-000000000081',
  parse1: '11000000-0000-4000-8000-000000000091',
  // Karyawan baru hasil rekrutmen (fase PRE -> DURING)
  emp12: '12000000-0000-4000-8000-000000000012',
  emp13: '12000000-0000-4000-8000-000000000013',
  emp14: '12000000-0000-4000-8000-000000000014',
  onboard12: '12000000-0000-4000-8000-000000000112',
  onboard13: '12000000-0000-4000-8000-000000000113',
  // Saat kerja
  indicator1: '13000000-0000-4000-8000-000000000001',
  indicator2: '13000000-0000-4000-8000-000000000002',
  indicator3: '13000000-0000-4000-8000-000000000003',
  kpiEvidence1: '13000000-0000-4000-8000-000000000011',
  kpiEvidence2: '13000000-0000-4000-8000-000000000012',
  daily1: '13000000-0000-4000-8000-000000000021',
  daily2: '13000000-0000-4000-8000-000000000022',
  daily3: '13000000-0000-4000-8000-000000000023',
  snapshot1: '13000000-0000-4000-8000-000000000031',
  snapshot2: '13000000-0000-4000-8000-000000000032',
  attlog1: '13000000-0000-4000-8000-000000000041',
  attlog2: '13000000-0000-4000-8000-000000000042',
  attlog3: '13000000-0000-4000-8000-000000000043',
  attcorr1: '13000000-0000-4000-8000-000000000051',
  letter1: '13000000-0000-4000-8000-000000000061',
  letter2: '13000000-0000-4000-8000-000000000062',
  disposition1: '13000000-0000-4000-8000-000000000071',
  policy1: '13000000-0000-4000-8000-000000000081',
  policy2: '13000000-0000-4000-8000-000000000082',
  disciplinary1: '13000000-0000-4000-8000-000000000091',
  recognition1: '13000000-0000-4000-8000-000000000101',
  recognition2: '13000000-0000-4000-8000-000000000102',
  ladder1: '13000000-0000-4000-8000-000000000111',
  ladder2: '13000000-0000-4000-8000-000000000112',
  salary1: '13000000-0000-4000-8000-000000000121',
  salary2: '13000000-0000-4000-8000-000000000122',
  salary3: '13000000-0000-4000-8000-000000000123',
  salary4: '13000000-0000-4000-8000-000000000124',
  holiday1: '13000000-0000-4000-8000-000000000131',
  holiday2: '13000000-0000-4000-8000-000000000132',
  holiday3: '13000000-0000-4000-8000-000000000133',
  conv1: '13000000-0000-4000-8000-000000000141',
  msg1: '13000000-0000-4000-8000-000000000151',
  msg2: '13000000-0000-4000-8000-000000000152',
  notif1: '13000000-0000-4000-8000-000000000161',
  notif2: '13000000-0000-4000-8000-000000000162',
  insight1: '13000000-0000-4000-8000-000000000171',
  flight1: '13000000-0000-4000-8000-000000000181',
  idea1: '13000000-0000-4000-8000-000000000191',
  sopMetric1: '13000000-0000-4000-8000-000000000201',
  gpaJob1: '13000000-0000-4000-8000-000000000211',
  finalization1: '13000000-0000-4000-8000-000000000221',
  competency1: '13000000-0000-4000-8000-000000000231',
  completion1: '13000000-0000-4000-8000-000000000241',
  // Setelah kerja / pensiun
  emp15: '14000000-0000-4000-8000-000000000015',
  offboard15: '14000000-0000-4000-8000-000000000101',
  exit1: '14000000-0000-4000-8000-000000000111',
  exit2: '14000000-0000-4000-8000-000000000112',
  empDoc1: '14000000-0000-4000-8000-000000000121',
  empDoc2: '14000000-0000-4000-8000-000000000122',
  empDoc3: '14000000-0000-4000-8000-000000000123',
  reg1: '14000000-0000-4000-8000-000000000131',
  reg2: '14000000-0000-4000-8000-000000000132',
} as const;

// Referensi tetap milik seed utama.
const USER = {
  hendra: 'e0000000-0000-4000-8000-000000000001',
  siti: 'e0000000-0000-4000-8000-000000000002',
  danu: 'e0000000-0000-4000-8000-000000000003',
  budi: 'e0000000-0000-4000-8000-000000000004',
  bambang: 'e0000000-0000-4000-8000-000000000005',
  rina: 'e0000000-0000-4000-8000-000000000006',
} as const;

const EMP = {
  hendra: 'b0000000-0000-4000-8000-000000000001',
  siti: 'b0000000-0000-4000-8000-000000000002',
  danu: 'b0000000-0000-4000-8000-000000000003',
  budi: 'b0000000-0000-4000-8000-000000000004',
  bambang: 'b0000000-0000-4000-8000-000000000005',
  rina: 'b0000000-0000-4000-8000-000000000006',
  anisa: 'b0000000-0000-4000-8000-000000000007',
  dimas: 'b0000000-0000-4000-8000-000000000008',
  rian: 'b0000000-0000-4000-8000-000000000009',
  rizky: 'b0000000-0000-4000-8000-000000000010',
  aris: 'b0000000-0000-4000-8000-000000000011',
} as const;

const REF = {
  company: 'a0000000-0000-4000-8000-000000000001',
  deptEngineering: 'a0000000-0000-4000-8000-000000000101',
  deptHumanCapital: 'a0000000-0000-4000-8000-000000000102',
  posSeniorSwe: 'a0000000-0000-4000-8000-000000000204',
  posHrSysAdmin: 'a0000000-0000-4000-8000-000000000206',
  posLeadTalent: 'a0000000-0000-4000-8000-000000000207',
  periodActive: 'd0000000-0000-4000-8000-000000000001',
  kpiBudi1: 'f0000000-0000-4000-8000-000000000001',
  kpiBudi2: 'f0000000-0000-4000-8000-000000000002',
  jobPosting1: '87000000-0000-4000-8000-000000000001',
  jobPosting2: '87000000-0000-4000-8000-000000000002',
  offboardRizky: '60000000-0000-4000-8000-000000000001',
  templatePsy: 'c0000000-0000-4000-8000-000000000001',
  templateTech: 'c0000000-0000-4000-8000-000000000002',
  competency1: 'a2000000-0000-4000-8000-000000000001',
  competency2: 'a2000000-0000-4000-8000-000000000002',
  badge1: 'a3000000-0000-4000-8000-000000000001',
  courseOnboarding: 'ONB-101',
} as const;

/** Sub-seeder siklus hidup. Dipanggil di akhir `runSeed`. */
export async function seedLifecycle(client: SqlClient, opts: LifecycleSeedOptions): Promise<void> {
  const hash = opts.hash;

  // -------------------------------------------------------------------------
  // FASE SEBELUM KERJA — rekrutmen & portal kandidat
  // -------------------------------------------------------------------------
  await client.exec(`INSERT INTO candidate_accounts
    (id, email, password_hash, full_name, phone, is_verified, is_active, created_at) VALUES
    (${q(ID.acct1)}, 'anggita.pratiwi@mail.com', ${q(hash)}, 'Anggita Pratiwi', '+6281234500011', TRUE, TRUE, ${ts('2026-09-02T02:10:00Z')}),
    (${q(ID.acct2)}, 'bagus.nugroho@mail.com', ${q(hash)}, 'Bagus Nugroho', '+6281234500012', TRUE, TRUE, ${ts('2026-09-05T03:25:00Z')}),
    (${q(ID.acct3)}, 'citra.dewi@mail.com', ${q(hash)}, 'Citra Dewi Lestari', '+6281234500013', FALSE, TRUE, ${ts('2026-09-11T04:40:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO candidates
    (id, full_name, email, phone, address, birth_date, education, resume_url, account_id, source, linkedin_url, summary) VALUES
    (${q(ID.cand1)}, 'Anggita Pratiwi', 'anggita.pratiwi@mail.com', '+6281234500011', 'Jl. Cikini Raya No. 24, Jakarta Pusat', '1996-04-18', 'S1 Teknik Informatika', 'https://files.eperformiq.local/cv/anggita-pratiwi.pdf', ${q(ID.acct1)}, 'PUBLIC_PORTAL', 'https://linkedin.com/in/anggita-pratiwi', 'Backend engineer 6 tahun, fokus Go dan event-driven architecture.'),
    (${q(ID.cand2)}, 'Bagus Nugroho', 'bagus.nugroho@mail.com', '+6281234500012', 'Jl. Riau No. 8, Bandung', '1993-11-02', 'S1 Sistem Informasi', 'https://files.eperformiq.local/cv/bagus-nugroho.pdf', ${q(ID.acct2)}, 'PUBLIC_PORTAL', 'https://linkedin.com/in/bagus-nugroho', 'HR operations specialist, pengalaman payroll multi-site.'),
    (${q(ID.cand3)}, 'Citra Dewi Lestari', 'citra.dewi@mail.com', '+6281234500013', 'Jl. Diponegoro No. 45, Surabaya', '1998-07-27', 'S1 Psikologi', 'https://files.eperformiq.local/cv/citra-dewi.pdf', ${q(ID.acct3)}, 'REFERRAL', NULL, 'Talent acquisition enthusiast, fresh graduate cum laude.')
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO candidate_skills (id, candidate_id, skill_name, level, years, source) VALUES
    ('11000000-0000-4000-8000-000000000101', ${q(ID.cand1)}, 'Go', 4, 5.0, 'ATS'),
    ('11000000-0000-4000-8000-000000000102', ${q(ID.cand1)}, 'PostgreSQL', 4, 4.5, 'ATS'),
    ('11000000-0000-4000-8000-000000000103', ${q(ID.cand1)}, 'Kubernetes', 3, 2.0, 'ATS'),
    ('11000000-0000-4000-8000-000000000104', ${q(ID.cand2)}, 'Payroll Administration', 5, 7.0, 'ATS'),
    ('11000000-0000-4000-8000-000000000105', ${q(ID.cand2)}, 'Excel Advanced', 4, 6.0, 'ATS'),
    ('11000000-0000-4000-8000-000000000106', ${q(ID.cand3)}, 'Interviewing', 3, 1.0, 'MANUAL')
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO candidate_educations
    (id, candidate_id, institution, degree, major, start_year, end_year, gpa) VALUES
    ('11000000-0000-4000-8000-000000000111', ${q(ID.cand1)}, 'Institut Teknologi Bandung', 'S1', 'Teknik Informatika', 2014, 2018, 3.51),
    ('11000000-0000-4000-8000-000000000112', ${q(ID.cand2)}, 'Universitas Padjadjaran', 'S1', 'Sistem Informasi', 2011, 2015, 3.28),
    ('11000000-0000-4000-8000-000000000113', ${q(ID.cand3)}, 'Universitas Airlangga', 'S1', 'Psikologi', 2016, 2020, 3.72)
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO candidate_experiences
    (id, candidate_id, company, role_title, start_date, end_date, description) VALUES
    ('11000000-0000-4000-8000-000000000121', ${q(ID.cand1)}, 'PT Nusantara Digital', 'Senior Backend Engineer', '2021-02-01', '2026-08-31', 'Memimpin migrasi 14 layanan ke arsitektur event-driven.'),
    ('11000000-0000-4000-8000-000000000122', ${q(ID.cand2)}, 'PT Sinar Manufaktur', 'HR Operations Lead', '2019-06-01', '2026-07-31', 'Mengelola payroll 1.800 karyawan di 4 lokasi pabrik.'),
    ('11000000-0000-4000-8000-000000000123', ${q(ID.cand3)}, 'PT Rekrut Cerdas', 'Talent Acquisition Intern', '2020-01-06', '2020-07-06', 'Menyaring 350 lamaran magang dan menyusun bank soal wawancara.')
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO job_applications
    (id, application_no, candidate_id, job_posting_id, cover_letter, status, applied_at) VALUES
    (${q(ID.app1)}, 'APP-20260902-ANGGITA', ${q(ID.cand1)}, ${q(REF.jobPosting1)}, 'Tertarik membangun platform data yang andal.', 'INTERVIEW', ${ts('2026-09-02T02:20:00Z')}),
    (${q(ID.app2)}, 'APP-20260905-BAGUS', ${q(ID.cand2)}, ${q(REF.jobPosting2)}, 'Ingin menstandarkan proses payroll lintas unit.', 'SCREENING', ${ts('2026-09-05T03:30:00Z')}),
    (${q(ID.app3)}, 'APP-20260911-CITRA', ${q(ID.cand3)}, ${q(REF.jobPosting2)}, 'Fresh graduate dengan pengalaman magang rekrutmen.', 'SCREENING', ${ts('2026-09-11T04:45:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO candidate_documents
    (id, candidate_id, application_id, doc_type, file_name, mime_type, file_url, created_at) VALUES
    ('11000000-0000-4000-8000-000000000131', ${q(ID.cand1)}, ${q(ID.app1)}, 'CV', 'anggita-pratiwi-cv.pdf', 'application/pdf', 'https://files.eperformiq.local/cv/anggita-pratiwi.pdf', ${ts('2026-09-03T01:00:00Z')}),
    ('11000000-0000-4000-8000-000000000132', ${q(ID.cand1)}, ${q(ID.app1)}, 'IJAZAH', 'anggita-pratiwi-ijazah.pdf', 'application/pdf', 'https://files.eperformiq.local/docs/anggita-ijazah.pdf', ${ts('2026-09-03T01:05:00Z')}),
    ('11000000-0000-4000-8000-000000000133', ${q(ID.cand2)}, ${q(ID.app2)}, 'CV', 'bagus-nugroho-cv.pdf', 'application/pdf', 'https://files.eperformiq.local/cv/bagus-nugroho.pdf', ${ts('2026-09-06T02:30:00Z')}),
    ('11000000-0000-4000-8000-000000000134', ${q(ID.cand2)}, ${q(ID.app2)}, 'KTP', 'bagus-nugroho-ktp.pdf', 'application/pdf', 'https://files.eperformiq.local/docs/bagus-ktp.pdf', ${ts('2026-09-06T02:31:00Z')}),
    ('11000000-0000-4000-8000-000000000135', ${q(ID.cand3)}, ${q(ID.app3)}, 'CV', 'citra-dewi-cv.pdf', 'application/pdf', 'https://files.eperformiq.local/cv/citra-dewi.pdf', ${ts('2026-09-12T05:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO candidate_certifications
    (id, candidate_id, kind, name, issuer, issued_date, expiry_date, credential_id, proof_url, created_at) VALUES
    ('11000000-0000-4000-8000-000000000141', ${q(ID.cand1)}, 'CERTIFICATION', 'AWS Certified Solutions Architect - Associate', 'Amazon Web Services', '2023-05-20', '2026-05-20', 'AWS-SAA-2023-8871', 'https://files.eperformiq.local/cert/anggita-aws.pdf', ${ts('2026-09-03T01:10:00Z')}),
    ('11000000-0000-4000-8000-000000000142', ${q(ID.cand2)}, 'CERTIFICATION', 'Certified Payroll Professional', 'APA', '2022-09-15', '2027-09-15', 'CPP-2022-4410', 'https://files.eperformiq.local/cert/bagus-cpp.pdf', ${ts('2026-09-06T02:35:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO resume_parses
    (id, candidate_id, application_id, file_name, file_url, raw_text, parsed_json, ats_score, matched_skills, missing_skills, parser, created_at) VALUES
    (${q(ID.parse1)}, ${q(ID.cand1)}, ${q(ID.app1)}, 'anggita-pratiwi-cv.pdf', 'https://files.eperformiq.local/cv/anggita-pratiwi.pdf',
     'Anggita Pratiwi — Senior Backend Engineer. Go, PostgreSQL, Kubernetes, event-driven architecture.',
     ${q(JSON.stringify({ skills: ['Go', 'PostgreSQL', 'Kubernetes'], years: 6 }))}::jsonb, 88.50,
     ${q(JSON.stringify(['Go', 'PostgreSQL', 'Kubernetes']))}::jsonb,
     ${q(JSON.stringify(['Terraform']))}::jsonb, 'HEURISTIC', ${ts('2026-09-03T01:02:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO application_timeline (id, application_id, stage, status, note, actor_user_id, created_at) VALUES
    ('11000000-0000-4000-8000-000000000151', ${q(ID.app1)}, 'APPLIED', 'PASSED', 'Lamaran diterima melalui portal karier.', NULL, ${ts('2026-09-02T02:20:00Z')}),
    ('11000000-0000-4000-8000-000000000152', ${q(ID.app1)}, 'ATS_REVIEW', 'PASSED', 'ATS score 88.50 — lolos ambang 75.', ${q(USER.rina)}, ${ts('2026-09-03T01:02:00Z')}),
    ('11000000-0000-4000-8000-000000000153', ${q(ID.app1)}, 'PSYCHOMETRIC', 'PASSED', 'Profil Big Five sesuai kebutuhan peran.', ${q(USER.siti)}, ${ts('2026-09-08T02:00:00Z')}),
    ('11000000-0000-4000-8000-000000000154', ${q(ID.app1)}, 'TECHNICAL', 'PASSED', 'Skor teknis 82 — di atas ambang 70.', ${q(USER.danu)}, ${ts('2026-09-15T02:00:00Z')}),
    ('11000000-0000-4000-8000-000000000155', ${q(ID.app1)}, 'INTERVIEW', 'SCHEDULED', 'Wawancara panel dengan Head of Engineering.', ${q(USER.siti)}, ${ts('2026-09-18T02:00:00Z')}),
    ('11000000-0000-4000-8000-000000000156', ${q(ID.app2)}, 'APPLIED', 'PASSED', 'Lamaran diterima.', NULL, ${ts('2026-09-05T03:30:00Z')}),
    ('11000000-0000-4000-8000-000000000157', ${q(ID.app2)}, 'ATS_REVIEW', 'PASSED', 'ATS score 79.00.', ${q(USER.rina)}, ${ts('2026-09-06T02:30:00Z')}),
    ('11000000-0000-4000-8000-000000000158', ${q(ID.app2)}, 'PSYCHOMETRIC', 'IN_PROGRESS', 'Tes psikometri sedang dikerjakan.', ${q(USER.siti)}, ${ts('2026-09-10T02:00:00Z')}),
    ('11000000-0000-4000-8000-000000000159', ${q(ID.app3)}, 'APPLIED', 'PASSED', 'Lamaran diterima via referral.', NULL, ${ts('2026-09-11T04:45:00Z')}),
    ('11000000-0000-4000-8000-00000000015a', ${q(ID.app3)}, 'ATS_REVIEW', 'IN_PROGRESS', 'Menunggu penyaringan berkas.', ${q(USER.rina)}, ${ts('2026-09-12T01:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO interview_schedules
    (id, application_id, interviewer_user_id, scheduled_at, meeting_url, duration_minutes, score, notes, status, created_at) VALUES
    (${q(ID.intv1)}, ${q(ID.app1)}, ${q(USER.danu)}, ${ts('2026-09-22T02:00:00Z')}, 'https://meet.eperformiq.local/panel-anggita', 60, NULL, 'Panel teknis + culture fit.', 'SCHEDULED', ${ts('2026-09-18T02:00:00Z')}),
    (${q(ID.intv2)}, ${q(ID.app1)}, ${q(USER.siti)}, ${ts('2026-09-24T03:00:00Z')}, 'https://meet.eperformiq.local/hr-anggita', 45, NULL, 'Wawancara HR & negosiasi paket.', 'SCHEDULED', ${ts('2026-09-18T02:05:00Z')}),
    (${q(ID.intv3)}, ${q(ID.app2)}, ${q(USER.siti)}, ${ts('2026-09-19T02:00:00Z')}, 'https://meet.eperformiq.local/hr-bagus', 45, 3.80, 'Kandidat kuat pada payroll multi-site.', 'COMPLETED', ${ts('2026-09-10T02:10:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO interview_evaluations
    (id, application_id, interview_id, evaluator_user_id, technical_skill, problem_solving, communication,
     collaboration, motivation, leadership, professionalism, composite_score, strengths, concerns, notes,
     recommendation, created_at, updated_at) VALUES
    (${q(ID.eval1)}, ${q(ID.app2)}, ${q(ID.intv3)}, ${q(USER.siti)}, 4, 4, 4, 4, 5, 3, 4, 4.00,
     'Penguasaan proses payroll dan kepatuhan BPJS sangat baik.',
     'Belum pernah memimpin tim lintas negara.',
     'Lanjutkan ke tahap teknis dan negosiasi paket.', 'HIRE', ${ts('2026-09-19T04:00:00Z')}, ${ts('2026-09-19T04:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO assessment_attempts
    (id, application_id, candidate_id, template_id, status, score, raw_score, started_at, submitted_at, created_at) VALUES
    (${q(ID.attempt1)}, ${q(ID.app1)}, ${q(ID.cand1)}, ${q(REF.templatePsy)}, 'SCORED', 86.00, 86.00, ${ts('2026-09-07T01:00:00Z')}, ${ts('2026-09-07T01:25:00Z')}, ${ts('2026-09-07T01:00:00Z')}),
    (${q(ID.attempt2)}, ${q(ID.app1)}, ${q(ID.cand1)}, ${q(REF.templateTech)}, 'SCORED', 82.00, 82.00, ${ts('2026-09-14T01:00:00Z')}, ${ts('2026-09-14T01:40:00Z')}, ${ts('2026-09-14T01:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO assessment_responses
    (id, attempt_id, question_id, answer_key, answer_text, is_correct, score) VALUES
    ('11000000-0000-4000-8000-000000000161', ${q(ID.attempt2)}, 'c2000000-0000-4000-8000-000000000001', 'B', NULL, FALSE, 0),
    ('11000000-0000-4000-8000-000000000162', ${q(ID.attempt2)}, 'c2000000-0000-4000-8000-000000000002', 'C', NULL, TRUE, 1),
    ('11000000-0000-4000-8000-000000000163', ${q(ID.attempt2)}, 'c2000000-0000-4000-8000-000000000004', 'B', NULL, TRUE, 1),
    ('11000000-0000-4000-8000-000000000164', ${q(ID.attempt1)}, 'c1000000-0000-4000-8000-000000000001', '4', NULL, NULL, 4)
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO candidate_assessment_scores
    (id, application_id, psychometric_score, technical_score, interview_score, final_weighted_score, computed_at) VALUES
    (${q(ID.score1)}, ${q(ID.app1)}, 86.00, 82.00, NULL, 84.40, ${ts('2026-09-15T02:30:00Z')}),
    (${q(ID.score2)}, ${q(ID.app2)}, 78.00, NULL, 80.00, 78.80, ${ts('2026-09-19T04:30:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO candidate_decisions
    (id, application_id, decided_by_user_id, decision, final_score, ai_summary, notes, decided_at) VALUES
    (${q(ID.dec1)}, ${q(ID.app1)}, ${q(USER.siti)}, 'ACCEPTED', 84.40, 'Kandidat melampaui ambang pada seluruh tahap seleksi.', 'Menunggu penjadwalan panel teknis final.', ${ts('2026-09-16T02:00:00Z')}),
    (${q(ID.dec2)}, ${q(ID.app2)}, ${q(USER.siti)}, 'PENDING', 78.80, 'Perlu verifikasi pengalaman payroll multinasional.', 'Menunggu hasil tes teknis.', NULL)
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO job_offers
    (id, application_id, offered_by, status, base_salary, fixed_allowance, offered_at, response_deadline,
     responded_at, response_note, letter_agenda_number, notes, created_at, updated_at) VALUES
    (${q(ID.offer1)}, ${q(ID.app1)}, ${q(USER.siti)}, 'SENT', 32000000, 3500000, ${ts('2026-09-25T02:00:00Z')},
     ${ts('2026-10-02T02:00:00Z')}, NULL, NULL, NULL, 'Penawaran paket Senior Software Engineer grade 4.', ${ts('2026-09-25T02:00:00Z')}, ${ts('2026-09-25T02:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO candidate_notifications
    (id, candidate_id, account_id, application_id, title, body, stage, is_read, created_at) VALUES
    ('11000000-0000-4000-8000-000000000171', ${q(ID.cand1)}, ${q(ID.acct1)}, ${q(ID.app1)}, 'Undangan wawancara panel', 'Wawancara panel dijadwalkan 22 September 2026 pukul 09.00 WIB.', 'INTERVIEW', TRUE, ${ts('2026-09-18T02:01:00Z')}),
    ('11000000-0000-4000-8000-000000000172', ${q(ID.cand1)}, ${q(ID.acct1)}, ${q(ID.app1)}, 'Penawaran kerja dikirim', 'Silakan tinjau penawaran kerja pada portal kandidat.', 'OFFER', FALSE, ${ts('2026-09-25T02:01:00Z')}),
    ('11000000-0000-4000-8000-000000000173', ${q(ID.cand2)}, ${q(ID.acct2)}, ${q(ID.app2)}, 'Tes teknis tersedia', 'Tes teknis dapat dikerjakan hingga 18 September 2026.', 'TECHNICAL', FALSE, ${ts('2026-09-10T02:02:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO email_outbox
    (id, recipient, subject, body, status, provider, error, related_application_id, sent_at, created_at) VALUES
    ('11000000-0000-4000-8000-000000000181', 'anggita.pratiwi@mail.com', 'Undangan Wawancara Panel — Senior Software Engineer', 'Halo Anggita, kami mengundang Anda untuk wawancara panel.', 'SENT', 'SMTP', NULL, ${q(ID.app1)}, ${ts('2026-09-18T02:02:00Z')}, ${ts('2026-09-18T02:02:00Z')}),
    ('11000000-0000-4000-8000-000000000182', 'bagus.nugroho@mail.com', 'Tes Teknis HR Command Center', 'Silakan masuk ke portal kandidat untuk mengerjakan tes teknis.', 'QUEUED', 'SMTP', NULL, ${q(ID.app2)}, NULL, ${ts('2026-09-10T02:03:00Z')}),
    ('11000000-0000-4000-8000-000000000183', 'citra.dewi@mail.com', 'Konfirmasi Email Portal Kandidat', 'Klik tautan verifikasi untuk mengaktifkan akun portal kandidat.', 'FAILED', 'SMTP', 'SMTP 550: mailbox unavailable', ${q(ID.app3)}, NULL, ${ts('2026-09-11T04:46:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO whatsapp_outbox
    (id, phone, message, status, provider, error, related_application_id, sent_at, created_at) VALUES
    ('11000000-0000-4000-8000-000000000191', '6281234500011', 'Halo Anggita, wawancara panel 22 Sep 2026 pukul 09.00 WIB. Balas YA untuk konfirmasi.', 'SENT', 'META', NULL, ${q(ID.app1)}, ${ts('2026-09-18T02:04:00Z')}, ${ts('2026-09-18T02:04:00Z')}),
    ('11000000-0000-4000-8000-000000000192', '6281234500013', 'Halo Citra, tautan verifikasi email Anda telah kedaluwarsa. Silakan minta ulang.', 'QUEUED', 'META', NULL, ${q(ID.app3)}, NULL, ${ts('2026-09-12T01:05:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  // -------------------------------------------------------------------------
  // FASE SEBELUM KERJA — karyawan baru hasil rekrutmen & onboarding
  // -------------------------------------------------------------------------
  await client.exec(`INSERT INTO employees
    (id, employee_code, full_name, email, phone_number, department_id, position_id, manager_id, join_date,
     status, employment_status, base_salary) VALUES
    (${q(ID.emp12)}, 'EMP-0012', 'Anggita Pratiwi', 'anggita.pratiwi@eperformiq.co.id', '+6281234500011',
     ${q(REF.deptEngineering)}, ${q(REF.posSeniorSwe)}, ${q(EMP.dimas)}, '2026-10-05', 'PROBATION', 'PROBATION', 32000000),
    (${q(ID.emp13)}, 'EMP-0013', 'Bagus Nugroho', 'bagus.nugroho@eperformiq.co.id', '+6281234500012',
     ${q(REF.deptHumanCapital)}, ${q(REF.posHrSysAdmin)}, ${q(EMP.rina)}, '2026-11-01', 'PROBATION', 'PROBATION', 21000000)
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO employee_phase_history
    (id, employee_id, previous_phase, new_phase, effective_date, reason, decided_by, created_at) VALUES
    ('15000000-0000-4000-8000-000000000001', ${q(ID.emp12)}, NULL, 'PRE', ${dt('2026-09-25')}, 'Penawaran kerja diterima; kandidat masuk tahap onboarding pra-penempatan.', ${q(USER.siti)}, ${ts('2026-09-25T05:00:00Z')}),
    ('15000000-0000-4000-8000-000000000002', ${q(ID.emp13)}, NULL, 'PRE', ${dt('2026-10-20')}, 'Penawaran kerja diterima; memulai administrasi pra-kerja.', ${q(USER.siti)}, ${ts('2026-10-20T05:00:00Z')}),
    ('15000000-0000-4000-8000-000000000003', ${q(EMP.budi)}, NULL, 'DURING', ${dt('2022-04-01')}, 'Karyawan aktif sejak tanggal bergabung.', ${q(USER.siti)}, ${ts('2022-04-01T01:00:00Z')}),
    ('15000000-0000-4000-8000-000000000004', ${q(EMP.rina)}, NULL, 'DURING', ${dt('2021-01-11')}, 'Karyawan aktif sejak tanggal bergabung.', ${q(USER.siti)}, ${ts('2021-01-11T01:00:00Z')}),
    ('15000000-0000-4000-8000-000000000005', ${q(EMP.anisa)}, NULL, 'DURING', ${dt('2023-02-01')}, 'Karyawan aktif sejak tanggal bergabung.', ${q(USER.siti)}, ${ts('2023-02-01T01:00:00Z')}),
    ('15000000-0000-4000-8000-000000000006', ${q(EMP.dimas)}, NULL, 'DURING', ${dt('2021-08-16')}, 'Karyawan aktif sejak tanggal bergabung.', ${q(USER.siti)}, ${ts('2021-08-16T01:00:00Z')}),
    ('15000000-0000-4000-8000-000000000007', ${q(EMP.rizky)}, NULL, 'DURING', ${dt('2020-03-02')}, 'Karyawan aktif sejak tanggal bergabung.', ${q(USER.siti)}, ${ts('2020-03-02T01:00:00Z')}),
    ('15000000-0000-4000-8000-000000000008', ${q(EMP.rizky)}, 'DURING', 'POST', ${dt('2026-08-31')}, 'Mengundurkan diri; hari kerja terakhir 31 Agustus 2026.', ${q(USER.siti)}, ${ts('2026-08-31T10:00:00Z')}),
    ('15000000-0000-4000-8000-00000000000b', ${q(EMP.hendra)}, NULL, 'DURING', ${dt('2019-01-01')}, 'Karyawan aktif sejak tanggal bergabung.', ${q(USER.siti)}, ${ts('2019-01-01T01:00:00Z')}),
    ('15000000-0000-4000-8000-00000000000c', ${q(EMP.siti)}, NULL, 'DURING', ${dt('2018-01-01')}, 'Karyawan aktif sejak tanggal bergabung.', ${q(USER.siti)}, ${ts('2018-01-01T01:00:00Z')}),
    ('15000000-0000-4000-8000-00000000000d', ${q(EMP.danu)}, NULL, 'DURING', ${dt('2020-02-01')}, 'Karyawan aktif sejak tanggal bergabung.', ${q(USER.siti)}, ${ts('2020-02-01T01:00:00Z')}),
    ('15000000-0000-4000-8000-00000000000e', ${q(EMP.bambang)}, NULL, 'DURING', ${dt('2017-07-01')}, 'Karyawan aktif sejak tanggal bergabung.', ${q(USER.hendra)}, ${ts('2017-07-01T01:00:00Z')}),
    ('15000000-0000-4000-8000-00000000000f', ${q(EMP.aris)}, NULL, 'DURING', ${dt('2020-05-01')}, 'Karyawan aktif sejak tanggal bergabung.', ${q(USER.hendra)}, ${ts('2020-05-01T01:00:00Z')}),
    ('15000000-0000-4000-8000-000000000010', ${q(EMP.rian)}, NULL, 'PRE', ${dt('2024-02-15')}, 'Masa percobaan diperpanjang; onboarding pra-penempatan belum tuntas.', ${q(USER.siti)}, ${ts('2024-02-15T01:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO employment_status_history
    (id, employee_id, previous_status, new_status, effective_date, reason, decided_by, created_at) VALUES
    ('15000000-0000-4000-8000-000000000011', ${q(ID.emp12)}, NULL, 'PROBATION', ${dt('2026-10-05')}, 'Masa percobaan 3 bulan.', ${q(USER.siti)}, ${ts('2026-10-05T01:00:00Z')}),
    ('15000000-0000-4000-8000-000000000012', ${q(ID.emp13)}, NULL, 'PROBATION', ${dt('2026-11-01')}, 'Masa percobaan 3 bulan.', ${q(USER.siti)}, ${ts('2026-11-01T01:00:00Z')}),
    ('15000000-0000-4000-8000-000000000013', ${q(EMP.rizky)}, 'PROBATION', 'PKWTT', ${dt('2021-01-04')}, 'Lulus masa percobaan.', ${q(USER.siti)}, ${ts('2021-01-04T01:00:00Z')}),
    ('15000000-0000-4000-8000-000000000014', ${q(EMP.rizky)}, 'PKWTT', 'RESIGNED', ${dt('2026-08-31')}, 'Resign atas permintaan sendiri.', ${q(USER.siti)}, ${ts('2026-08-31T10:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO onboarding_programs
    (id, employee_id, application_id, position_id, plan_id, status, started_at, completed_at) VALUES
    (${q(ID.onboard12)}, ${q(ID.emp12)}, ${q(ID.app1)}, ${q(REF.posSeniorSwe)}, NULL, 'IN_PROGRESS', ${ts('2026-09-25T05:30:00Z')}, NULL),
    (${q(ID.onboard13)}, ${q(ID.emp13)}, ${q(ID.app2)}, ${q(REF.posHrSysAdmin)}, NULL, 'IN_PROGRESS', ${ts('2026-10-20T05:30:00Z')}, NULL)
    ON CONFLICT (employee_id) DO NOTHING;`);

  await client.exec(`INSERT INTO employee_registrations
    (id, email, full_name, phone_number, password_hash, position_hint, verify_token, verify_expires_at,
     status, approved_by, approved_at, reject_reason, created_at) VALUES
    (${q(ID.reg1)}, 'dewi.anggraini@mail.com', 'Dewi Anggraini', '+6281234500014', ${q(hash)}, 'HR Operations Officer',
     'verify-token-dewi-2026', ${ts('2026-10-05T00:00:00Z')}, 'PENDING_EMAIL', NULL, NULL, NULL, ${ts('2026-09-28T02:00:00Z')}),
    (${q(ID.reg2)}, 'eko.prasetyo@mail.com', 'Eko Prasetyo', '+6281234500015', ${q(hash)}, 'QA Engineer',
     'verify-token-eko-2026', ${ts('2026-10-01T00:00:00Z')}, 'PENDING_APPROVAL', NULL, NULL, NULL, ${ts('2026-09-24T02:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO employee_documents
    (id, employee_id, document_type, file_url, issued_date, expiry_date, verification_status, verified_by, verified_at, created_at) VALUES
    (${q(ID.empDoc1)}, ${q(ID.emp12)}, 'KTP', 'https://files.eperformiq.local/docs/anggita-ktp.pdf', '2019-06-14', '2034-06-14', 'VERIFIED', ${q(USER.rina)}, ${ts('2026-09-26T01:00:00Z')}, ${ts('2026-09-25T06:00:00Z')}),
    (${q(ID.empDoc2)}, ${q(ID.emp12)}, 'IJAZAH', 'https://files.eperformiq.local/docs/anggita-ijazah.pdf', '2018-09-01', NULL, 'VERIFIED', ${q(USER.rina)}, ${ts('2026-09-26T01:05:00Z')}, ${ts('2026-09-25T06:00:00Z')}),
    (${q(ID.empDoc3)}, ${q(ID.emp13)}, 'NPWP', 'https://files.eperformiq.local/docs/bagus-npwp.pdf', '2016-02-11', NULL, 'PENDING', NULL, NULL, ${ts('2026-10-21T01:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  // -------------------------------------------------------------------------
  // FASE SAAT KERJA
  // -------------------------------------------------------------------------
  await client.exec(`INSERT INTO company_dpi_settings
    (company_id, green_threshold, yellow_threshold, achievement_cap, absence_demotes, updated_at) VALUES
    (${q(REF.company)}, 90.00, 70.00, 1.20, TRUE, ${ts('2026-07-01T01:00:00Z')})
    ON CONFLICT (company_id) DO NOTHING;`);

  await client.exec(`INSERT INTO kpi_indicators
    (id, kpi_id, indicator_name, unit_of_measure, target_value, direction, frequency, aggregation,
     indicator_weight, is_active, created_at) VALUES
    (${q(ID.indicator1)}, ${q(REF.kpiBudi1)}, 'Jumlah deployment produksi tanpa rollback', 'deploy', 4.00, 'HIGHER_BETTER', 'WEEKLY', 'SUM', 50.00, TRUE, ${ts('2026-07-01T01:00:00Z')}),
    (${q(ID.indicator2)}, ${q(REF.kpiBudi1)}, 'Waktu penyelesaian pull request review', 'jam', 8.00, 'LOWER_BETTER', 'WEEKLY', 'AVG', 50.00, TRUE, ${ts('2026-07-01T01:00:00Z')}),
    (${q(ID.indicator3)}, ${q(REF.kpiBudi2)}, 'Cakupan unit test modul inti', '%', 85.00, 'HIGHER_BETTER', 'MONTHLY', 'LAST', 100.00, TRUE, ${ts('2026-07-01T01:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO kpi_evidence_attachments (id, individual_kpi_id, file_title, file_url, uploaded_at) VALUES
    (${q(ID.kpiEvidence1)}, ${q(REF.kpiBudi1)}, 'Bukti pipeline rilis Q3 2026', 'https://files.eperformiq.local/kpi/pipeline-q3-2026.pdf', ${ts('2026-09-20T03:00:00Z')}),
    (${q(ID.kpiEvidence2)}, ${q(REF.kpiBudi2)}, 'Laporan coverage SonarQube', 'https://files.eperformiq.local/kpi/sonar-coverage-q3.pdf', ${ts('2026-09-21T03:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO kpi_daily_entries
    (id, indicator_id, employee_id, entry_date, actual_value, note, evidence_url, status, is_late,
     submitted_at, verified_by, verified_at, rejection_reason, created_at, updated_at) VALUES
    (${q(ID.daily1)}, ${q(ID.indicator1)}, ${q(EMP.budi)}, ${dt('2026-09-22')}, 4.00, 'Empat deployment produksi tanpa rollback.', 'https://files.eperformiq.local/kpi/pipeline-q3-2026.pdf', 'VERIFIED', FALSE, ${ts('2026-09-22T10:00:00Z')}, ${q(USER.danu)}, ${ts('2026-09-23T02:00:00Z')}, NULL, ${ts('2026-09-22T10:00:00Z')}, ${ts('2026-09-23T02:00:00Z')}),
    (${q(ID.daily2)}, ${q(ID.indicator2)}, ${q(EMP.budi)}, ${dt('2026-09-23')}, 6.50, 'Rata-rata review PR 6,5 jam.', NULL, 'SUBMITTED', FALSE, ${ts('2026-09-23T10:00:00Z')}, NULL, NULL, NULL, ${ts('2026-09-23T10:00:00Z')}, ${ts('2026-09-23T10:00:00Z')}),
    (${q(ID.daily3)}, ${q(ID.indicator3)}, ${q(EMP.budi)}, ${dt('2026-09-24')}, 88.00, 'Coverage naik ke 88% setelah refactor.', NULL, 'SUBMITTED', TRUE, ${ts('2026-09-26T10:00:00Z')}, NULL, NULL, NULL, ${ts('2026-09-26T10:00:00Z')}, ${ts('2026-09-26T10:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO daily_performance_snapshots
    (id, employee_id, snapshot_date, dpi_score, traffic_light, indicators_expected, indicators_filled, demotion_reason, computed_at) VALUES
    (${q(ID.snapshot1)}, ${q(EMP.budi)}, ${dt('2026-09-23')}, 96.25, 'GREEN', 2, 2, NULL, ${ts('2026-09-23T23:00:00Z')}),
    (${q(ID.snapshot2)}, ${q(EMP.rina)}, ${dt('2026-09-23')}, 74.00, 'YELLOW', 1, 1, NULL, ${ts('2026-09-23T23:00:00Z')})
    ON CONFLICT (employee_id, snapshot_date) DO NOTHING;`);

  await client.exec(`INSERT INTO attendance_logs
    (id, employee_id, work_date, check_in_at, check_out_at, check_in_lat, check_in_lng, check_out_lat, check_out_lng,
     check_in_photo_url, check_out_photo_url, check_in_note, check_out_note, status, total_work_hours,
     total_overtime_hours, approved_by, approved_at, created_at) VALUES
    (${q(ID.attlog1)}, ${q(EMP.budi)}, ${dt('2026-09-22')}, ${ts('2026-09-22T00:58:00Z')}, ${ts('2026-09-22T09:35:00Z')},
     -6.208800, 106.845600, -6.208900, 106.845500,
     'https://files.eperformiq.local/att/budi-in-0922.jpg', 'https://files.eperformiq.local/att/budi-out-0922.jpg',
     NULL, NULL, 'CLOSED', 8.62, 0.62, ${q(USER.danu)}, ${ts('2026-09-23T01:00:00Z')}, ${ts('2026-09-22T00:58:00Z')}),
    (${q(ID.attlog2)}, ${q(EMP.budi)}, ${dt('2026-09-23')}, ${ts('2026-09-23T01:02:00Z')}, NULL,
     -6.208800, 106.845600, NULL, NULL,
     'https://files.eperformiq.local/att/budi-in-0923.jpg', NULL,
     NULL, NULL, 'MISSING_CHECKOUT', NULL, 0.00, NULL, NULL, ${ts('2026-09-23T01:02:00Z')}),
    (${q(ID.attlog3)}, ${q(EMP.anisa)}, ${dt('2026-09-23')}, ${ts('2026-09-23T01:05:00Z')}, ${ts('2026-09-23T09:05:00Z')},
     -6.208800, 106.845600, -6.208900, 106.845500,
     'https://files.eperformiq.local/att/anisa-in-0923.jpg', 'https://files.eperformiq.local/att/anisa-out-0923.jpg',
     'Check-in dari kantor pusat.', NULL, 'APPROVED', 8.00, 0.00, ${q(USER.danu)}, ${ts('2026-09-24T01:00:00Z')}, ${ts('2026-09-23T01:05:00Z')})
    ON CONFLICT (employee_id, work_date) DO NOTHING;`);

  await client.exec(`INSERT INTO attendance_corrections
    (id, attendance_log_id, employee_id, requested_check_in_at, requested_check_out_at, reason, status,
     decided_by, decided_at, decision_note, created_at) VALUES
    (${q(ID.attcorr1)}, ${q(ID.attlog2)}, ${q(EMP.budi)}, NULL, ${ts('2026-09-23T09:40:00Z')},
     'Lupa melakukan check-out karena sesi perbaikan produksi mendadak.', 'SUBMITTED', NULL, NULL, NULL, ${ts('2026-09-24T02:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO letters
    (id, agenda_number, direction, classification, subject, sender, recipient, letter_date, received_date,
     file_url, status, created_by, created_at) VALUES
    (${q(ID.letter1)}, 'AG-2026-09-0001', 'INCOMING', 'BIASA', 'Permintaan Data Ketenagakerjaan Triwulan III 2026', 'Dinas Tenaga Kerja DKI Jakarta', 'Human Capital', ${dt('2026-09-08')}, ${dt('2026-09-09')}, 'https://files.eperformiq.local/letters/ag-2026-09-0001.pdf', 'IN_PROGRESS', ${q(USER.rina)}, ${ts('2026-09-09T02:00:00Z')}),
    (${q(ID.letter2)}, 'AG-2026-09-0002', 'OUTGOING', 'BIASA', 'Undangan Sosialisasi Kebijakan KPI Harian', 'Human Capital', 'Seluruh Kepala Departemen', ${dt('2026-09-15')}, NULL, 'https://files.eperformiq.local/letters/ag-2026-09-0002.pdf', 'OPEN', ${q(USER.rina)}, ${ts('2026-09-15T02:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO letter_dispositions
    (id, letter_id, from_user_id, to_user_id, instruction, priority, due_date, status, read_at, completed_at, completion_note, created_at) VALUES
    (${q(ID.disposition1)}, ${q(ID.letter1)}, ${q(USER.siti)}, ${q(USER.rina)}, 'Siapkan laporan dan koordinasikan dengan Payroll sebelum tenggat.', 'HIGH', ${dt('2026-09-20')}, 'DIKERJAKAN', ${ts('2026-09-09T03:00:00Z')}, NULL, NULL, ${ts('2026-09-09T02:30:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO policy_documents
    (id, document_code, title, policy_type, version, owner_department_id, effective_date, file_url, status,
     supersedes_id, created_at) VALUES
    (${q(ID.policy1)}, 'SOP-HC-KPI-001', 'SOP Pengelolaan KPI Harian & DPI', 'SOP', '2.0', ${q(REF.deptHumanCapital)}, ${dt('2026-07-01')}, 'https://files.eperformiq.local/policies/sop-hc-kpi-001-v2.pdf', 'AKTIF', NULL, ${ts('2026-06-20T02:00:00Z')}),
    (${q(ID.policy2)}, 'PP-HC-DISIPLIN-003', 'Peraturan Perusahaan tentang Disiplin Kerja', 'PP', '1.0', ${q(REF.deptHumanCapital)}, ${dt('2026-01-01')}, 'https://files.eperformiq.local/policies/pp-hc-displin-003-v1.pdf', 'AKTIF', NULL, ${ts('2025-12-15T02:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO policy_acknowledgments (id, policy_document_id, employee_id, acknowledged_at) VALUES
    ('13000000-0000-4000-8000-000000000085', ${q(ID.policy1)}, ${q(EMP.budi)}, ${ts('2026-07-03T02:00:00Z')}),
    ('13000000-0000-4000-8000-000000000086', ${q(ID.policy2)}, ${q(EMP.budi)}, ${ts('2026-01-06T02:00:00Z')}),
    ('13000000-0000-4000-8000-000000000087', ${q(ID.policy1)}, ${q(EMP.anisa)}, ${ts('2026-07-04T02:00:00Z')})
    ON CONFLICT (policy_document_id, employee_id) DO NOTHING;`);

  await client.exec(`INSERT INTO disciplinary_actions
    (id, employee_id, action_type, reason, evidence_url, effective_date, expiry_date, issued_by,
     appeal_status, appeal_deadline, appeal_reason, created_at) VALUES
    (${q(ID.disciplinary1)}, ${q(EMP.dimas)}, 'SP1', 'Keterlambatan pengisian laporan progres dua minggu berturut-turut tanpa pemberitahuan.', 'https://files.eperformiq.local/disciplinary/sp1-dimas-2026.pdf', ${dt('2026-09-10')}, ${dt('2027-03-10')}, ${q(USER.siti)}, 'UNDER_APPEAL', ${dt('2026-09-24')}, 'Karyawan mengajukan keberatan karena alasan cuti sakit yang terdokumentasi.', ${ts('2026-09-10T03:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO recognitions
    (id, employee_id, recognition_type, title, description, awarded_date, certificate_url, points, created_at) VALUES
    (${q(ID.recognition1)}, ${q(EMP.budi)}, 'EMPLOYEE_OF_THE_QUARTER', 'Employee of the Quarter Q3 2026', 'Memimpin migrasi pipeline tanpa downtime produksi.', ${dt('2026-09-30')}, 'https://files.eperformiq.local/reco/budi-eoq-q3-2026.pdf', 100, ${ts('2026-09-30T03:00:00Z')}),
    (${q(ID.recognition2)}, ${q(EMP.anisa)}, 'PEER_APPRECIATION', 'Apresiasi Rekan Kerja — Agustus 2026', 'Membantu penyelesaian desain kampanye internal tepat waktu.', ${dt('2026-08-31')}, NULL, 25, ${ts('2026-08-31T03:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO badge_awards (id, badge_id, employee_id, awarded_at, evidence_ref) VALUES
    ('13000000-0000-4000-8000-000000000251', ${q(REF.badge1)}, ${q(EMP.budi)}, ${ts('2026-09-30T03:05:00Z')}, 'Q3-2026-migration'),
    ('13000000-0000-4000-8000-000000000252', ${q(REF.badge1)}, ${q(EMP.anisa)}, ${ts('2026-08-31T03:05:00Z')}, 'AUG-2026-campaign')
    ON CONFLICT (badge_id, employee_id) DO NOTHING;`);

  await client.exec(`INSERT INTO career_ladder_steps
    (id, from_position_id, to_position_id, step_order, step_name, requirement_type, requirement_ref,
     threshold_value, is_mandatory, created_at) VALUES
    (${q(ID.ladder1)}, ${q(REF.posSeniorSwe)}, ${q(REF.posLeadTalent)}, 1, 'Sertifikasi arsitektur cloud profesional', 'CERTIFICATION', 'AWS Solutions Architect Professional', NULL, TRUE, ${ts('2026-07-01T02:00:00Z')}),
    (${q(ID.ladder2)}, ${q(REF.posSeniorSwe)}, ${q(REF.posLeadTalent)}, 2, 'Composite GPA minimal 3,50 selama 2 periode', 'GPA', NULL, 3.50, TRUE, ${ts('2026-07-01T02:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO salary_components
    (id, code, name, component_type, calc_method, rate, params, is_active, description, created_at) VALUES
    (${q(ID.salary1)}, 'BASIC', 'Gaji Pokok', 'EARNING', 'FIXED', NULL, NULL, TRUE, 'Komponen gaji pokok sesuai grade.', ${ts('2026-01-02T02:00:00Z')}),
    (${q(ID.salary2)}, 'TUNJAB', 'Tunjangan Jabatan', 'EARNING', 'PERCENT_OF_BASE', 0.15000, NULL, TRUE, 'Tunjangan jabatan 15% dari gaji pokok.', ${ts('2026-01-02T02:01:00Z')}),
    (${q(ID.salary3)}, 'BPJS-KES', 'Iuran BPJS Kesehatan (Pemberi Kerja)', 'EMPLOYER', 'PERCENT_OF_BASE', 0.04000, NULL, TRUE, 'Iuran pemberi kerja 4% dari gaji pokok.', ${ts('2026-01-02T02:02:00Z')}),
    (${q(ID.salary4)}, 'PPH21', 'PPh 21', 'DEDUCTION', 'BRACKET', NULL, ${q(JSON.stringify({ brackets: [{ upTo: 60000000, rate: 0.05 }, { upTo: 250000000, rate: 0.15 }, { upTo: 500000000, rate: 0.25 }, { upTo: null, rate: 0.30 }] }))}::jsonb, TRUE, 'Potongan PPh 21 progresif sesuai UU HPP.', ${ts('2026-01-02T02:03:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO company_holidays (id, holiday_date, name, created_at) VALUES
    (${q(ID.holiday1)}, ${dt('2026-12-25')}, 'Hari Raya Natal', ${ts('2025-11-01T02:00:00Z')}),
    (${q(ID.holiday2)}, ${dt('2026-08-17')}, 'Hari Kemerdekaan Republik Indonesia', ${ts('2025-11-01T02:00:00Z')}),
    (${q(ID.holiday3)}, ${dt('2026-05-01')}, 'Hari Buruh Internasional', ${ts('2025-11-01T02:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO conversations (id, conversation_type, title, created_by, created_at) VALUES
    (${q(ID.conv1)}, 'DIRECT', NULL, ${q(USER.danu)}, ${ts('2026-09-22T08:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO conversation_members (conversation_id, user_id, joined_at, last_read_at) VALUES
    (${q(ID.conv1)}, ${q(USER.danu)}, ${ts('2026-09-22T08:00:00Z')}, ${ts('2026-09-22T09:00:00Z')}),
    (${q(ID.conv1)}, ${q(USER.budi)}, ${ts('2026-09-22T08:00:00Z')}, ${ts('2026-09-22T09:30:00Z')})
    ON CONFLICT (conversation_id, user_id) DO NOTHING;`);

  await client.exec(`INSERT INTO messages (id, conversation_id, sender_id, body, attachment_url, is_recalled, sent_at) VALUES
    (${q(ID.msg1)}, ${q(ID.conv1)}, ${q(USER.danu)}, 'Budi, tolong tautkan bukti pipeline Q3 pada entri KPI harian.', NULL, FALSE, ${ts('2026-09-22T08:05:00Z')}),
    (${q(ID.msg2)}, ${q(ID.conv1)}, ${q(USER.budi)}, 'Sudah saya unggah, Pak. File: pipeline-q3-2026.pdf.', 'https://files.eperformiq.local/kpi/pipeline-q3-2026.pdf', FALSE, ${ts('2026-09-22T09:20:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO employee_notifications
    (id, employee_id, event_type, title, body, is_read, created_at) VALUES
    (${q(ID.notif1)}, ${q(EMP.budi)}, 'KPI_ENTRY_VERIFIED', 'Entri KPI harian terverifikasi', 'Entri 22 September 2026 untuk indikator deployment produksi telah diverifikasi atasan langsung.', TRUE, ${ts('2026-09-23T02:01:00Z')}),
    (${q(ID.notif2)}, ${q(EMP.dimas)}, 'DISCIPLINARY_APPEAL', 'Keberatan sanksi tercatat', 'Keberatan atas SP1 sedang ditinjau HR. Batas keputusan 24 September 2026.', FALSE, ${ts('2026-09-11T03:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO ai_insights
    (id, feature, period_code, role, insight, provider, payload_hash, generated_at) VALUES
    (${q(ID.insight1)}, 'VMAI_NARRATIVE', '2026-Q3', 'BOD', 'Kinerja korporat Q3 2026 stabil dengan perbaikan pada disiplin eksekusi KPI harian; risiko utama ada pada kapasitas teknis tim engineering.', 'openai', 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678abcdef0123456789abcdef01', ${ts('2026-09-30T23:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO employee_flight_risk_snapshots
    (id, employee_id, snapshot_date, attrition_score, attrition_band, burnout_score, burnout_band, factors, computed_at) VALUES
    (${q(ID.flight1)}, ${q(EMP.dimas)}, ${dt('2026-09-30')}, 62, 'HIGH', 48, 'MODERATE',
     ${q(JSON.stringify([{ factor: 'Beban lembur 3 minggu terakhir', weight: 0.3 }, { factor: 'Skor engagement turun', weight: 0.25 }]))}::jsonb, ${ts('2026-09-30T23:30:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO improvement_ideas
    (id, employee_id, period_id, title, description, estimated_saving_idr, status, reviewer_id,
     reviewer_notes, submitted_at, decided_at) VALUES
    (${q(ID.idea1)}, ${q(EMP.budi)}, ${q(REF.periodActive)}, 'Otomasi retry pipeline deploy',
     'Pipeline deploy otomatis melakukan retry untuk kegagalan transien sehingga menurunkan rollback manual.',
     48000000.00, 'APPROVED', ${q(USER.danu)}, 'Dampak terukur, dijadwalkan implementasi Q4 2026.', ${ts('2026-09-12T02:00:00Z')}, ${ts('2026-09-20T02:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO sop_period_metrics
    (id, period_id, employee_id, total_assigned_tasks, tasks_on_time, error_count, fatal_error_count,
     audit_findings_count, notes, recorded_by, created_at, updated_at) VALUES
    (${q(ID.sopMetric1)}, ${q(REF.periodActive)}, ${q(EMP.budi)}, 24, 23, 1, 0, 1,
     'Satu temuan minor pada dokumentasi perubahan; sudah ditindaklanjuti.', ${q(USER.danu)}, ${ts('2026-09-30T03:00:00Z')}, ${ts('2026-09-30T03:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO gpa_batch_jobs
    (id, period_id, status, total_count, processed_count, failed_count, last_error, created_by,
     started_at, completed_at, created_at) VALUES
    (${q(ID.gpaJob1)}, ${q(REF.periodActive)}, 'COMPLETED', 11, 11, 0, NULL, ${q(USER.siti)},
     ${ts('2026-09-30T23:40:00Z')}, ${ts('2026-09-30T23:52:00Z')}, ${ts('2026-09-30T23:40:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO appraisal_finalization_requests
    (id, period_id, employee_id, status, note, decided_by, decided_at, decision_note, created_at, updated_at) VALUES
    (${q(ID.finalization1)}, ${q(REF.periodActive)}, ${q(EMP.budi)}, 'APPROVED',
     'Seluruh entri KPI harian terverifikasi dan bukti lengkap.', ${q(USER.siti)}, ${ts('2026-10-01T02:00:00Z')},
     'Finalisasi disetujui; lanjut ke kalibrasi komite.', ${ts('2026-09-30T23:55:00Z')}, ${ts('2026-10-01T02:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO competency_evidence
    (id, employee_id, competency_id, source, course_id, rating, action, notes, created_at) VALUES
    (${q(ID.competency1)}, ${q(EMP.budi)}, ${q(REF.competency1)}, 'COURSE',
     (SELECT id FROM moodle_courses WHERE course_code = ${q(REF.courseOnboarding)} LIMIT 1),
     4, 'COMPLETE', 'Menyelesaikan kursus onboarding dengan nilai 92.', ${ts('2026-04-20T03:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO course_completions (id, employee_id, course_id, module_id, completed_at) VALUES
    (${q(ID.completion1)}, ${q(EMP.budi)},
     (SELECT id FROM moodle_courses WHERE course_code = ${q(REF.courseOnboarding)} LIMIT 1),
     (SELECT id FROM course_modules WHERE course_id = (SELECT id FROM moodle_courses WHERE course_code = ${q(REF.courseOnboarding)} LIMIT 1) ORDER BY order_index LIMIT 1),
     ${ts('2026-04-18T03:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  // -------------------------------------------------------------------------
  // FASE SETELAH KERJA — pensiun & exit
  // -------------------------------------------------------------------------
  await client.exec(`INSERT INTO employees
    (id, employee_code, full_name, email, phone_number, department_id, position_id, manager_id, join_date,
     status, employment_status, base_salary) VALUES
    (${q(ID.emp15)}, 'EMP-0015', 'Suharto Wijaya', 'suharto.wijaya@eperformiq.co.id', '+6281234500015',
     ${q(REF.deptHumanCapital)}, ${q(REF.posLeadTalent)}, ${q(EMP.hendra)}, '1998-03-02', 'PERMANENT', 'RETIRED', 45000000)
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO employee_phase_history
    (id, employee_id, previous_phase, new_phase, effective_date, reason, decided_by, created_at) VALUES
    ('15000000-0000-4000-8000-000000000009', ${q(ID.emp15)}, NULL, 'DURING', ${dt('1998-03-02')}, 'Karyawan aktif sejak tanggal bergabung.', ${q(USER.hendra)}, ${ts('1998-03-02T01:00:00Z')}),
    ('15000000-0000-4000-8000-00000000000a', ${q(ID.emp15)}, 'DURING', 'POST', ${dt('2026-09-30')}, 'Memasuki masa pensiun pada usia 58 tahun.', ${q(USER.hendra)}, ${ts('2026-09-30T10:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO employment_status_history
    (id, employee_id, previous_status, new_status, effective_date, reason, decided_by, created_at) VALUES
    ('15000000-0000-4000-8000-000000000015', ${q(ID.emp15)}, NULL, 'TETAP', ${dt('1998-03-02')}, 'Pengangkatan karyawan tetap.', ${q(USER.hendra)}, ${ts('1998-03-02T01:00:00Z')}),
    ('15000000-0000-4000-8000-000000000016', ${q(ID.emp15)}, 'TETAP', 'RETIRED', ${dt('2026-09-30')}, 'Pensiun normal pada usia 58 tahun.', ${q(USER.hendra)}, ${ts('2026-09-30T10:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO offboarding_requests
    (id, employee_id, reason_for_leaving, resignation_notice_date, last_working_day,
     is_regrettable_attrition, status, created_at) VALUES
    (${q(ID.offboard15)}, ${q(ID.emp15)}, 'PENSIUN', ${dt('2026-06-30')}, ${dt('2026-09-30')}, FALSE, 'COMPLETED', ${ts('2026-06-30T03:00:00Z')})
    ON CONFLICT (id) DO NOTHING;`);

  await client.exec(`INSERT INTO exit_interviews
    (id, employee_id, offboarding_request_id, feedback, overall_rating, would_recommend, created_at) VALUES
    (${q(ID.exit1)}, ${q(EMP.rizky)}, ${q(REF.offboardRizky)},
     'Proses administrasi keluar sudah rapi; saran agar sesi serah terima pengetahuan dijadwalkan lebih awal.',
     4, TRUE, ${ts('2026-08-28T03:00:00Z')}),
    (${q(ID.exit2)}, ${q(ID.emp15)}, ${q(ID.offboard15)},
     'Masa pensiun berjalan lancar. Apresiasi atas dukungan HR dalam perhitungan manfaat pensiun.',
     5, TRUE, ${ts('2026-09-29T03:00:00Z')})
    ON CONFLICT (employee_id, offboarding_request_id) DO NOTHING;`);

  // Selaraskan kolom denormalisasi `employees.employee_phase` dengan transisi
  // terakhir di `employee_phase_history` agar portal dan layanan fase membaca
  // nilai yang sama. Satu statement: PGlite hanya menerapkan efek pertama pada
  // batch multi-statement.
  await client.exec(`UPDATE employees e
    SET employee_phase = latest.new_phase
    FROM (
      SELECT DISTINCT ON (h.employee_id) h.employee_id, h.new_phase
        FROM employee_phase_history h
       ORDER BY h.employee_id, h.effective_date DESC, h.created_at DESC
    ) AS latest
    WHERE latest.employee_id = e.id
      AND e.employee_phase IS DISTINCT FROM latest.new_phase;`);
}