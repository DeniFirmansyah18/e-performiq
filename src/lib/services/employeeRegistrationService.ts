import { sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { Db } from '@/lib/db/client';
import { hashPassword } from '@/lib/auth/password';
import { BusinessRuleError } from '@/lib/auth/errors';

export interface RegisterEmployeeInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  positionHint?: string;
}

export interface PendingRegistration {
  id: string;
  email: string;
  fullName: string;
  positionHint: string | null;
  status: string;
  createdAt: string | null;
}

function randomToken(): string {
  return randomBytes(32).toString('hex');
}

function randomCode(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function asUuidOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
}

/** Daftarkan karyawan baru ke tabel staging. Menolak duplikat di users maupun registrasi. */
export async function registerEmployee(
  db: Db,
  input: RegisterEmployeeInput
): Promise<{ status: 'PENDING_EMAIL'; verifyToken: string }> {
  const email = input.email.trim().toLowerCase();
  const dupUser = (await db.execute(sql`
    SELECT id FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `)) as unknown as { rows: unknown[] };
  if ((dupUser.rows ?? []).length > 0) {
    throw new BusinessRuleError('Email sudah terdaftar.');
  }
  const dupReg = (await db.execute(sql`
    SELECT id, status FROM employee_registrations WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `)) as unknown as { rows: Array<{ id: string; status: string }> };
  if ((dupReg.rows ?? []).length > 0) {
    throw new BusinessRuleError('Email sudah terdaftar.');
  }
  const passwordHash = await hashPassword(input.password);
  const verifyToken = randomToken();
  await db.execute(sql`
    INSERT INTO employee_registrations (email, full_name, phone_number, password_hash, position_hint, verify_token, verify_expires_at, status)
    VALUES (LOWER(${email}), ${input.fullName}, ${input.phone ?? null}, ${passwordHash}, ${input.positionHint ?? null}, ${verifyToken}, CURRENT_TIMESTAMP + INTERVAL '24 hours', 'PENDING_EMAIL')
  `);
  return { status: 'PENDING_EMAIL', verifyToken };
}

/** Verifikasi email via token. */
export async function verifyEmployeeEmail(
  db: Db,
  token: string
): Promise<{ ok: true; email: string } | { ok: false; reason: 'INVALID' | 'EXPIRED' | 'ALREADY' }> {
  const res = (await db.execute(sql`
    SELECT id, email, status, verify_expires_at AS "verifyExpiresAt"
      FROM employee_registrations WHERE verify_token = ${token} LIMIT 1
  `)) as unknown as { rows: Array<{ id: string; email: string; status: string; verifyExpiresAt: string | null }> };
  const row = res.rows[0];
  if (!row) return { ok: false, reason: 'INVALID' };
  if (row.status !== 'PENDING_EMAIL') return { ok: false, reason: 'ALREADY' };
  if (row.verifyExpiresAt && new Date(row.verifyExpiresAt).getTime() < Date.now()) {
    return { ok: false, reason: 'EXPIRED' };
  }
  await db.execute(sql`
    UPDATE employee_registrations SET status = 'PENDING_APPROVAL' WHERE id = ${row.id}::uuid
  `);
  return { ok: true, email: row.email };
}

/** Daftar registrasi yang menunggu (email terverifikasi maupun belum). */
export async function listPendingRegistrations(db: Db): Promise<PendingRegistration[]> {
  const res = (await db.execute(sql`
    SELECT id, email, full_name AS "fullName", position_hint AS "positionHint",
           status, created_at AS "createdAt"
      FROM employee_registrations
     WHERE status IN ('PENDING_APPROVAL','PENDING_EMAIL')
     ORDER BY created_at DESC
  `)) as unknown as { rows: PendingRegistration[] };
  return res.rows ?? [];
}

/** Setujui registrasi: buat baris employees + users (idempoten). */
export async function approveRegistration(
  db: Db,
  id: string,
  opts: { approvedBy?: string | null; departmentId: string; positionId: string }
): Promise<{ employeeId: string; userId: string }> {
  const regRes = (await db.execute(sql`
    SELECT id, email, full_name AS "fullName", phone_number AS "phoneNumber",
           password_hash AS "passwordHash", status
      FROM employee_registrations WHERE id = ${id}::uuid LIMIT 1
  `)) as unknown as { rows: Array<{ id: string; email: string; fullName: string; phoneNumber: string | null; passwordHash: string; status: string }> };
  const reg = regRes.rows[0];
  if (!reg) throw new BusinessRuleError('Registrasi tidak ditemukan.');
  if (reg.status === 'REJECTED') throw new BusinessRuleError('Registrasi telah ditolak.');
  // Idempoten: bila users sudah ada untuk email ini (atau reg sudah ACTIVE), pakai ulang.
  const existingUser = (await db.execute(sql`
    SELECT u.id AS "userId", u.employee_id AS "employeeId"
      FROM users u WHERE LOWER(u.email) = LOWER(${reg.email}) LIMIT 1
  `)) as unknown as { rows: Array<{ userId: string; employeeId: string | null }> };
  if (reg.status === 'ACTIVE' && existingUser.rows[0]) {
    return { employeeId: existingUser.rows[0].employeeId ?? '', userId: existingUser.rows[0].userId };
  }
  let employeeId = existingUser.rows[0]?.employeeId ?? null;
  let userId = reg.status === 'ACTIVE' ? existingUser.rows[0]?.userId ?? null : null;
  if (!employeeId) {
    const empRes = (await db.execute(sql`
      INSERT INTO employees (employee_code, full_name, email, phone_number, department_id, position_id, status, base_salary, join_date)
      VALUES (${randomCode('EMP')}, ${reg.fullName}, LOWER(${reg.email}), ${reg.phoneNumber}, ${opts.departmentId}::uuid, ${opts.positionId}::uuid, 'PROBATION', 0, CURRENT_DATE)
      RETURNING id
    `)) as unknown as { rows: Array<{ id: string }> };
    employeeId = empRes.rows[0].id;
  }
  if (!userId) {
    if (existingUser.rows[0]) {
      userId = existingUser.rows[0].userId;
    } else {
      const userRes = (await db.execute(sql`
        INSERT INTO users (employee_id, email, password_hash, role, is_active)
        VALUES (${employeeId}::uuid, LOWER(${reg.email}), ${reg.passwordHash}, 'EMPLOYEE', TRUE)
        RETURNING id
      `)) as unknown as { rows: Array<{ id: string }> };
      userId = userRes.rows[0].id;
    }
  }
  await db.execute(sql`
    UPDATE employee_registrations
       SET status = 'ACTIVE', approved_by = ${asUuidOrNull(opts.approvedBy ?? null)}::uuid,
           approved_at = CURRENT_TIMESTAMP
     WHERE id = ${id}::uuid
  `);
  return { employeeId: employeeId!, userId: userId! };
}

/** Tolak registrasi. */
export async function rejectRegistration(
  db: Db,
  id: string,
  opts: { approvedBy?: string | null; reason?: string }
): Promise<{ ok: true }> {
  await db.execute(sql`
    UPDATE employee_registrations
       SET status = 'REJECTED', reject_reason = ${opts.reason ?? null},
           approved_by = ${asUuidOrNull(opts.approvedBy ?? null)}::uuid, approved_at = CURRENT_TIMESTAMP
     WHERE id = ${id}::uuid
  `);
  return { ok: true };
}
