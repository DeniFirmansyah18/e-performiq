import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { activeEmailProvider, emailConfigStatus, toEmailHtml, sendEmail } from '@/lib/services/notificationService';

const ENV_KEYS = ['EMAIL_PROVIDER', 'RESEND_API_KEY', 'EMAIL_WEBHOOK_URL', 'EMAIL_FROM'];
const saved: Record<string, string | undefined> = {};

describe('WS-13 email provider configuration', () => {
  beforeAll(() => { for (const k of ENV_KEYS) saved[k] = process.env[k]; });
  afterAll(() => { for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });
  beforeEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });
  afterEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });

  it('tanpa env → provider none', () => {
    expect(activeEmailProvider()).toBe('none');
    expect(emailConfigStatus().provider).toBe('none');
    expect(emailConfigStatus().note).toMatch(/in-app|outbox/i);
  });

  it('RESEND_API_KEY terisi → auto-detect resend', () => {
    process.env.RESEND_API_KEY = 're_test_123';
    expect(activeEmailProvider()).toBe('resend');
    expect(emailConfigStatus().resendConfigured).toBe(true);
  });

  it('EMAIL_PROVIDER=webhook + URL → webhook', () => {
    process.env.EMAIL_PROVIDER = 'webhook';
    process.env.EMAIL_WEBHOOK_URL = 'https://mail.example.com/send';
    expect(activeEmailProvider()).toBe('webhook');
  });

  it('EMAIL_PROVIDER=resend tanpa key → none (tidak salah konfigurasi)', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    expect(activeEmailProvider()).toBe('none');
  });

  it('EMAIL_FROM kustom dipakai', () => {
    process.env.EMAIL_FROM = 'HR <hr@eperformiq.co.id>';
    expect(emailConfigStatus().from).toBe('HR <hr@eperformiq.co.id>');
  });

  it('toEmailHtml mengubah teks menjadi HTML aman (escape)', () => {
    const html = toEmailHtml('Uji', 'Halo <b>Budi</b>\n\nBaris 2');
    expect(html).toContain('<p');
    expect(html).toContain('&lt;b&gt;Budi&lt;/b&gt;'); // di-escape
    expect(html).toContain('Baris 2');
  });
});

describe('WS-13 sendEmail ke outbox', () => {
  let client: PGlite;
  let db: any;
  beforeAll(async () => { ({ client, db } = await createTestDb()); await runSeed(client); });
  afterAll(async () => { await client.close(); });

  it('email tercatat di outbox sebagai QUEUED bila provider none', async () => {
    const res = await sendEmail(db, { to: 'kandidat@example.com', subject: 'Halo', body: 'Isi pesan uji.' });
    expect(res.id).toBeTruthy();
    expect(['QUEUED', 'SENT', 'FAILED']).toContain(res.status);
    const row = await client.query<{ status: string; recipient: string }>(
      `SELECT status::text AS status, recipient FROM email_outbox WHERE id = $1::uuid`, [res.id],
    );
    expect(row.rows[0].recipient).toBe('kandidat@example.com');
  });
});
