import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  activeWaProvider,
  whatsappConfigStatus,
  normalizePhone,
  sendWhatsApp,
} from '@/lib/services/whatsappService';

const ENV_KEYS = ['WHATSAPP_PROVIDER', 'WHATSAPP_TOKEN', 'WABLAS_DOMAIN', 'META_PHONE_NUMBER_ID', 'WHATSAPP_WEBHOOK_URL'];
const saved: Record<string, string | undefined> = {};

describe('WS-14 WhatsApp — normalisasi nomor', () => {
  it('08xxx → 628xxx', () => expect(normalizePhone('0812-3456-7890')).toBe('6281234567890'));
  it('+62 812 ... → 62812...', () => expect(normalizePhone('+62 812 3456 7890')).toBe('6281234567890'));
  it('62812... tetap', () => expect(normalizePhone('6281234567890')).toBe('6281234567890'));
  it('8xxx → 628xxx', () => expect(normalizePhone('8123456789')).toBe('628123456789'));
  it('prefix 6208 diperbaiki', () => expect(normalizePhone('6208123456789')).toBe('628123456789'));
  it('kosong/invalid → null', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('abcdef')).toBeNull();
  });
});

describe('WS-14 WhatsApp — deteksi provider', () => {
  beforeAll(() => { for (const k of ENV_KEYS) saved[k] = process.env[k]; });
  afterAll(() => { for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });
  beforeEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });
  afterEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });

  it('tanpa env → none', () => {
    expect(activeWaProvider()).toBe('none');
    expect(whatsappConfigStatus().note).toMatch(/nonaktif/i);
  });

  it('token saja → auto-detect fonnte', () => {
    process.env.WHATSAPP_TOKEN = 'tok';
    expect(activeWaProvider()).toBe('fonnte');
  });

  it('token + WABLAS_DOMAIN → auto-detect wablas', () => {
    process.env.WHATSAPP_TOKEN = 'tok';
    process.env.WABLAS_DOMAIN = 'https://console.wablas.com';
    expect(activeWaProvider()).toBe('wablas');
  });

  it('token + META_PHONE_NUMBER_ID → auto-detect meta', () => {
    process.env.WHATSAPP_TOKEN = 'tok';
    process.env.META_PHONE_NUMBER_ID = '123';
    expect(activeWaProvider()).toBe('meta');
  });

  it('eksplisit wablas tanpa domain → none', () => {
    process.env.WHATSAPP_PROVIDER = 'wablas';
    process.env.WHATSAPP_TOKEN = 'tok';
    expect(activeWaProvider()).toBe('none');
  });
});

describe('WS-14 WhatsApp — pengiriman ke outbox', () => {
  let client: PGlite;
  let db: any;
  beforeAll(async () => { ({ client, db } = await createTestDb()); await runSeed(client); });
  afterAll(async () => { await client.close(); });

  it('nomor invalid → FAILED tanpa baris outbox', async () => {
    const res = await sendWhatsApp(db, { to: '123', message: 'halo' });
    expect(res.status).toBe('FAILED');
    expect(res.id).toBeNull();
  });

  it('provider none → tercatat QUEUED', async () => {
    const prev = process.env.WHATSAPP_PROVIDER;
    delete process.env.WHATSAPP_PROVIDER; delete process.env.WHATSAPP_TOKEN;
    const res = await sendWhatsApp(db, { to: '081234567890', message: 'Uji WA' });
    expect(res.id).toBeTruthy();
    const row = await client.query<{ status: string; phone: string }>(
      `SELECT status::text AS status, phone FROM whatsapp_outbox WHERE id = $1::uuid`, [res.id],
    );
    expect(row.rows[0].phone).toBe('6281234567890');
    expect(row.rows[0].status).toBe('QUEUED');
    if (prev === undefined) delete process.env.WHATSAPP_PROVIDER; else process.env.WHATSAPP_PROVIDER = prev;
  });
});
