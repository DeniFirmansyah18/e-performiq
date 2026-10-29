import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { extendOffer, respondToOffer } from '@/lib/services/offerService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OfferSchema = z.object({
  baseSalary: z.number().min(0),
  fixedAllowance: z.number().min(0).optional(),
  responseDays: z.number().int().min(1).max(60).optional(),
  notes: z.string().max(4000).optional(),
});

const RespondSchema = z.object({
  response: z.enum(['ACCEPTED', 'DECLINED']),
  responseNote: z.string().max(2000).optional(),
});

// POST /api/v1/recruitment/candidates/:id/offer  (HR menerbitkan penawaran)
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');

    const body = await req.json().catch(() => ({}));
    const parsed = OfferSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Data penawaran tidak valid.', 400);

    const offer = await extendOffer(db, {
      applicationId: ctx.params.id,
      offeredByUserId: session.userId,
      baseSalary: parsed.data.baseSalary,
      fixedAllowance: parsed.data.fixedAllowance,
      responseDays: parsed.data.responseDays,
      notes: parsed.data.notes,
    });
    return ok(offer, 'Penawaran diterbitkan dan surat penawaran didaftarkan.');
  } catch (err) {
    return problem(err, '/api/v1/recruitment/candidates/[id]/offer');
  }
}

// PATCH /api/v1/recruitment/candidates/:id/offer  (HR mencatat respons kandidat)
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');

    const body = await req.json().catch(() => ({}));
    const parsed = RespondSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Respons tidak valid.', 400);

    const offer = await respondToOffer(db, {
      applicationId: ctx.params.id,
      response: parsed.data.response,
      responseNote: parsed.data.responseNote,
    });
    return ok(offer, parsed.data.response === 'ACCEPTED' ? 'Penawaran diterima; kandidat dikonversi.' : 'Penawaran ditutup.');
  } catch (err) {
    return problem(err, '/api/v1/recruitment/candidates/[id]/offer');
  }
}