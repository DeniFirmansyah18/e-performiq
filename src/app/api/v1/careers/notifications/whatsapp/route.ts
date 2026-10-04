import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getCandidateSessionOrNull } from '@/lib/auth/candidateSession';
import { ok, fail, problem } from '@/lib/api/response';
import { whatsappConfigStatus, sendWhatsApp, normalizePhone } from '@/lib/services/whatsappService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/careers/notifications/whatsapp — status konfigurasi WhatsApp (tanpa rahasia)
export async function GET(_req: NextRequest) {
  return ok(whatsappConfigStatus());
}

const TestSchema = z.object({ to: z.string().min(8).max(30), message: z.string().max(1000).optional() });

// POST /api/v1/careers/notifications/whatsapp — kirim pesan WhatsApp uji
// (butuh sesi kandidat agar tidak disalahgunakan sebagai relay spam)
export async function POST(req: NextRequest) {
  try {
    const session = await getCandidateSessionOrNull(req);
    if (!session) return fail('UNAUTHORIZED', 'Silakan login sebagai kandidat.', 401);
    const body = await req.json().catch(() => ({}));
    const parsed = TestSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Nomor WhatsApp tujuan tidak valid.', 400);
    if (!normalizePhone(parsed.data.to)) {
      return fail('VALIDATION_ERROR', 'Format nomor tidak valid (contoh: 0812xxxxxxx atau 62812xxxxxxx).', 400);
    }

    const cfg = whatsappConfigStatus();
    const res = await sendWhatsApp(db, {
      to: parsed.data.to,
      message: parsed.data.message || '*E-PerformIQ*\nIni pesan uji WhatsApp. Bila Anda menerima pesan ini, konfigurasi WhatsApp sudah benar.',
    });
    return ok({ provider: cfg.provider, status: res.status, outboxId: res.id, config: cfg },
      res.status === 'SENT' ? 'Pesan WhatsApp uji terkirim.' : 'Pesan dicatat di whatsapp_outbox (provider belum aktif).');
  } catch (err) {
    return problem(err, '/api/v1/careers/notifications/whatsapp');
  }
}
