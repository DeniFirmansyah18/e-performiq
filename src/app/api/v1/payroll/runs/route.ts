import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { generatePayrollRun, generateFinalSettlementRun, listPayrollRuns, listPayrollItems } from '@/lib/services/payrollService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GenerateSchema = z.object({
  periodCode: z.string().regex(/^\d{4}-\d{2}$/, 'periodCode harus format YYYY-MM'),
  periodStart: z.string().min(8).max(10),
  periodEnd: z.string().min(8).max(10),
  isThrMonth: z.boolean().optional(),
  mode: z.enum(['REGULAR', 'FINAL_SETTLEMENT']).optional(),
  offboardingRequestId: z.string().optional(),
});

// GET /api/v1/payroll/runs — daftar run payroll (HR)
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'payroll:read');
    const runId = req.nextUrl.searchParams.get('runId');
    if (runId) {
      const items = await listPayrollItems(db, runId);
      return ok({ items });
    }
    const runs = await listPayrollRuns(db);
    return ok({ runs });
  } catch (err) {
    return problem(err, '/api/v1/payroll/runs');
  }
}

// POST /api/v1/payroll/runs — buat/regenerate run payroll (HR)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'payroll:manage');
    const body = await req.json().catch(() => ({}));
    const parsed = GenerateSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data periode tidak valid.', 400);

    if (parsed.data.mode === 'FINAL_SETTLEMENT') {
      if (!parsed.data.offboardingRequestId) {
        return fail('VALIDATION_ERROR', 'offboardingRequestId wajib diisi untuk mode FINAL_SETTLEMENT.', 400);
      }
      const result = await generateFinalSettlementRun(db, {
        offboardingRequestId: parsed.data.offboardingRequestId,
        periodCode: parsed.data.periodCode,
        createdBy: session.userId,
      });
      return ok(result, 'Run payroll final settlement (pesangon) berhasil dibuat.');
    }

    const result = await generatePayrollRun(db, { ...parsed.data, createdBy: session.userId });

    // Notifikasi HR/BOD/Auditor: run payroll baru siap ditinjau (best-effort).
    try {
      const { notifyRoles } = await import('@/lib/services/notificationService');
      await notifyRoles(db, ['HR_MANAGER', 'BOD'], {
        eventType: 'PAYROLL_RUN_READY',
        title: 'Run Payroll Siap Ditinjau',
        body: `Run payroll periode ${parsed.data.periodCode} telah dibuat dan menunggu persetujuan.`,
        severity: 'INFO',
      });
    } catch { /* best-effort */ }

    return ok(result, 'Run payroll berhasil dibuat.');
  } catch (err) {
    return problem(err, '/api/v1/payroll/runs');
  }
}
