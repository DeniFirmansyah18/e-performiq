import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail, problem } from '@/lib/api/response';
import { ubahKursus, daftarModulKursus, tambahModulMateri } from '@/lib/services/learningLmsService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ModulSchema = z.object({
  title: z.string().min(1).max(255),
  contentUrl: z.string().max(500).nullable().optional(),
  contentBody: z.string().max(8000).nullable().optional(),
  contentType: z.enum(['TEXT', 'VIDEO', 'PDF', 'QUIZ']).optional(),
});

const UbahKursusSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  category: z.string().max(100).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  hours: z.number().min(0).max(1000).optional(),
});

/** Galat validasi tautan (domain/berbayar) → 400 dengan pesan jelas. */
function galatTautan(err: any): boolean {
  return /tepercaya|berbayar|tidak valid/i.test(String(err?.message ?? ''));
}

// GET /api/v1/learning/courses/:id — kursus + daftar modul/materinya
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:read');
    const courseId = Number(ctx.params.id);
    if (!Number.isFinite(courseId)) return fail('BAD_REQUEST', 'ID kursus tidak valid.', 400);
    return ok({ courseId, modules: await daftarModulKursus(db, courseId) });
  } catch (err) {
    return problem(err, '/api/v1/learning/courses/[id]');
  }
}

// PATCH /api/v1/learning/courses/:id — HR menyesuaikan kursus
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:manage');
    const courseId = Number(ctx.params.id);
    if (!Number.isFinite(courseId)) return fail('BAD_REQUEST', 'ID kursus tidak valid.', 400);

    const parsed = UbahKursusSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Data kursus tidak valid.', 400);

    await ubahKursus(db, courseId, parsed.data);
    return ok({ courseId }, 'Kursus diperbarui.');
  } catch (err) {
    return problem(err, '/api/v1/learning/courses/[id]');
  }
}

// POST /api/v1/learning/courses/:id — HR menambah modul/materi sendiri
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'learning:manage');
    const courseId = Number(ctx.params.id);
    if (!Number.isFinite(courseId)) return fail('BAD_REQUEST', 'ID kursus tidak valid.', 400);

    const parsed = ModulSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Judul materi wajib diisi.', 400);

    const hasil = await tambahModulMateri(db, courseId, {
      title: parsed.data.title,
      contentType: parsed.data.contentType,
      contentUrl: parsed.data.contentUrl ?? null,
      contentBody: parsed.data.contentBody ?? null,
    });
    return ok(hasil, 'Materi ditambahkan.');
  } catch (err) {
    if (galatTautan(err)) return fail('VALIDATION_ERROR', String((err as Error).message), 400);
    return problem(err, '/api/v1/learning/courses/[id]');
  }
}
