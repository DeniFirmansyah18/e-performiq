import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { buildCertificateNo, buildVerificationCode } from '@/lib/engines/certificate-engine';

export interface CertificateRow {
  id: string;
  certificateNo: string;
  verificationCode: string;
  employeeId: string;
  courseId: number;
  issuedAt: string;
}

/**
 * Menerbitkan sertifikat penyelesaian kursus (idempoten per employee+course).
 * Nomor & kode verifikasi dibangun deterministik dari kode karyawan + kode kursus + tanggal.
 */
export async function issueCertificate(db: Db, employeeId: string, courseId: number): Promise<CertificateRow> {
  const existing = (await db.execute(sql`
    SELECT id, certificate_no AS "certificateNo", verification_code AS "verificationCode",
           employee_id AS "employeeId", course_id AS "courseId", issued_at AS "issuedAt"
      FROM certificates WHERE employee_id = ${employeeId}::uuid AND course_id = ${courseId}
  `)) as unknown as { rows: CertificateRow[] };
  if (existing.rows[0]) return { ...existing.rows[0], courseId: Number(existing.rows[0].courseId) };

  const meta = (await db.execute(sql`
    SELECT e.employee_code AS "employeeCode", c.course_code AS "courseCode"
      FROM employees e, moodle_courses c
     WHERE e.id = ${employeeId}::uuid AND c.id = ${courseId}
  `)) as unknown as { rows: Array<{ employeeCode: string; courseCode: string }> };
  const employeeCode = meta.rows[0]?.employeeCode ?? 'EMP';
  const courseCode = meta.rows[0]?.courseCode ?? 'COURSE';

  const now = new Date();
  const certificateNo = buildCertificateNo(employeeCode, courseCode, now);
  const verificationCode = buildVerificationCode(`${employeeCode}-${courseCode}-${now.toISOString().slice(0, 10)}`);

  const inserted = (await db.execute(sql`
    INSERT INTO certificates (certificate_no, verification_code, employee_id, course_id)
    VALUES (${certificateNo}, ${verificationCode}, ${employeeId}::uuid, ${courseId})
    ON CONFLICT (employee_id, course_id) DO NOTHING
    RETURNING id, certificate_no AS "certificateNo", verification_code AS "verificationCode",
              employee_id AS "employeeId", course_id AS "courseId", issued_at AS "issuedAt"
  `)) as unknown as { rows: CertificateRow[] };

  if (inserted.rows[0]) return { ...inserted.rows[0], courseId: Number(inserted.rows[0].courseId) };

  // Race/idempotent fallback
  const again = (await db.execute(sql`
    SELECT id, certificate_no AS "certificateNo", verification_code AS "verificationCode",
           employee_id AS "employeeId", course_id AS "courseId", issued_at AS "issuedAt"
      FROM certificates WHERE employee_id = ${employeeId}::uuid AND course_id = ${courseId}
  `)) as unknown as { rows: CertificateRow[] };
  return { ...again.rows[0], courseId: Number(again.rows[0].courseId) };
}

export async function getCertificatesForEmployee(db: Db, employeeId: string): Promise<Array<CertificateRow & { courseTitle: string }>> {
  const res = (await db.execute(sql`
    SELECT cf.id, cf.certificate_no AS "certificateNo", cf.verification_code AS "verificationCode",
           cf.employee_id AS "employeeId", cf.course_id AS "courseId", cf.issued_at AS "issuedAt",
           c.title AS "courseTitle"
      FROM certificates cf JOIN moodle_courses c ON c.id = cf.course_id
     WHERE cf.employee_id = ${employeeId}::uuid
     ORDER BY cf.issued_at DESC
  `)) as unknown as { rows: any[] };
  return (res.rows ?? []).map((r) => ({ ...r, courseId: Number(r.courseId) }));
}

export async function verifyCertificate(db: Db, code: string): Promise<{ valid: boolean; certificate?: CertificateRow & { employeeName: string; courseTitle: string } }> {
  const res = (await db.execute(sql`
    SELECT cf.id, cf.certificate_no AS "certificateNo", cf.verification_code AS "verificationCode",
           cf.employee_id AS "employeeId", cf.course_id AS "courseId", cf.issued_at AS "issuedAt",
           e.full_name AS "employeeName", c.title AS "courseTitle"
      FROM certificates cf
      JOIN employees e ON e.id = cf.employee_id
      JOIN moodle_courses c ON c.id = cf.course_id
     WHERE cf.verification_code = ${code}
  `)) as unknown as { rows: any[] };
  const row = res.rows[0];
  if (!row) return { valid: false };
  return { valid: true, certificate: { ...row, courseId: Number(row.courseId) } };
}
