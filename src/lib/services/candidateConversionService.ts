/**
 * Konversi kandidat HIRED → karyawan (employees + users).
 *
 * Saat lamaran publik berstatus HIRED, kandidat "naik kelas" menjadi karyawan:
 *  - Dibuat record `employees` (departemen/posisi dari posting) + `users` (role EMPLOYEE).
 *  - Karyawan hasil konversi berstatus PERMANENT (karyawan tetap).
 *  - Dibuka jembatan fase Pra-Bekerja: `onboarding_programs` + `onboarding_milestones`
 *    sehingga orientasi 30-60-90 hari tertaut ke lamaran/posisi asal rekrutmen.
 *  - Password karyawan = HASH password kandidat (bisa login dengan sandi yang sama).
 *  - Akun `candidate_accounts` dinonaktifkan agar tak lagi login sebagai kandidat.
 *
 * Idempoten & best-effort: pemanggilan ulang memakai record yang sudah ada.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';

function randomCode(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/**
 * Kode karyawan berformat baku EMP-TAHUN-NNNN (ADR 023).
 *
 * `randomCode` menghasilkan kode acak yang tidak bisa diurutkan per tahun masuk
 * dan sulit dicari. Nomor urut diambil dari urutan terbesar tahun berjalan,
 * dihitung di SQL agar aman terhadap dua konversi bersamaan.
 */
async function nextEmployeeCode(db: Db): Promise<string> {
  const year = new Date().getFullYear();
  const res = (await db.execute(sql`
    SELECT COALESCE(MAX((split_part(employee_code, '-', 3))::int), 0) + 1 AS next_seq
      FROM employees
     WHERE employee_code LIKE ${`EMP-${year}-%`}
       AND employee_code ~ ${`^EMP-${year}-[0-9]{4}$`}
  `)) as unknown as { rows: Array<{ next_seq: number }> };
  const seq = Number(res.rows?.[0]?.next_seq ?? 1);
  return `EMP-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Buka jembatan fase Pra-Bekerja untuk karyawan hasil konversi:
 * pastikan `onboarding_programs` + `onboarding_milestones` ada dan tertaut
 * ke lamaran/posisi asal. Idempoten (ON CONFLICT DO NOTHING).
 */
async function ensureOnboardingBridge(
  db: Db,
  employeeId: string,
  applicationId: string,
  positionId: string | null,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO onboarding_programs (employee_id, application_id, position_id, status)
    VALUES (${employeeId}::uuid, ${applicationId}::uuid, ${positionId}::uuid, 'IN_PROGRESS'::onboarding_status_enum)
    ON CONFLICT (employee_id) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO onboarding_milestones (employee_id, probation_passed)
    VALUES (${employeeId}::uuid, FALSE)
    ON CONFLICT (employee_id) DO NOTHING
  `);
}

/**
 * Tanam KPI pembuka karyawan baru pada periode penilaian aktif agar siklus
 * Rekrutmen → Orientasi → Penilaian Kinerja langsung menyatu. Idempoten
 * (seedStarterKpis hanya menambah bila karyawan belum punya KPI di periode itu).
 */
async function ensureStarterKpiBridge(db: Db, employeeId: string): Promise<void> {
  const { ensureActiveAppraisalPeriod } = await import('./appraisalService');
  const { seedStarterKpis } = await import('./kpiService');
  const period = await ensureActiveAppraisalPeriod(db);
  if (period?.id) await seedStarterKpis(db, employeeId, period.id);
}

/** Notifikasi selamat bergabung + orientasi 30-60-90 hari (best-effort). */
async function notifyHired(db: Db, employeeId: string, name: string): Promise<void> {
  try {
    const { notifyEmployeeLifecycle, notifyRoles } = await import('./notificationService');
    await notifyEmployeeLifecycle(db, {
      employeeId,
      eventType: 'HIRED_ONBOARDING',
      title: 'Selamat Bergabung di HR Command Center',
      body: `Halo ${name}, selamat bergabung! Program orientasi 30-60-90 hari Anda telah dibuka. ` +
        `Silakan lengkapi checklist onboarding dan sasaran KPI pembuka di portal karyawan.`,
    });
    // Beri tahu HR bahwa kandidat dikonversi menjadi karyawan.
    await notifyRoles(db, ['HR_MANAGER'], {
      eventType: 'CANDIDATE_HIRED',
      title: 'Kandidat Dikonversi Menjadi Karyawan',
      body: `${name} telah bergabung sebagai karyawan tetap dan onboarding-nya dibuka.`,
    });
  } catch { /* best-effort */ }
}

/**
 * Karyawan hasil konversi masuk fase Pra-Kerja (orientasi 30-60-90 belum
 * tuntas). Dicatat lewat state machine agar transisinya punya jejak audit.
 */
async function enterPrePhase(db: Db, employeeId: string, actorUserId?: string | null): Promise<void> {
  try {
    const { syncEmployeePhase } = await import('./employeePhaseService');
    await syncEmployeePhase(db, {
      employeeId,
      targetPhase: 'PRE',
      effectiveDate: new Date().toISOString().slice(0, 10),
      reason: 'Konversi kandidat HIRED menjadi karyawan; orientasi 30-60-90 hari dibuka.',
      decidedBy: actorUserId ?? null,
    });
  } catch { /* best-effort */ }
}

export async function convertHiredCandidate(
  db: Db,
  input: { applicationId: string; actorUserId?: string | null },
): Promise<{ employeeId: string; userId: string; created: boolean }> {
  const info = (await db.execute(sql`
    SELECT ja.candidate_id AS "candidateId", c.full_name AS "fullName", c.email,
           c.account_id AS "accountId", c.phone AS "phone",
           c.address, c.birth_date::text AS "birthDate", c.gender, c.nik,
           jp.department_id AS "departmentId", jp.position_id AS "positionId",
           -- Atasan langsung diambil dari MPP yang dipilih pada lowongan, karena
           -- di situlah HR menetapkan People Manager penanggung jawab formasi.
           mp.manager_id AS "managerId"
      FROM job_applications ja
      JOIN candidates c ON c.id = ja.candidate_id
      JOIN job_postings jp ON jp.id = ja.job_posting_id
      LEFT JOIN manpower_plans mp ON mp.id = jp.manpower_plan_id
     WHERE ja.id = ${input.applicationId}::uuid
  `)) as unknown as { rows: any[] };
  const row = info.rows?.[0];
  if (!row) throw new Error('Lamaran tidak ditemukan.');
  const email = String(row.email).toLowerCase();

  // Idempoten: bila user sudah ada dan tertaut ke karyawan, pakai ulang.
  const existingUser = (await db.execute(sql`
    SELECT u.id AS "userId", u.employee_id AS "employeeId"
      FROM users u WHERE LOWER(u.email) = ${email} LIMIT 1
  `)) as unknown as { rows: Array<{ userId: string; employeeId: string | null }> };
  if (existingUser.rows[0]?.employeeId) {
    const eid = existingUser.rows[0].employeeId!;
    // Karyawan hasil konversi berstatus tetap; lengkapi jembatan onboarding bila belum ada.
    await db.execute(sql`UPDATE employees SET status = 'PERMANENT'::employee_status_enum WHERE id = ${eid}::uuid AND status = 'PROBATION'::employee_status_enum`);
    // Lengkapi identitas dari lamaran bila belum terisi (idempotent).
    await db.execute(sql`
      UPDATE employees SET
        gender        = COALESCE(gender, ${row.gender ?? null}),
        nik           = COALESCE(nik, ${row.nik ?? null}),
        address       = COALESCE(address, ${row.address ?? null}),
        date_of_birth = COALESCE(date_of_birth, ${row.birthDate ?? null}::date),
        phone_number  = COALESCE(phone_number, ${row.phone ?? null})
      WHERE id = ${eid}::uuid
    `);
    await ensureOnboardingBridge(db, eid, input.applicationId, row.positionId ?? null);
    await ensureStarterKpiBridge(db, eid);
    await enterPrePhase(db, eid, input.actorUserId);
    await notifyHired(db, eid, String(row.fullName));
    if (row.accountId) {
      await db.execute(sql`UPDATE candidate_accounts SET is_active = FALSE WHERE id = ${row.accountId}::uuid`);
    }
    return { employeeId: eid, userId: existingUser.rows[0].userId, created: false };
  }

  // Ambil hash password kandidat untuk dipakai karyawan baru.
  let passwordHash = '';
  if (row.accountId) {
    const hashRow = (await db.execute(sql`
      SELECT password_hash AS "hash" FROM candidate_accounts WHERE id = ${row.accountId}::uuid LIMIT 1
    `)) as unknown as { rows: Array<{ hash: string }> };
    passwordHash = hashRow.rows[0]?.hash ?? '';
  }

  // Gaji wajib berasal dari penawaran (ADR 023). Tanpa ini karyawan baru masuk
  // payroll dengan gaji 0 dan slip gaji tidak sah.
  const offerRes = (await db.execute(sql`
    SELECT base_salary::float8 AS "baseSalary"
      FROM job_offers WHERE application_id = ${input.applicationId}::uuid
  `)) as unknown as { rows: Array<{ baseSalary: number }> };
  const offeredSalary = Number(offerRes.rows?.[0]?.baseSalary ?? 0);
  if (!(offeredSalary > 0)) {
    throw new BusinessRuleError(
      'Konversi kandidat membutuhkan penawaran dengan gaji tercatat. ' +
        'Terbitkan penawaran (extendOffer) sebelum menaikkan status ke HIRED.'
    );
  }

  const employeeCode = await nextEmployeeCode(db);

  const empRes = (await db.execute(sql`
    INSERT INTO employees (employee_code, full_name, email, phone_number, department_id, position_id, status, base_salary, join_date,
                           gender, nik, address, date_of_birth, manager_id)
    VALUES (${employeeCode}, ${row.fullName}, ${email}, ${row.phone ?? null},
            ${row.departmentId}::uuid, ${row.positionId}::uuid, 'PERMANENT'::employee_status_enum, ${offeredSalary}, CURRENT_DATE,
            ${row.gender ?? null}, ${row.nik ?? null}, ${row.address ?? null}, ${row.birthDate ?? null}::date,
            ${row.managerId ?? null}::uuid)
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  const employeeId = empRes.rows[0].id;

  const userRes = (await db.execute(sql`
    INSERT INTO users (employee_id, email, password_hash, role, is_active)
    VALUES (${employeeId}::uuid, ${email}, ${passwordHash}, 'EMPLOYEE'::user_role_enum, TRUE)
    RETURNING id
  `)) as unknown as { rows: Array<{ id: string }> };
  const userId = userRes.rows[0].id;

  // Jembatan fase Pra-Bekerja: buka program onboarding + milestone 30-60-90 hari,
  // tertaut ke lamaran/posisi asal agar siklus Rekrutmen → Orientasi menyatu.
  await ensureOnboardingBridge(db, employeeId, input.applicationId, row.positionId ?? null);
  await ensureStarterKpiBridge(db, employeeId);
  await enterPrePhase(db, employeeId, input.actorUserId);
  await notifyHired(db, employeeId, String(row.fullName));

  // Berkas kepegawaian: pindahkan dokumen yang sudah diunggah kandidat (CV,
  // KTP, ijazah, dsb.) agar pegawai baru tidak perlu mengunggah ulang.
  try {
    const { isiOtotomatisBerkasDariKandidat } = await import('./documentAutoFill');
    await isiOtotomatisBerkasDariKandidat(db, { employeeId, candidateId: row.candidateId });
  } catch {
    /* pengisian otomatis opsional; jangan gagalkan konversi */
  }

  if (row.accountId) {
    await db.execute(sql`UPDATE candidate_accounts SET is_active = FALSE WHERE id = ${row.accountId}::uuid`);
  }
  return { employeeId, userId, created: true };
}
