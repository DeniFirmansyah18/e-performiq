import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getCandidateSessionOrNull } from '@/lib/auth/candidateSession';
import { ok, fail, problem } from '@/lib/api/response';
import { emailConfigStatus, sendEmail } from '@/lib/services/notificationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/careers/notifications/config — status konfigurasi email (tanpa rahasia)
export async function GET(_req: NextRequest) {
  return ok(emailConfigStatus());
}

const TestSchema = z.object({ to: z.string().email().max(200) });

// POST /api/v1/careers/notifications/config — kirim email uji
// (butuh sesi kandidat agar tidak disalahgunakan sebagai relay spam)
export async function POST(req: NextRequest) {
  try {
    const session = await getCandidateSessionOrNull(req);
    if (!session) return fail('UNAUTHORIZED', 'Silakan login sebagai kandidat.', 401);
    const body = await req.json().catch(() => ({}));
    const parsed = TestSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Alamat email tujuan tidak valid.', 400);

    const cfg = emailConfigStatus();
    const res = await sendEmail(db, {
      to: parsed.data.to,
      subject: '[E-PerformIQ] Uji Pengiriman Email',
      body: `Ini email uji dari sistem E-PerformIQ.\n\nProvider aktif: ${cfg.provider}\nPengirim: ${cfg.from}\n\n` +
        `Bila Anda menerima email ini, konfigurasi email sudah benar.`,
    });
    return ok({ provider: cfg.provider, status: res.status, outboxId: res.id, config: cfg },
      res.status === 'SENT' ? 'Email uji terkirim.' : 'Email dicatat di outbox (provider belum aktif).');
  } catch (err) {
    return problem(err, '/api/v1/careers/notifications/config');
  }
}
