import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, fail, problem } from '@/lib/api/response';
import { getDb } from '@/lib/db/client';
import { getCareerPathForPosition } from '@/lib/services/learningCareerService';
import { NotFoundError } from '@/lib/auth/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET: jenjang karir untuk posisi jabatan karyawan yang sedang login. */
export async function GET(req: NextRequest) {
try {
const session = await getAuthSession(req);
if (!session.employeeId) {
return fail('FORBIDDEN', 'Akun pengguna ini tidak memiliki ID karyawan aktif.', 403);
}
const db = await getDb();
const emp = await db.query(`SELECT position_id FROM employees WHERE id = $1::uuid`, [
session.employeeId,
]);
const positionId = emp.rows[0]?.position_id;
if (!positionId) {
throw new NotFoundError('Posisi jabatan karyawan tidak ditemukan.');
}
const levels = await getCareerPathForPosition(positionId);
return ok({ items: levels });
} catch (err: any) {
return problem(err, '/api/v1/learning/career-path');
}
}
