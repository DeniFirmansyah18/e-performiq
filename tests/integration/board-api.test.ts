import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { db } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getActivity } from '@/app/api/v1/analytics/board-activity/route';
import { GET as getVision } from '@/app/api/v1/analytics/vision-achievement/route';
import { GET as getPositionFit } from '@/app/api/v1/analytics/position-fit/route';
import { GET as getCost } from '@/app/api/v1/analytics/board-cost/route';
import { POST as postBoardAnalysis } from '@/app/api/v1/ai/board-analysis/route';
import { saveInsight, hashPayload, getCachedInsight } from '@/lib/services/aiInsightCacheService';
import { resetRateLimit } from '@/lib/api/rateLimit';
import { buildFeatureContext } from '@/lib/services/aiContext';

const BUDI = 'b0000000-0000-4000-8000-000000000004';

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method: 'GET',
    headers: new Headers(cookie ? { cookie } : {}),
  });

async function cookieFor(role: any, employeeId: string | null = null) {
  return `${SESSION_COOKIE_NAME}=${await signSession({
    userId: 'u-test',
    employeeId,
    role,
    email: `${role.toLowerCase()}@eperformiq.co.id`,
  })}`;
}

describe('Boardroom API', () => {
  let client: PGlite;
  let bodCookie = '';
  let empCookie = '';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    const testDb = drizzle(client) as unknown as Db;
    (db as any).execute = (q: any) => testDb.execute(q);

    bodCookie = await cookieFor('BOD');
    empCookie = await cookieFor('EMPLOYEE', BUDI);
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  describe('GET /api/v1/analytics/board-activity', () => {
    it('menolak tanpa sesi (401)', async () => {
      const res = await getActivity(req('/api/v1/analytics/board-activity'));
      expect(res.status).toBe(401);
          const json = await res.json();
          // Klien yang bercabang pada `code` harus melihat UNAUTHORIZED, bukan
          // INTERNAL_ERROR (getAuthSession melempar AuthError, bukan null).
          expect(json.code).toBe('UNAUTHORIZED');
        });

    it('menolak peran tanpa analytics:read (403)', async () => {
      const res = await getActivity(req('/api/v1/analytics/board-activity', empCookie));
      expect(res.status).toBe(403);
    });

    it('mengembalikan analitik aktivitas untuk BOD', async () => {
      const res = await getActivity(
        req('/api/v1/analytics/board-activity?fromDate=2026-09-19&toDate=2026-09-24', bodCookie)
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('success');
      expect(json.data.totalEvents).toBeGreaterThan(0);
      expect(json.data.analysis.highlights.length).toBeGreaterThan(0);
    });

    it('tidak mengirim event RESTRICTED ke klien', async () => {
      const res = await getActivity(
        req('/api/v1/analytics/board-activity?fromDate=2026-09-19&toDate=2026-09-24', bodCookie)
      );
      const json = await res.json();
          const restrictedId = '86000000-0000-4000-8000-00000000000c';
          expect(JSON.stringify(json)).not.toContain('rahasia');
          expect((json.data.recent as Array<{ id: string }>).some((r) => r.id === restrictedId)).toBe(
            false
          );

          // Satu-satunya event DISCIPLINARY di seed bersifat RESTRICTED; bila filter
          // SQL hilang, filter tipe ini akan mengembalikan 1 event.
          const onlyRestricted = await getActivity(
            req(
              '/api/v1/analytics/board-activity?fromDate=2026-09-01&toDate=2026-09-30&eventType=DISCIPLINARY',
              bodCookie
            )
          );
          const restrictedJson = await onlyRestricted.json();
          expect(restrictedJson.data.totalEvents).toBe(0);
          expect(restrictedJson.data.recent).toHaveLength(0);
        });

    it('menolak tipe event tak dikenal (400)', async () => {
      const res = await getActivity(
        req('/api/v1/analytics/board-activity?eventType=BUKAN_TIPE', bodCookie)
      );
      expect(res.status).toBe(400);
    });

    it('menolak tanggal yang tidak ada di kalender (400, bukan 500)', async () => {
      const res = await getActivity(
        req('/api/v1/analytics/board-activity?fromDate=2026-02-31&toDate=2026-03-05', bodCookie)
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.detail).not.toMatch(/date\/time field value out of range/i);
    });

    it('menolak rentang yang terlalu panjang (400)', async () => {
      const res = await getActivity(
        req('/api/v1/analytics/board-activity?fromDate=1900-01-01&toDate=2100-12-31', bodCookie)
      );
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/analytics/vision-achievement', () => {
    it('menolak tanpa sesi (401)', async () => {
      const res = await getVision(req('/api/v1/analytics/vision-achievement'));
      expect(res.status).toBe(401);
    });

    it('mengembalikan capaian pilar dan RJMP untuk BOD', async () => {
      const res = await getVision(
        req('/api/v1/analytics/vision-achievement?periodCode=2026-Q3', bodCookie)
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('success');
      expect(json.data.pillars).toHaveLength(4);
      expect(json.data.rjmp).toHaveLength(4);
      expect(json.data.vision).toContain('kelas dunia');
    });

    it('tidak mengembalikan NaN pada payload', async () => {
      const res = await getVision(req('/api/v1/analytics/vision-achievement', bodCookie));
      const raw = await res.text();
      expect(raw).not.toContain('NaN');
      expect(raw).not.toContain('Infinity');
    });
  });

  describe('GET /api/v1/analytics/position-fit', () => {
    it('menolak tanpa sesi (401)', async () => {
      const res = await getPositionFit(req('/api/v1/analytics/position-fit'));
      expect(res.status).toBe(401);
    });

    it('mengembalikan evaluasi posisi untuk BOD', async () => {
      const res = await getPositionFit(req('/api/v1/analytics/position-fit', bodCookie));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('success');
      expect(json.data.employees.length).toBeGreaterThan(0);
      expect(json.data.analysis.highlights.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/analytics/board-cost', () => {
    it('menolak tanpa sesi (401)', async () => {
      const res = await getCost(req('/api/v1/analytics/board-cost'));
      expect(res.status).toBe(401);
    });

    it('menolak EMPLOYEE karena payroll:read tidak dimiliki (403)', async () => {
      const res = await getCost(req('/api/v1/analytics/board-cost', empCookie));
      expect(res.status).toBe(403);
    });

    it('mengembalikan rincian biaya untuk BOD', async () => {
      const res = await getCost(req('/api/v1/analytics/board-cost', bodCookie));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('success');
      expect(json.data.payroll.latest.periodCode).toBe('2026-09');
      expect(json.data.employees.length).toBeGreaterThan(0);
    });

    it('tidak membocorkan nomor BPJS 16 digit', async () => {
      const res = await getCost(req('/api/v1/analytics/board-cost', bodCookie));
      const raw = await res.text();
      expect(raw).not.toMatch(/\d{16}/);
      expect(raw).toContain('•');
    });

    it('menolak pageSize di luar batas (400)', async () => {
      const res = await getCost(
        req('/api/v1/analytics/board-cost?pageSize=999', bodCookie)
      );
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/ai/board-analysis', () => {
    const postReq = (body: unknown, cookie?: string) =>
      new NextRequest('http://localhost:3000/api/v1/ai/board-analysis', {
        method: 'POST',
        headers: new Headers({
          'Content-Type': 'application/json',
          ...(cookie ? { cookie } : {}),
        }),
        body: JSON.stringify(body),
      });

    it('menolak tanpa sesi (401)', async () => {
      const res = await postBoardAnalysis(postReq({}));
      expect(res.status).toBe(401);
    });

    it('menyajikan cache tanpa memanggil provider saat data belum berubah', async () => {
          const context = await buildFeatureContext(db, 'board');
          await saveInsight(db, {
            feature: 'board',
            periodCode: '2088-Q2',
            role: 'BOD',
            insight: 'Analisis tersimpan.',
            provider: 'groq',
            payloadHash: hashPayload(context),
          });

          const spy = vi.fn(async () => ({
            ok: false,
            status: 429,
            text: async () => 'rate limited',
            json: async () => ({}),
          }));
          const savedFetch = globalThis.fetch;
          const savedEnv = {
            GROQ_API_KEY: process.env.GROQ_API_KEY,
            AI_PROVIDER: process.env.AI_PROVIDER,
          };
          process.env.GROQ_API_KEY = 'test-key';
          process.env.AI_PROVIDER = 'groq';
          vi.stubGlobal('fetch', spy);

          try {
            const res = await postBoardAnalysis(
              postReq({ periodCode: '2088-Q2' }, bodCookie)
            );
            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.data.fromCache).toBe(true);
            expect(json.data.insight).toBe('Analisis tersimpan.');
            // Tidak ada panggilan ke provider LLM.
            expect(spy).not.toHaveBeenCalled();
          } finally {
            vi.stubGlobal('fetch', savedFetch);
            vi.unstubAllGlobals();
            for (const [k, v] of Object.entries(savedEnv)) {
              if (v === undefined) delete process.env[k];
              else process.env[k] = v;
            }
          }
        });

        it('menganggap cache basi bila payload data berubah (payload_hash)', async () => {
          // Hash sengaja tidak cocok dengan konteks saat ini -> cache harus dianggap
          // basi dan tidak disajikan sebagai kebenaran.
          await saveInsight(db, {
            feature: 'board',
            periodCode: '2088-Q3',
            role: 'BOD',
            insight: 'Narasi lama dari data usang.',
            provider: 'groq',
            payloadHash: hashPayload({ stale: true }),
          });

          const savedEnv = {
            GROQ_API_KEY: process.env.GROQ_API_KEY,
            GEMINI_API_KEY: process.env.GEMINI_API_KEY,
            OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
            AI_PROVIDER: process.env.AI_PROVIDER,
          };
          delete process.env.GROQ_API_KEY;
          delete process.env.GEMINI_API_KEY;
          delete process.env.OPENROUTER_API_KEY;
          delete process.env.AI_PROVIDER;

          try {
            const res = await postBoardAnalysis(
              postReq({ periodCode: '2088-Q3' }, bodCookie)
            );
            expect(res.status).toBe(200);
            const json = await res.json();
            // Cache basi tidak boleh disajikan sebagai hasil terkini.
            expect(json.data.fromCache).toBe(false);
            expect(json.data.staleCacheDiscarded).toBe(true);
            expect(json.data.insight).not.toBe('Narasi lama dari data usang.');
          } finally {
            for (const [k, v] of Object.entries(savedEnv)) {
              if (v === undefined) delete process.env[k];
              else process.env[k] = v;
            }
          }
        });

        it('mengembalikan configured:false dengan HTTP 200 saat provider tidak dikonfigurasi', async () => {
      const saved = {
        GROQ_API_KEY: process.env.GROQ_API_KEY,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        AI_PROVIDER: process.env.AI_PROVIDER,
      };
      delete process.env.GROQ_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.AI_PROVIDER;

      try {
        const res = await postBoardAnalysis(
          postReq({ periodCode: '2099-Q1', force: true }, bodCookie)
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.data.configured).toBe(false);
        expect(typeof json.data.insight).toBe('string');
        expect(json.data.fromCache).toBe(false);
      } finally {
        for (const [k, v] of Object.entries(saved)) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
      }
    });

    it('tidak menyimpan kegagalan provider ke cache atau audit', async () => {
      // Provider "terkonfigurasi" tetapi selalu gagal 429 (rate limit).
      const savedFetch = globalThis.fetch;
      const savedEnv = {
        GROQ_API_KEY: process.env.GROQ_API_KEY,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        AI_PROVIDER: process.env.AI_PROVIDER,
      };
      process.env.GROQ_API_KEY = 'test-key';
      process.env.AI_PROVIDER = 'groq';
      delete process.env.GEMINI_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
        json: async () => ({}),
      })));

      try {
        const res = await postBoardAnalysis(
          postReq({ periodCode: '2088-Q1', force: true }, bodCookie)
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.data.failed).toBe(true);
        expect(json.data.insight).not.toMatch(/Maaf, analisis AI gagal/);

        // Kegagalan sementara tidak boleh menjadi narasi permanen di cache.
        const cached = await getCachedInsight(db, {
          feature: 'board',
          periodCode: '2088-Q1',
          role: 'BOD',
        });
        expect(cached).toBeNull();
      } finally {
        vi.stubGlobal('fetch', savedFetch);
        vi.unstubAllGlobals();
        for (const [k, v] of Object.entries(savedEnv)) {
          if (v === undefined) delete process.env[k];
          else process.env[k] = v;
        }
      }
    });
  it('menolak permintaan beruntun dengan 429 (panggilan LLM berbiaya)', async () => {
        const saved = {
          GROQ_API_KEY: process.env.GROQ_API_KEY,
          GEMINI_API_KEY: process.env.GEMINI_API_KEY,
          OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
          AI_PROVIDER: process.env.AI_PROVIDER,
        };
        delete process.env.GROQ_API_KEY;
        delete process.env.GEMINI_API_KEY;
        delete process.env.OPENROUTER_API_KEY;
        delete process.env.AI_PROVIDER;
        resetRateLimit();

        try {
          let sawLimit = false;
          for (let i = 0; i < 25; i++) {
            const res = await postBoardAnalysis(
              postReq({ periodCode: `2077-Q${(i % 4) + 1}`, force: true }, bodCookie)
            );
            if (res.status === 429) {
              sawLimit = true;
              expect(res.headers.get('Retry-After')).toBeTruthy();
              break;
            }
          }
          expect(sawLimit).toBe(true);
        } finally {
          resetRateLimit();
          for (const [k, v] of Object.entries(saved)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
          }
        }
      });
    });
  });
