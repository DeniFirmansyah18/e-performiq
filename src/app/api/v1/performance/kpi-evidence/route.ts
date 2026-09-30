import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, fail, problem } from '@/lib/api/response';
import { getDb, db } from '@/lib/db/client';
import { resolveVisibleEmployeeIds, assertEmployeeVisible } from '@/lib/auth/scope';
import { attachKpiEvidence } from '@/lib/services/productivityService';
import { NotFoundError } from '@/lib/auth/errors';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EvidenceSchema = z.object({
individual_kpi_id: z.string().uuid('ID KPI tidak valid.'),
file_title: z.string().min(3, 'Judul bukti minimal 3 karakter.'),
file_url: z.string().min(1, 'Tautan atau berkas bukti wajib diisi.'),
});

/** POST: lampirkan bukti pendukung pada KPI milik karyawan yang login. */
export async function POST(req: NextRequest) {
try {
const session = await getAuthSession(req);
const parsed = EvidenceSchema.safeParse(await req.json());
if (!parsed.success) {
return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data bukti tidak valid.', 400);
}



// Validasi kepemilikan KPI terhadap sesi login
const rawDb = await getDb();
const scope = await resolveVisibleEmployeeIds(db, session);
const owner = await rawDb.query<any>(`SELECT employee_id FROM individual_kpis WHERE id = $1::uuid`, [
  parsed.data.individual_kpi_id,
]);
if (owner.rows.length === 0) {
  throw new NotFoundError('KPI tidak ditemukan.');
}
assertEmployeeVisible(scope, owner.rows[0].employee_id);

const attachment = await attachKpiEvidence({
  individualKpiId: parsed.data.individual_kpi_id,
  fileTitle: parsed.data.file_title,
  fileUrl: parsed.data.file_url,
});
return ok(attachment, 'Bukti pendukung KPI berhasil diunggah.');
} catch (err: any) {
return problem(err, '/api/v1/performance/kpi-evidence');
}
}
