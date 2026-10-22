import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { listMessages, sendMessage } from '@/lib/services/chatService';

const BodySchema = z.object({
  body: z.string().min(1).max(4000),
  attachmentUrl: z.string().url().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'chat:read');

    const items = await listMessages(db, { conversationId: params.id, userId: session.userId });
    return ok({ items });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    // Keanggotaan dibuktikan dengan 403, bukan daftar kosong.
    if (status === 422) return fail('FORBIDDEN', 'Anda bukan anggota percakapan ini.', 403);
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat pesan', status);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'chat:write');

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Data tidak valid', 400);
    }

    const row = await sendMessage(db, {
      conversationId: params.id,
      senderId: session.userId,
      ...parsed.data,
    });
    return ok(row, 'Pesan terkirim.');
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    if (status === 422) return fail('BUSINESS_RULE_VIOLATION', err?.message ?? 'Pesan ditolak', 400);
    return fail(status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal mengirim pesan', status);
  }
}
