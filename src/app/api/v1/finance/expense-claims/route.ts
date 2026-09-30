import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, fail, problem } from '@/lib/api/response';
import { getDb } from '@/lib/db/client';
import { submitExpenseClaim } from '@/lib/services/payrollFinanceService';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ClaimSchema = z.object({
claimCategory: z.enum(['MEDICAL', 'TRAVEL', 'OPERATIONAL'], {
errorMap: () => ({ message: 'Kategori klaim harus MEDICAL, TRAVEL, atau OPERATIONAL.' }),
}),
amount: z
.number({ invalid_type_error: 'Nominal klaim harus berupa angka.' })
.positive('Nominal klaim harus lebih dari 0.'),
claimDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal klaim harus YYYY-MM-DD.'),
receiptUrl: z.string().min(1, 'Bukti struk wajib dilampirkan.'),
});

/** GET: daftar klaim reimbursement milik karyawan yang login. */
export async function GET(req: NextRequest) {
try {
const session = await getAuthSession(req);
if (!session.employeeId) {
return fail('FORBIDDEN', 'Akun pengguna ini tidak memiliki ID karyawan aktif.', 403);
}
const db = await getDb();
const res = await db.query(
`SELECT id, claim_category AS "claimCategory", amount, receipt_url AS "receiptUrl", claim_date AS "claimDate", status, created_at AS "createdAt" FROM expense_claims WHERE employee_id = $1::uuid ORDER BY claim_date DESC, created_at DESC`,
[session.employeeId]
);
return ok({ items: res.rows });
} catch (err: any) {
return problem(err, '/api/v1/finance/expense-claims');
}
}

/** POST: ajukan klaim reimbursement baru. */
export async function POST(req: NextRequest) {
try {
const session = await getAuthSession(req);
const parsed = ClaimSchema.safeParse(await req.json());
if (!parsed.success) {
return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data klaim tidak valid.', 400);
}
if (!session.employeeId) {
return fail('FORBIDDEN', 'Akun pengguna ini tidak memiliki ID karyawan aktif.', 403);
}
const claim = await submitExpenseClaim({
employeeId: session.employeeId,
claimCategory: parsed.data.claimCategory,
amount: parsed.data.amount,
receiptUrl: parsed.data.receiptUrl,
claimDate: parsed.data.claimDate,
});
return ok(claim, 'Klaim reimbursement berhasil diajukan dan menunggu verifikasi Finance.');
} catch (err: any) {
return problem(err, '/api/v1/finance/expense-claims');
}
}
