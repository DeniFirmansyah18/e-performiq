/**
 * WhatsApp Notification Service (WS-14) — notifikasi progress lamaran via WhatsApp.
 *
 * Provider-agnostic, mendukung penyedia populer di Indonesia (tanpa dependensi berat,
 * murni `fetch`):
 *  - FONNTE   : https://fonnte.com  (populer, sederhana)   → WHATSAPP_TOKEN fonnte
 *  - WABLAS   : https://wablas.com  (populer)              → WHATSAPP_TOKEN + domain
 *  - META     : WhatsApp Cloud API resmi (graph.facebook.com)
 *  - WEBHOOK  : gateway HTTP/SMTP sendiri (menerima POST JSON {target,message})
 *
 * Semua pengiriman dicatat ke `whatsapp_outbox` (audit + fallback antrean).
 * Best-effort: kegagalan WhatsApp TIDAK boleh menggagalkan alur utama.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export type WaProvider = 'fonnte' | 'wablas' | 'meta' | 'webhook' | 'none';

export interface WaMessage {
  to: string;               // nomor tujuan (format bebas; akan dinormalisasi)
  message: string;
  applicationId?: string | null;
}

/** Provider WhatsApp aktif berdasarkan env. */
export function activeWaProvider(): WaProvider {
  const explicit = (process.env.WHATSAPP_PROVIDER || '').toLowerCase();
  if (explicit === 'fonnte') return process.env.WHATSAPP_TOKEN ? 'fonnte' : 'none';
  if (explicit === 'wablas') return process.env.WHATSAPP_TOKEN && process.env.WABLAS_DOMAIN ? 'wablas' : 'none';
  if (explicit === 'meta') return process.env.WHATSAPP_TOKEN && process.env.META_PHONE_NUMBER_ID ? 'meta' : 'none';
  if (explicit === 'webhook') return process.env.WHATSAPP_WEBHOOK_URL ? 'webhook' : 'none';
  // Auto-detect.
  if (process.env.WHATSAPP_TOKEN && process.env.WABLAS_DOMAIN) return 'wablas';
  if (process.env.WHATSAPP_TOKEN && process.env.META_PHONE_NUMBER_ID) return 'meta';
  if (process.env.WHATSAPP_TOKEN) return 'fonnte';
  if (process.env.WHATSAPP_WEBHOOK_URL) return 'webhook';
  return 'none';
}

/** Status konfigurasi WhatsApp (tanpa membocorkan rahasia). */
export function whatsappConfigStatus() {
  const provider = activeWaProvider();
  return {
    provider,
    fonnteConfigured: !!process.env.WHATSAPP_TOKEN && !process.env.WABLAS_DOMAIN && !process.env.META_PHONE_NUMBER_ID,
    wablasConfigured: !!process.env.WHATSAPP_TOKEN && !!process.env.WABLAS_DOMAIN,
    metaConfigured: !!process.env.WHATSAPP_TOKEN && !!process.env.META_PHONE_NUMBER_ID,
    webhookConfigured: !!process.env.WHATSAPP_WEBHOOK_URL,
    note: provider === 'none'
      ? 'WhatsApp nonaktif: notifikasi tetap tampil in-app + email (bila aktif) dan tercatat di whatsapp_outbox (QUEUED).'
      : `WhatsApp aktif via ${provider.toUpperCase()}.`,
  };
}

/**
 * Normalisasi nomor telepon Indonesia → format internasional tanpa '+' (62812...).
 * Menerima: '0812-3456-7890', '+62 812 3456 7890', '6281234567890', '81234567890'.
 * Mengembalikan null bila tidak valid.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  // Hilangkan prefix 620 yang mungkin muncul (mis. '6208...').
  if (digits.startsWith('620')) digits = '62' + digits.slice(3);
  // Validasi kasar panjang nomor Indonesia (10–15 digit, diawali 62).
  if (!/^62\d{8,13}$/.test(digits)) return null;
  return digits;
}

/** Simpan ke outbox. */
async function queueOutbox(db: Db, msg: WaMessage, provider: WaProvider): Promise<string | null> {
  try {
    const res = (await db.execute(sql`
      INSERT INTO whatsapp_outbox (phone, message, status, provider, related_application_id)
      VALUES (${msg.to}, ${msg.message}, 'QUEUED', ${provider === 'none' ? null : provider.toUpperCase()},
              ${msg.applicationId ?? null}::uuid)
      RETURNING id
    `)) as unknown as { rows: Array<{ id: string }> };
    return res.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function updateOutbox(db: Db, id: string | null, status: string, error: string | null): Promise<void> {
  if (!id) return;
  try {
    await db.execute(sql`
      UPDATE whatsapp_outbox SET status = ${status}::wa_status_enum, error = ${error},
             sent_at = CASE WHEN ${status} = 'SENT' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = ${id}::uuid
    `);
  } catch { /* abaikan */ }
}

/** Panggil API provider sesuai tipe. Mengembalikan { ok, error }. */
async function dispatch(provider: WaProvider, to: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.WHATSAPP_TOKEN || '';
  try {
    if (provider === 'fonnte') {
      const body = new URLSearchParams({ target: to, message, countryCode: '62' });
      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: token },
        body,
      });
      if (!res.ok) return { ok: false, error: `fonnte ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}` };
      const j: any = await res.json().catch(() => ({}));
      return j?.status === false ? { ok: false, error: `fonnte: ${j?.reason ?? 'gagal'}` } : { ok: true };
    }

    if (provider === 'wablas') {
      const domain = process.env.WABLAS_DOMAIN as string; // mis. https://console.wablas.com
      const res = await fetch(`${domain.replace(/\/$/, '')}/api/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ phone: to, message }),
      });
      if (!res.ok) return { ok: false, error: `wablas ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}` };
      const j: any = await res.json().catch(() => ({}));
      return j?.status === false ? { ok: false, error: `wablas: ${j?.message ?? 'gagal'}` } : { ok: true };
    }

    if (provider === 'meta') {
      const phoneId = process.env.META_PHONE_NUMBER_ID as string;
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
      });
      if (!res.ok) return { ok: false, error: `meta ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}` };
      return { ok: true };
    }

    if (provider === 'webhook') {
      const res = await fetch(process.env.WHATSAPP_WEBHOOK_URL as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.WHATSAPP_WEBHOOK_AUTH ? { Authorization: process.env.WHATSAPP_WEBHOOK_AUTH } : {}),
        },
        body: JSON.stringify({ target: to, message }),
      });
      if (!res.ok) return { ok: false, error: `webhook ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}` };
      return { ok: true };
    }

    return { ok: false, error: 'provider none' };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? 'network' };
  }
}

/** Kirim satu pesan WhatsApp (dengan pencatatan outbox). */
export async function sendWhatsApp(db: Db, msg: WaMessage): Promise<{ id: string | null; status: string }> {
  const provider = activeWaProvider();
  const to = normalizePhone(msg.to);
  if (!to) return { id: null, status: 'FAILED' };

  const outboxId = await queueOutbox(db, { ...msg, to }, provider);
  if (provider === 'none') return { id: outboxId, status: 'QUEUED' };

  const result = await dispatch(provider, to, msg.message);
  if (result.ok) {
    await updateOutbox(db, outboxId, 'SENT', null);
    return { id: outboxId, status: 'SENT' };
  }
  await updateOutbox(db, outboxId, 'FAILED', result.error ?? 'gagal');
  return { id: outboxId, status: 'FAILED' };
}
