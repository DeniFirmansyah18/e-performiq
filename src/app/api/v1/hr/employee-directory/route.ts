import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listEmployeesForHr } from '@/lib/services/hrEmployeeDirectoryService';

/**
 * Direktori pegawai untuk Command Center HRD (Narasi 3 pilar 7).
 *
 * Berbeda dari `/api/v1/hr/employees` (picker rekrutmen yang mensyaratkan
 * `recruitment:manage`), endpoint ini memakai `directory:read` agar BOD dan
 * AUDITOR dapat memakai direktori. Tidak memakai `employment:read` karena
 * permission itu juga dipakai `me/employment-status` untuk membaca data DIRI
 * SENDIRI, sehingga dimiliki EMPLOYEE — direktori ini justru mencakup seluruh
 * perusahaan dan tidak boleh terbuka bagi karyawan.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'directory:read');

    const includeInactive = req.nextUrl.searchParams.get('includeInactive') === 'true';
    // Direktori hanya memuat karyawan berakun EMPLOYEE: HR tidak berwenang
    // mengubah BOD dan People Manager karena keduanya punya tingkat posisi
    // tersendiri.
    const employees = await listEmployeesForHr(db, { includeInactive, hanyaPeranKaryawan: true });
    return ok({ employees, total: employees.length });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat direktori pegawai',
      status
    );
  }
}