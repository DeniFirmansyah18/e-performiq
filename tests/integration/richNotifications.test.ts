import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import {
  toEmailHtml,
  sendEmail,
  notifyEmployeeLifecycle,
  listEmployeeNotifications,
  unreadEmployeeNotificationCount,
  markEmployeeNotificationsRead,
} from '@/lib/services/notificationService';

const EMP = 'b0000000-0000-4000-8000-000000000004'; // Budi (EMPLOYEE, punya email)
const Q = { employeeId: EMP };

describe('Stage R3 — notifikasi in-app/email lebih kaya', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });
  afterAll(async () => { await client.close(); });

  it('toEmailHtml menyertakan aksen severity, badge, dan tombol CTA', () => {
    const html = toEmailHtml('Penawaran Kerja', 'Selamat, Anda diterima.', {
      severity: 'SUCCESS',
      preheader: 'Penawaran menanti Anda',
      cta: { label: 'Buka Portal', url: 'https://example.com/portal' },
    });
    expect(html).toContain('#16a34a');           // aksen SUCCESS
    expect(html).toContain('Berhasil');           // label severity
    expect(html).toContain('Buka Portal');        // CTA
    expect(html).toContain('https://example.com/portal');
    expect(html).toContain('Penawaran menanti Anda'); // preheader
  });

  it('toEmailHtml meng-escape HTML (anti-XSS)', () => {
    const html = toEmailHtml('Judul <script>', '<b>jahat</b> & co');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>jahat</b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp; co');
  });

  it('sendEmail menyimpan html ber-brand ke outbox', async () => {
    const res = await sendEmail(db, {
      to: `rich.${Date.now()}@example.com`,
      subject: 'Payslip Siap',
      body: 'Payslip periode ini sudah tersedia.',
      severity: 'WARNING',
      category: 'PAYROLL',
      cta: { label: 'Unduh', url: 'https://example.com/payroll' },
    });
    expect(res.id).toBeTruthy();
    // Email ternak di outbox (QUEUED saat tanpa provider).
    const out = await client.query<{ body: string }>(
      `SELECT body FROM email_outbox WHERE id = $1::uuid`, [res.id]);
    expect(out.rows[0].body).toContain('Payslip');
  });

  it('notifyEmployeeLifecycle menyimpan kategori, severity, actionUrl, emailStatus', async () => {
    await notifyEmployeeLifecycle(db, {
      employeeId: EMP,
      eventType: 'PAYSLIP_READY',
      title: 'Payslip Siap Diunduh',
      body: 'Payslip periode berjalan sudah tersedia di portal.',
    });
    const rows = await listEmployeeNotifications(db, Q);
    const row = rows.find((r: any) => r.eventType === 'PAYSLIP_READY');
    expect(row).toBeTruthy();
    expect(row.category).toBe('PAYROLL');
    expect(row.severity).toBe('INFO');
    expect(row.actionUrl).toBe('/dashboard/payroll');
    expect(row.emailStatus).toBeTruthy(); // provider none → QUEUED
    expect(row.isRead).toBe(false);
  });

  it('unread count & markEmployeeNotificationsRead bekerja (badge)', async () => {
    const before = await unreadEmployeeNotificationCount(db, Q);
    expect(before).toBeGreaterThanOrEqual(1);
    await markEmployeeNotificationsRead(db, Q);
    const after = await unreadEmployeeNotificationCount(db, Q);
    expect(after).toBe(0);
  });

  it('menghormati severity kustom pada event kritis', async () => {
    await notifyEmployeeLifecycle(db, {
      employeeId: EMP,
      eventType: 'CONTRACT_ENDING',
      title: 'Kontrak Akan Berakhir',
      body: 'Kontrak Anda berakhir dalam 30 hari.',
      severity: 'CRITICAL',
      cta: { label: 'Lihat Kontrak', url: 'https://example.com/contract' },
    });
    const rows = await listEmployeeNotifications(db, Q);
    const row = rows.find((r: any) => r.eventType === 'CONTRACT_ENDING');
    expect(row.severity).toBe('CRITICAL');
    expect(row.category).toBe('CONTRACT');
    expect(row.actionUrl).toBe('https://example.com/contract');
  });

  it('notifikasi lintas-role: peran melihat event perannya, bukan milik peran lain', async () => {
    await notifyEmployeeLifecycle(db, {
      role: 'HR_MANAGER',
      eventType: 'LEAVE_REQUESTED',
      title: 'Pengajuan Cuti Baru',
      body: 'Ada pengajuan cuti menunggu review.',
    });
    const hrQ = { role: 'HR_MANAGER' as const };
    const hrRows = await listEmployeeNotifications(db, hrQ);
    expect(hrRows.some((r: any) => r.eventType === 'LEAVE_REQUESTED')).toBe(true);
    // Karyawan lain (EMPLOYEE) tak ikut menerima.
    const empRows = await listEmployeeNotifications(db, { role: 'EMPLOYEE' as const });
    expect(empRows.some((r: any) => r.eventType === 'LEAVE_REQUESTED')).toBe(false);
  });
});
