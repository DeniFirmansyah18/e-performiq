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

function randomCode(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
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
      title: 'Selamat Bergabung di E-PerformIQ',
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

export async function convertHiredCandidate(
  db: Db,
  input: { applicationId: string; actorUserId?: string | null },
): Promise<{ employeeId: string; userId: string; created: boolean }> {
  const info = (await db.execute(sql`
    SELECT ja.candidate_id AS "candidateId", c.full_name AS "fullName", c.email,
           c.account_id AS "accountId", c.phone AS "phone",
           c.address, c.birth_date::text AS "birthDate", c.gender, c.nik,
           jp.department_id AS "departmentId", jp.position_id AS "positionId"
      FROM job_applications ja
      JOIN candidates c ON c.id = ja.candidate_id
      JOIN job_postings jp ON jp.id = ja.job_posting_id
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

  const empRes = (await db.execute(sql`
    INSERT INTO employees (employee_code, full_name, email, phone_number, department_id, position_id, status, base_salary, join_date,
                           gender, nik, address, date_of_birth)
    VALUES (${randomCode('EMP')}, ${row.fullName}, ${email}, ${row.phone ?? null},
            ${row.departmentId}::uuid, ${row.positionId}::uuid, 'PERMANENT'::employee_status_enum, 0, CURRENT_DATE,
            ${row.gender ?? null}, ${row.nik ?? null}, ${row.address ?? null}, ${row.birthDate ?? null}::date)
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
  await notifyHired(db, employeeId, String(row.fullName));

  if (row.accountId) {
    await db.execute(sql`UPDATE candidate_accounts SET is_active = FALSE WHERE id = ${row.accountId}::uuid`);
  }
  return { employeeId, userId, created: true };
}
