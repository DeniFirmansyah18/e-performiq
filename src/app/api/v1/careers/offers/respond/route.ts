import { NextRequest } from 'next/server';
import { ok, fail, problem } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { bacaTokenRespons, catatResponsKandidat } from '@/lib/services/offerResponseService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/careers/offers/respond?t=<token>  (PUBLIK)
 * Menampilkan ringkas penawaran agar kandidat bisa memutuskan.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('t') ?? '';
    const info = await bacaTokenRespons(db, token);
    if (!info.valid) {
      return fail('INVALID_TOKEN', info.alasan ?? 'Tautan tidak valid.', 400);
    }
    return ok({
      applicationId: info.applicationId,
      statusPenawaran: info.statusPenawaran,
    });
  } catch (err) {
    return problem(err, '/api/v1/careers/offers/respond');
  }
}

/**
 * POST /api/v1/careers/offers/respond  (PUBLIK)
 * Body: { token, decision: 'ACCEPTED' | 'DECLINED' }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token : '';
    const decision = body?.decision;

    if (decision !== 'ACCEPTED' && decision !== 'DECLINED') {
      return fail('VALIDATION_ERROR', 'Pilihan harus Terima atau Tolak.', 400);
    }

    const hasil = await catatResponsKandidat(db, token, decision);
    if (!hasil.berhasil) {
      return fail('INVALID_TOKEN', hasil.alasan ?? 'Respons gagal dicatat.', 400);
    }

    // Beri tahu HR bahwa kandidat sudah menjawab (best-effort).
    try {
      const { notifyRoles } = await import('@/lib/services/notificationService');
      await notifyRoles(db, ['HR_MANAGER', 'SUPER_ADMIN'], {
        eventType: 'OFFER_RESPONDED',
        title: decision === 'ACCEPTED' ? 'Kandidat menerima penawaran' : 'Kandidat menolak penawaran',
        body: `${hasil.namaKandidat} ${decision === 'ACCEPTED' ? 'menerima' : 'menolak'} penawaran untuk posisi ${hasil.posisi}.`,
        severity: decision === 'ACCEPTED' ? 'SUCCESS' : 'WARNING',
      });
    } catch {
      /* notifikasi best-effort */
    }

    return ok({ decision }, 'Terima kasih, jawaban Anda sudah kami terima.');
  } catch (err) {
    return problem(err, '/api/v1/careers/offers/respond');
  }
}
