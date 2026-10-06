import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateInterviewRoom, isGoogleMeetConfigured } from '@/lib/services/googleMeetService';

/**
 * Integrasi Google Meet: ruang wajib dibuat dengan konfigurasi yang mengizinkan
 * kandidat & HR bergabung lewat tautan memakai akun Gmail eksternal.
 * Regresi: sebelumnya `entryPointAccess` tidak di-set sehingga ruang default
 * CREATOR_APP_ONLY dan akun di luar aplikasi gagal bergabung.
 */
describe('googleMeetService', () => {
  const envBackup: Record<string, string | undefined> = {};
  const KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'GOOGLE_MEET_ENABLED'];

  beforeEach(() => {
    for (const k of KEYS) {
      envBackup[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (envBackup[k] === undefined) delete process.env[k];
      else process.env[k] = envBackup[k];
    }
    vi.restoreAllMocks();
  });

  it('menganggap integrasi belum dikonfigurasi tanpa kredensial', () => {
    expect(isGoogleMeetConfigured()).toBe(false);
  });

  it('menganggap integrasi nonaktif bila GOOGLE_MEET_ENABLED=false', () => {
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_REFRESH_TOKEN = 'refresh';
    process.env.GOOGLE_MEET_ENABLED = 'false';
    expect(isGoogleMeetConfigured()).toBe(false);
  });

  it('memakai fallback deterministik saat tidak dikonfigurasi', async () => {
    const result = await generateInterviewRoom();
    expect(result.provider).toBe('FALLBACK');
    expect(result.meetingUrl).toMatch(/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
  });

  it('membuat ruang via REST API dengan accessType OPEN dan entryPointAccess ALL', async () => {
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_REFRESH_TOKEN = 'refresh';

    let createBody: any = null;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (String(url).includes('meet.googleapis.com/v2/spaces')) {
        createBody = JSON.parse(String(init?.body ?? '{}'));
        return new Response(JSON.stringify({ meetingUri: 'https://meet.google.com/abc-defg-hij' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const result = await generateInterviewRoom();
    expect(result.provider).toBe('GOOGLE_MEET_API');
    expect(result.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
    expect(createBody?.config?.accessType).toBe('OPEN');
    expect(createBody?.config?.entryPointAccess).toBe('ALL');
  });

  it('jatuh ke fallback bila Google Meet API menolak permintaan', async () => {
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_REFRESH_TOKEN = 'refresh';

    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { code: 403 } }), { status: 403 });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const result = await generateInterviewRoom();
    expect(result.provider).toBe('FALLBACK');
    expect(result.meetingUrl).toMatch(/^https:\/\/meet\.google\.com\//);
  });
});
