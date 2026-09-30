import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, fail, problem } from '@/lib/api/response';
import { getDb } from '@/lib/db/client';
import { assertCan } from '@/lib/auth/rbac';
import { createHelpdeskTicket } from '@/lib/services/helpdeskChatbotService';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TicketSchema = z.object({
isWhistleblowing: z.boolean(),
ticketCategory: z.string().min(3, 'Kategori tiket minimal 3 karakter.'),
subject: z.string().min(5, 'Subjek tiket minimal 5 karakter.'),
detail: z.string().min(10, 'Detail laporan minimal 10 karakter.'),
priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

/**

GET: daftar tiket untuk HR/AUDITOR (wbs:read).
Identitas pelapor disembunyikan untuk tiket whistleblowing (GCG Fairness).
*/
export async function GET(req: NextRequest) {
try {
const session = await getAuthSession(req);
assertCan(session, 'wbs:read');
const db = await getDb();
const res = await db.query(
`SELECT id, employee_id AS "employeeId", is_whistleblowing AS "isWhistleblowing", ticket_category AS "ticketCategory", subject, detail, priority, status, created_at AS "createdAt" FROM helpdesk_tickets ORDER BY created_at DESC`
);
const items = res.rows.map((t: any) => ({
...t,
employeeId: t.isWhistleblowing ? null : t.employeeId, // anonim untuk WBS
}));
return ok({ items });
} catch (err: any) {
return problem(err, '/api/v1/governance/helpdesk');
}
}
/**

POST: buat tiket bantuan umum atau laporan pelanggaran (WBS).
Tiket WBS bersifat anonim — employee_id tidak disimpan.
*/
export async function POST(req: NextRequest) {
try {
const session = await getAuthSession(req);
const parsed = TicketSchema.safeParse(await req.json());
if (!parsed.success) {
return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tiket tidak valid.', 400);
}
const ticket = await createHelpdeskTicket({
employeeId: parsed.data.isWhistleblowing ? undefined : (session.employeeId ?? undefined),
isWhistleblowing: parsed.data.isWhistleblowing,
ticketCategory: parsed.data.ticketCategory,
subject: parsed.data.subject,
detail: parsed.data.detail,
priority: parsed.data.priority,
});
return ok(
ticket,
parsed.data.isWhistleblowing
? 'Laporan pelanggaran terkirim secara anonim. Identitas Anda tidak disimpan.'
: 'Tiket bantuan berhasil dibuat dan diteruskan ke tim terkait.'
);
} catch (err: any) {
return problem(err, '/api/v1/governance/helpdesk');
}
}
