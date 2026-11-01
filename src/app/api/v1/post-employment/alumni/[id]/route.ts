import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, failFromError, parseBody } from '@/lib/api/response';
import * as svc from '@/lib/services/postEmploymentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  rehire_eligible: z.boolean().optional(),
  rehire_reason: z.string().max(500).nullable().optional(),
  consent_to_contact: z.boolean().optional(),
  contact_email: z.string().email('Format email tidak valid').nullable().optional(),
  contact_phone: z.string().max(40).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

type Ctx = { params: { id: string } };

/** PATCH /api/v1/post-employment/alumni/[id] — perbarui data alumni. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'postemployment:alumni');
    const body = await parseBody(req, PatchSchema);

    const out = await svc.updateAlumni(db, {
      id: ctx.params.id,
      rehireEligible: body.rehire_eligible,
      rehireReason: body.rehire_reason ?? null,
      consentToContact: body.consent_to_contact,
      contactEmail: body.contact_email ?? null,
      contactPhone: body.contact_phone ?? null,
      notes: body.notes ?? null,
    });

    return ok({ message: 'Data alumni berhasil diperbarui.', data: out });
  } catch (err) {
    return failFromError(err, '/api/v1/post-employment/alumni');
  }
}
