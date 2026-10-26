# Executive Boardroom BOD (Narasi 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengubah `/dashboard/executive` menjadi Boardroom Cockpit 5 tab yang memungkinkan BOD melihat aktivitas semua profil, kotak visi-misi berpersentase dengan analisis AI, kesesuaian performa pegawai terhadap posisi & RJMP, serta rincian payroll/BPJS/lembur/operasional — semuanya dalam bentuk analisis.

**Architecture:** Satu service per kapabilitas, satu route per tab, sehingga kegagalan satu tab tidak menjatuhkan tab lain. Agregasi dilakukan di SQL. Analisis AI bersifat on-demand dan di-cache di tabel `ai_insights`. Tidak ada angka cadangan: kegagalan API ditampilkan sebagai kegagalan.

**Tech Stack:** Next.js 14 App Router (client components), TypeScript, Tailwind CSS, Lucide React, Drizzle ORM di atas PGlite (test) / PostgreSQL (produksi), Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-25-bod-boardroom-narasi-4-design.md`

## Global Constraints

- Nomor BPJS **wajib** ter-masking di seluruh respons; BOD tidak diberi izin `social_security:reveal`.
- `activity_events.visibility = 'RESTRICTED'` **wajib** dikecualikan di klausa SQL, bukan di filter UI.
- Gaji, komponen payroll, dan nomor BPJS **tidak boleh** masuk konteks AI (allowlist kunci, bukan denylist).
- Tidak boleh ada angka cadangan hardcoded di UI. API gagal → tampilkan kegagalan.
- Semua pembagian wajib aman terhadap nol: pilar tanpa KPI, posisi tanpa template, run payroll kosong.
- `audit_logs.action_type` hanya mengizinkan `CREATE|UPDATE|DELETE|CALIBRATE|DISBURSE|APPROVE|LOGIN|LOGOUT|UNLOCK`. Jangan menambah nilai baru.
- Setiap respons analitik menyertakan `sampleSize`.
- Semua route baru memakai pola: `getAuthSession` → `assertCan` → `ok`/`fail` dari `@/lib/api/response`.
- Tanggal "hari ini" memakai WIB (`todayInJakarta`), bukan `toISOString()`.
- `tsconfig.json` memakai `target: "es5"` **tanpa** `downlevelIteration`. Spread pada iterator `Map`/`Set` (mis. `[...map.entries()]`) **gagal** dengan TS2802. Selalu pakai `Array.from(...)`. Spread pada array (`[...arr]`) tetap aman.

## Review Focus

1. **API gagal tetapi layar tetap menampilkan angka** — BOD menyimpulkan perusahaan sehat padahal data tidak termuat. Test: panel menampilkan pesan gagal dan **tidak** merender nilai apa pun.
2. **Nomor BPJS bocor utuh di JSON** walau UI mem-mask. Test: regex `\d{16}` tidak boleh cocok pada body respons `board-cost`.
3. **Event RESTRICTED ikut terkirim** karena filter hanya di UI. Test: ringkasan event RESTRICTED tidak muncul di payload `board-activity`.
4. **NaN/Infinity saat pembagi nol** (pilar tanpa KPI, posisi tanpa template, run payroll kosong). Test: setiap persentase `Number.isFinite` dan bernilai 0 saat tanpa data.
5. **AI menerima konteks terlarang atau mengarang angka** — narasi BOD melanggar klasifikasi data. Test: konteks AI tidak memuat kunci gaji/BPJS, dan tanpa kunci provider endpoint mengembalikan `configured:false` dengan HTTP 200.

---

### Task 1: Migrasi `ai_insights` + `aiInsightCacheService`

**Files:**
- Create: `src/lib/db/migrations/0057_ai_insights.sql`
- Create: `src/lib/services/aiInsightCacheService.ts`
- Test: `tests/unit/aiInsightCacheService.test.ts`

**Interfaces:**
- Consumes: `Db` dari `@/lib/db/client`
- Produces:
  - `hashPayload(context: unknown): string`
  - `stableStringify(value: unknown): string`
  - `getCachedInsight(db: Db, key: InsightKey): Promise<CachedInsight | null>`
  - `saveInsight(db: Db, input: InsightKey & { insight: string; provider: string | null; payloadHash: string }): Promise<void>`
  - `interface InsightKey { feature: string; periodCode: string; role: string }`
  - `interface CachedInsight { insight: string; provider: string | null; generatedAt: string; payloadHash: string }`

- [ ] **Step 1: Write the failing test**

Buat `tests/unit/aiInsightCacheService.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import type { Db } from '@/lib/db/client';
import {
  getCachedInsight,
  saveInsight,
  hashPayload,
} from '@/lib/services/aiInsightCacheService';

describe('AI Insight Cache', () => {
  let client: PGlite;
  let db: Db;

  const KEY = { feature: 'board', periodCode: '2026-Q3', role: 'BOD' };

  beforeAll(async () => {
    ({ client } = await createTestDb());
    db = drizzle(client) as unknown as Db;
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  it('mengembalikan null saat cache belum ada', async () => {
    const cached = await getCachedInsight(db, KEY);
    expect(cached).toBeNull();
  });

  it('menyimpan lalu membaca kembali cache', async () => {
    await saveInsight(db, {
      ...KEY,
      insight: 'Ringkasan kondisi korporat.',
      provider: 'groq',
      payloadHash: hashPayload({ a: 1 }),
    });

    const cached = await getCachedInsight(db, KEY);
    expect(cached?.insight).toBe('Ringkasan kondisi korporat.');
    expect(cached?.provider).toBe('groq');
    expect(cached?.payloadHash).toBe(hashPayload({ a: 1 }));
    expect(Number.isNaN(Date.parse(cached!.generatedAt))).toBe(false);
  });

  it('penyimpanan kedua menimpa baris yang sama, bukan menggandakan', async () => {
    await saveInsight(db, {
      ...KEY,
      insight: 'Versi kedua.',
      provider: 'gemini',
      payloadHash: hashPayload({ a: 2 }),
    });

    const cached = await getCachedInsight(db, KEY);
    expect(cached?.insight).toBe('Versi kedua.');
    expect(cached?.provider).toBe('gemini');

    const count = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ai_insights WHERE feature = 'board'`
    );
    expect(count.rows[0].n).toBe(1);
  });

  it('cache dipisah per periode dan peran', async () => {
    const other = await getCachedInsight(db, { ...KEY, periodCode: '2026-Q4' });
    expect(other).toBeNull();

    const otherRole = await getCachedInsight(db, { ...KEY, role: 'HR_MANAGER' });
    expect(otherRole).toBeNull();
  });

  it('hashPayload stabil terhadap urutan kunci', async () => {
    expect(hashPayload({ b: 2, a: 1 })).toBe(hashPayload({ a: 1, b: 2 }));
  });

  it('hashPayload berubah saat nilai berubah', async () => {
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
  });

  it('hashPayload menangani null, array, dan nilai bersarang', async () => {
    expect(hashPayload(null)).toHaveLength(64);
    expect(hashPayload([1, { z: 2, a: 3 }])).toBe(hashPayload([1, { a: 3, z: 2 }]));
    expect(hashPayload({ x: undefined })).toHaveLength(64);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/aiInsightCacheService.test.ts`
Expected: FAIL — `Cannot find module '@/lib/services/aiInsightCacheService'` dan tabel `ai_insights` belum ada.

- [ ] **Step 3: Write the migration**

Buat `src/lib/db/migrations/0057_ai_insights.sql`:

```sql
-- 0057: Cache hasil analisis AI per (fitur, periode, peran).
-- Aditif & idempoten (ADR 003). Tanpa cache, setiap klik "Analisis ulang"
-- memanggil provider dan berisiko kena rate limit saat rapat BOD.
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature VARCHAR(64) NOT NULL,
  period_code VARCHAR(50) NOT NULL DEFAULT 'ALL',
  role VARCHAR(40) NOT NULL,
  insight TEXT NOT NULL,
  provider VARCHAR(32),
  payload_hash CHAR(64) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (feature, period_code, role)
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_lookup
  ON ai_insights (feature, period_code, role);
```

- [ ] **Step 4: Write the implementation**

Buat `src/lib/services/aiInsightCacheService.ts`:

```ts
import { sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { Db } from '@/lib/db/client';

export interface InsightKey {
  feature: string;
  periodCode: string;
  role: string;
}

export interface CachedInsight {
  insight: string;
  provider: string | null;
  generatedAt: string;
  payloadHash: string;
}

/**
 * JSON dengan kunci terurut stabil. Tanpa ini, urutan kunci objek membuat
 * hash berubah padahal datanya sama, sehingga cache selalu dianggap basi.
 */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function hashPayload(context: unknown): string {
  return createHash('sha256').update(stableStringify(context), 'utf8').digest('hex');
}

export async function getCachedInsight(db: Db, key: InsightKey): Promise<CachedInsight | null> {
  const res = (await db.execute(sql`
    SELECT insight, provider, generated_at AS "generatedAt", payload_hash AS "payloadHash"
      FROM ai_insights
     WHERE feature = ${key.feature}
       AND period_code = ${key.periodCode}
       AND role = ${key.role}
     LIMIT 1
  `)) as unknown as {
    rows: Array<{
      insight: string;
      provider: string | null;
      generatedAt: unknown;
      payloadHash: string;
    }>;
  };

  const row = res.rows?.[0];
  if (!row) return null;

  return {
    insight: row.insight,
    provider: row.provider,
    generatedAt: new Date(row.generatedAt as string).toISOString(),
    payloadHash: row.payloadHash,
  };
}

export async function saveInsight(
  db: Db,
  input: InsightKey & { insight: string; provider: string | null; payloadHash: string }
): Promise<void> {
  await db.execute(sql`
    INSERT INTO ai_insights (feature, period_code, role, insight, provider, payload_hash, generated_at)
    VALUES (${input.feature}, ${input.periodCode}, ${input.role},
            ${input.insight}, ${input.provider}, ${input.payloadHash}, NOW())
    ON CONFLICT (feature, period_code, role) DO UPDATE
       SET insight = EXCLUDED.insight,
           provider = EXCLUDED.provider,
           payload_hash = EXCLUDED.payload_hash,
           generated_at = NOW()
  `);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/aiInsightCacheService.test.ts`
Expected: PASS (7 test).

- [ ] **Step 6: Verify migration idempotency**

Run: `npx vitest run tests/integration/schema-migrations.test.ts`
Expected: PASS — seluruh migrasi dapat diterapkan dua kali tanpa error.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/migrations/0057_ai_insights.sql src/lib/services/aiInsightCacheService.ts tests/unit/aiInsightCacheService.test.ts
git commit -m "feat(ai): cache hasil analisis AI per fitur-periode-peran"
```

---

### Task 2: Seed data operasional (aktivitas, payroll, BPJS, lembur)

**Files:**
- Modify: `src/lib/db/seed/index.ts` (tambahkan blok "32." sebelum penutup template literal di sekitar baris 501)
- Test: `tests/integration/board-seed.test.ts`

**Interfaces:**
- Consumes: tabel `activity_events`, `payroll_runs`, `payroll_items`, `employee_social_security`, `overtime_requests`
- Produces: data contoh yang membuat tab Aktivitas, Biaya, dan BPJS dapat didemonstrasikan pada instalasi baru.

**Latar (hasil pengukuran seed saat ini):** `activity_events = 0`, `payroll_runs = 0`, `payroll_items = 0`, `employee_social_security = 0`, `overtime_requests = 0`. Tanpa task ini, 3 dari 5 tab hanya menampilkan keadaan kosong.

- [ ] **Step 1: Write the failing test**

Buat `tests/integration/board-seed.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';

describe('Seed data operasional Boardroom', () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  const count = async (table: string): Promise<number> => {
    const r = await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
    return r.rows[0].n;
  };

  it('menyediakan event aktivitas lintas tipe dan peran', async () => {
    expect(await count('activity_events')).toBeGreaterThanOrEqual(10);
    const types = await client.query<{ n: number }>(
      `SELECT count(DISTINCT event_type)::int AS n FROM activity_events`
    );
    expect(types.rows[0].n).toBeGreaterThanOrEqual(4);
  });

  it('menyediakan minimal satu event RESTRICTED untuk menguji pengecualian', async () => {
    const r = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM activity_events WHERE visibility = 'RESTRICTED'`
    );
    expect(r.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('menyediakan run payroll beserta itemnya', async () => {
    expect(await count('payroll_runs')).toBeGreaterThanOrEqual(1);
    expect(await count('payroll_items')).toBeGreaterThanOrEqual(3);
    const r = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM payroll_items WHERE net > 0`
    );
    expect(r.rows[0].n).toBeGreaterThanOrEqual(3);
  });

  it('total run payroll konsisten dengan jumlah itemnya', async () => {
    const r = await client.query<{ run_id: string; selisih_gross: number; selisih_net: number }>(
      `SELECT pr.id AS run_id,
              (pr.total_gross - COALESCE(SUM(pi.gross), 0))::float8 AS selisih_gross,
              (pr.total_net - COALESCE(SUM(pi.net), 0))::float8 AS selisih_net
         FROM payroll_runs pr
         LEFT JOIN payroll_items pi ON pi.run_id = pr.id
        GROUP BY pr.id, pr.total_gross, pr.total_net`
    );
    expect(r.rows.length).toBeGreaterThan(0);
    for (const row of r.rows) {
      expect(Math.abs(Number(row.selisih_gross))).toBeLessThan(0.01);
      expect(Math.abs(Number(row.selisih_net))).toBeLessThan(0.01);
    }
  });

  it('menyediakan kartu BPJS terisi dan yang masih kosong', async () => {
    expect(await count('employee_social_security')).toBeGreaterThanOrEqual(2);
    const withNumber = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM employee_social_security WHERE bpjs_kes_number IS NOT NULL`
    );
    expect(withNumber.rows[0].n).toBeGreaterThanOrEqual(2);
  });

  it('menyediakan pengajuan lembur termasuk yang menunggu persetujuan', async () => {
    expect(await count('overtime_requests')).toBeGreaterThanOrEqual(2);
    const pending = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM overtime_requests WHERE status = 'SUBMITTED'`
    );
    expect(pending.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('idempoten: seed kedua tidak menggandakan baris', async () => {
    const before = {
      activity: await count('activity_events'),
      runs: await count('payroll_runs'),
      items: await count('payroll_items'),
      bpjs: await count('employee_social_security'),
      overtime: await count('overtime_requests'),
    };

    await runSeed(client);

    expect(await count('activity_events')).toBe(before.activity);
    expect(await count('payroll_runs')).toBe(before.runs);
    expect(await count('payroll_items')).toBe(before.items);
    expect(await count('employee_social_security')).toBe(before.bpjs);
    expect(await count('overtime_requests')).toBe(before.overtime);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/board-seed.test.ts`
Expected: FAIL — `expected 0 to be greater than or equal to 10` pada test pertama.

- [ ] **Step 3: Add the seed block**

Buka `src/lib/db/seed/index.ts`, cari komentar `-- 31. Certificate contoh` dan blok penutupnya, lalu tambahkan **sebelum** baris `` `); `` yang menutup template literal (sekitar baris 501):

```sql
-- 32. Boardroom (Narasi 4): aktivitas, payroll, BPJS, lembur.
-- Idempoten via id tetap + ON CONFLICT DO NOTHING. Satu event sengaja
-- RESTRICTED agar pengecualian data sensitif dapat diuji.
INSERT INTO activity_events (id, employee_id, event_type, summary, visibility, occurred_at) VALUES
  ('86000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004','ATTENDANCE','Check-in tepat waktu 08:00 WIB','INTERNAL','2026-09-24T01:00:00Z'),
  ('86000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000004','KPI_DAILY','Mengisi KPI harian: SLA tiket Tier-1','INTERNAL','2026-09-24T02:30:00Z'),
  ('86000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000004','OVERTIME','Lembur 2 jam untuk rilis patch produksi','INTERNAL','2026-09-24T12:00:00Z'),
  ('86000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000007','TRAINING','Menyelesaikan modul Leadership Essentials','INTERNAL','2026-09-23T03:00:00Z'),
  ('86000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000007','KPI_DAILY','Mengisi KPI harian: ketepatan desain','INTERNAL','2026-09-23T04:15:00Z'),
  ('86000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000003','CAREER','Persetujuan rencana pengembangan tim','INTERNAL','2026-09-22T05:00:00Z'),
  ('86000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000003','KPI_DAILY','Verifikasi KPI anggota tim','INTERNAL','2026-09-22T06:30:00Z'),
  ('86000000-0000-4000-8000-000000000008','b0000000-0000-4000-8000-000000000002','LETTER','Disposisi surat penawaran kerja','CONFIDENTIAL','2026-09-21T02:00:00Z'),
  ('86000000-0000-4000-8000-000000000009','b0000000-0000-4000-8000-000000000002','RECOGNITION','Penghargaan pegawai teladan kuartal','INTERNAL','2026-09-21T07:00:00Z'),
  ('86000000-0000-4000-8000-00000000000a','b0000000-0000-4000-8000-000000000008','ATTENDANCE','Check-in 08:12 WIB','INTERNAL','2026-09-20T01:12:00Z'),
  ('86000000-0000-4000-8000-00000000000b','b0000000-0000-4000-8000-000000000008','LEAVE','Pengajuan cuti tahunan 2 hari','INTERNAL','2026-09-20T03:00:00Z'),
  ('86000000-0000-4000-8000-00000000000c','b0000000-0000-4000-8000-000000000005','DISCIPLINARY','Catatan pemeriksaan internal (rahasia)','RESTRICTED','2026-09-19T04:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO payroll_runs (id, period_code, period_start, period_end, status, is_thr_month, total_gross, total_deductions, total_net, note, approved_at) VALUES
  ('87000000-0000-4000-8000-000000000001','2026-09','2026-09-01','2026-09-30','APPROVED',FALSE,150250000,14540000,135710000,'Run payroll September 2026','2026-09-30T10:00:00Z'),
  ('87000000-0000-4000-8000-000000000002','2026-08','2026-08-01','2026-08-31','PAID',FALSE,149500000,14540000,134960000,'Run payroll Agustus 2026','2026-08-31T10:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO payroll_items (id, run_id, employee_id, base_salary, fixed_allowance, overtime_pay, bonus, thr,
                           bpjs_kesehatan, bpjs_jht, bpjs_jp, pph21, overtime_hours, present_days, working_days,
                           gross, total_deductions, net) VALUES
  ('88000000-0000-4000-8000-000000000001','87000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004',28500000,2500000,750000,0,0,285000,570000,285000,1500000,2.00,22,22,31750000,2640000,29110000),
  ('88000000-0000-4000-8000-000000000002','87000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000007',18000000,1500000,0,0,0,180000,360000,180000,800000,0.00,22,22,19500000,1520000,17980000),
  ('88000000-0000-4000-8000-000000000003','87000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000008',24000000,2000000,0,0,0,240000,480000,240000,1200000,0.00,21,22,26000000,2160000,23840000),
  ('88000000-0000-4000-8000-000000000004','87000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000003',68000000,5000000,0,0,0,680000,1360000,680000,5500000,0.00,22,22,73000000,8220000,64780000),
  ('88000000-0000-4000-8000-000000000005','87000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000004',28500000,2500000,0,0,0,285000,570000,285000,1500000,0.00,22,22,31000000,2640000,28360000),
  ('88000000-0000-4000-8000-000000000006','87000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000007',18000000,1500000,0,0,0,180000,360000,180000,800000,0.00,22,22,19500000,1520000,17980000),
  ('88000000-0000-4000-8000-000000000007','87000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000008',24000000,2000000,0,0,0,240000,480000,240000,1200000,0.00,22,22,26000000,2160000,23840000),
  ('88000000-0000-4000-8000-000000000008','87000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000003',68000000,5000000,0,0,0,680000,1360000,680000,5500000,0.00,22,22,73000000,8220000,64780000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO employee_social_security (employee_id, bpjs_tk_number, bpjs_kes_number, bpjs_kes_class, bpjs_tk_status, bpjs_kes_status, registered_at) VALUES
  ('b0000000-0000-4000-8000-000000000004','2101234567890123','0001234567890123','Kelas 1','ACTIVE','ACTIVE','2022-04-01'),
  ('b0000000-0000-4000-8000-000000000007','2101234567890124','0001234567890124','Kelas 2','ACTIVE','ACTIVE','2023-02-01'),
  ('b0000000-0000-4000-8000-000000000003','2101234567890125','0001234567890125','Kelas 1','ACTIVE','PENDING','2020-03-01')
ON CONFLICT (employee_id) DO NOTHING;

INSERT INTO overtime_requests (id, employee_id, work_date, planned_hours, reason, status, approved_at) VALUES
  ('8a000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000004','2026-09-24',2.00,'Rilis patch produksi','APPROVED','2026-09-24T12:30:00Z'),
  ('8a000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000007','2026-09-25',1.50,'Revisi desain mendesak','SUBMITTED',NULL),
  ('8a000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000008','2026-09-26',3.00,'Migrasi data staging','SUBMITTED',NULL)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/board-seed.test.ts`
Expected: PASS (7 test).

- [ ] **Step 5: Verify existing seed tests still pass**

Run: `npx vitest run tests/integration/seed.test.ts tests/integration/seed-govera.test.ts tests/integration/lms-seed.test.ts`
Expected: PASS — jumlah `users` tetap 7 dan `individual_kpis` tetap 4.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/seed/index.ts tests/integration/board-seed.test.ts
git commit -m "test(seed): data operasional untuk Boardroom BOD"
```

---

### Task 3: `boardActivityAnalyticsService` + route

**Files:**
- Create: `src/lib/utils/wibDate.ts`
- Modify: `src/lib/services/contractService.ts` (hapus implementasi lokal `todayInJakarta`, impor dari util)
- Create: `src/lib/services/boardActivityAnalyticsService.ts`
- Create: `src/app/api/v1/analytics/board-activity/route.ts`
- Test: `tests/unit/boardActivityAnalyticsService.test.ts`
- Test: `tests/integration/board-api.test.ts` (bagian aktivitas)

**Interfaces:**
- Consumes: `Db`, seed dari Task 2
- Produces:
  - `todayInJakarta(now?: Date): string` dari `@/lib/utils/wibDate`
  - `getBoardActivityAnalytics(db: Db, options?: BoardActivityOptions): Promise<BoardActivityAnalytics>`

- [ ] **Step 1: Write the failing test**

Buat `tests/unit/boardActivityAnalyticsService.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getBoardActivityAnalytics } from '@/lib/services/boardActivityAnalyticsService';

const RANGE = { fromDate: '2026-09-19', toDate: '2026-09-24' };

describe('Board Activity Analytics', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  it('mengagregasi event per tipe dan menghitung persentase', async () => {
    const result = await getBoardActivityAnalytics(db, RANGE);
    expect(result.totalEvents).toBeGreaterThan(0);
    expect(result.byEventType.length).toBeGreaterThan(0);

    const sumPct = result.byEventType.reduce((s, b) => s + b.percentage, 0);
    expect(sumPct).toBeGreaterThan(99);
    expect(sumPct).toBeLessThan(101);
  });

  it('mengecualikan event RESTRICTED dari seluruh keluaran', async () => {
    const result = await getBoardActivityAnalytics(db, RANGE);
    const summaries = result.recent.map((r) => r.summary);
    expect(summaries.some((s) => s.includes('rahasia'))).toBe(false);

    // Event RESTRICTED seed bertipe DISCIPLINARY; tipe itu tidak boleh muncul.
    expect(result.byEventType.some((b) => b.eventType === 'DISCIPLINARY')).toBe(false);
  });

  it('mengelompokkan aktivitas menurut peran pemilik', async () => {
    const result = await getBoardActivityAnalytics(db, RANGE);
    expect(result.byOwnerRole.length).toBeGreaterThan(1);
    const roles = result.byOwnerRole.map((r) => r.role);
    expect(roles).toContain('EMPLOYEE');
    expect(roles).toContain('PEOPLE_MANAGER');
  });

  it('melengkapi hari tanpa event pada tren harian', async () => {
    const result = await getBoardActivityAnalytics(db, RANGE);
    expect(result.dailyTrend).toHaveLength(6); // 19..24 September inklusif
    // 19 September hanya berisi satu event RESTRICTED, sehingga tersaring habis.
    expect(result.dailyTrend.find((d) => d.date === '2026-09-19')?.count).toBe(0);
    expect(result.dailyTrend.filter((d) => d.count === 0)).toHaveLength(1);
  });

  it('total event sama dengan jumlah event non-RESTRICTED pada rentang', async () => {
    const result = await getBoardActivityAnalytics(db, RANGE);
    // Seed: 12 event, 1 di antaranya RESTRICTED (19 Sep) -> 11 tersisa.
    expect(result.totalEvents).toBe(11);
    expect(result.sampleSize).toBe(11);
  });

  it('menghitung coverage pegawai aktif tanpa membagi nol', async () => {
    const result = await getBoardActivityAnalytics(db, RANGE);
    // Seed: 11 pegawai, 1 RESIGNED -> 10 aktif. Yang punya event: 5 -> 50%.
    expect(result.analysis.activeEmployees).toBe(10);
    expect(result.analysis.coveragePercentage).toBe(50);
    expect(Number.isFinite(result.analysis.coveragePercentage)).toBe(true);
  });

  it('menghasilkan analisis kosong yang aman saat tidak ada data', async () => {
    const result = await getBoardActivityAnalytics(db, {
      fromDate: '2020-01-01',
      toDate: '2020-01-05',
    });
    expect(result.totalEvents).toBe(0);
    expect(result.byEventType).toEqual([]);
    expect(result.analysis.busiestDepartment).toBeNull();
    expect(result.analysis.coveragePercentage).toBe(0);
    expect(result.analysis.highlights[0]).toMatch(/Belum ada aktivitas/i);
  });

  it('menyaring berdasarkan tipe event', async () => {
    const result = await getBoardActivityAnalytics(db, { ...RANGE, eventType: 'KPI_DAILY' });
    expect(result.byEventType).toHaveLength(1);
    expect(result.byEventType[0].eventType).toBe('KPI_DAILY');
  });

  it('menyaring berdasarkan pencarian nama pegawai', async () => {
    const result = await getBoardActivityAnalytics(db, { ...RANGE, search: 'Budi' });
    expect(result.recent.length).toBeGreaterThan(0);
    expect(result.recent.every((r) => r.employeeName.includes('Budi'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/boardActivityAnalyticsService.test.ts`
Expected: FAIL — `Cannot find module '@/lib/services/boardActivityAnalyticsService'`.

- [ ] **Step 3: Create the shared WIB date util**

Buat `src/lib/utils/wibDate.ts`:

```ts
/**
 * Tanggal hari ini menurut zona waktu Indonesia Barat (UTC+7).
 * `new Date().toISOString()` memakai UTC sehingga antara 00:00-06:59 WIB
 * masih menghasilkan tanggal kemarin.
 */
export function todayInJakarta(now: Date = new Date()): string {
  const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
  return new Date(now.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Menambah (atau mengurangi, bila negatif) hari pada string YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const base = Date.parse(`${date}T00:00:00Z`);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Make contractService reuse the util**

Di `src/lib/services/contractService.ts`, hapus fungsi lokal `todayInJakarta` beserta komentarnya, lalu tambahkan impor dan re-export:

```ts
import { todayInJakarta } from '@/lib/utils/wibDate';

export { todayInJakarta };
```

Run: `npx vitest run tests/unit/contractService.test.ts`
Expected: PASS (4 test) — membuktikan refactor tidak merusak pemakai lama.

- [ ] **Step 5: Write the service**

Buat `src/lib/services/boardActivityAnalyticsService.ts`:

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { todayInJakarta, addDays } from '@/lib/utils/wibDate';

export interface BoardActivityOptions {
  fromDate?: string;
  toDate?: string;
  eventType?: string;
  departmentId?: string;
  search?: string;
}

export interface BoardActivityAnalytics {
  fromDate: string;
  toDate: string;
  sampleSize: number;
  totalEvents: number;
  byEventType: Array<{ eventType: string; count: number; percentage: number }>;
  byDepartment: Array<{ departmentName: string; count: number }>;
  byOwnerRole: Array<{ role: string; count: number; percentage: number }>;
  dailyTrend: Array<{ date: string; count: number }>;
  recent: Array<{
    id: string;
    employeeName: string;
    employeeCode: string;
    departmentName: string;
    eventType: string;
    summary: string;
    occurredAt: string;
  }>;
  analysis: {
    busiestDepartment: string | null;
    busiestEventType: string | null;
    coveragePercentage: number;
    activeEmployees: number;
    highlights: string[];
  };
}

const DEFAULT_WINDOW_DAYS = 14;
const RECENT_LIMIT = 50;

function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export async function getBoardActivityAnalytics(
  db: Db,
  options: BoardActivityOptions = {}
): Promise<BoardActivityAnalytics> {
  const toDate = options.toDate ?? todayInJakarta();
  const fromDate = options.fromDate ?? addDays(toDate, -(DEFAULT_WINDOW_DAYS - 1));

  // Tanggal lokal WIB dipakai agar pengelompokan harian tidak bergeser 7 jam.
  const localDate = sql`(a.occurred_at AT TIME ZONE 'Asia/Jakarta')::date`;

  const filters = sql`
    a.visibility <> 'RESTRICTED'
    AND ${localDate} >= ${fromDate}::date
    AND ${localDate} <= ${toDate}::date
    ${options.eventType ? sql`AND a.event_type::text = ${options.eventType}` : sql``}
    ${options.departmentId ? sql`AND e.department_id = ${options.departmentId}::uuid` : sql``}
    ${
      options.search
        ? sql`AND (e.full_name ILIKE ${`%${options.search}%`}
              OR e.employee_code ILIKE ${`%${options.search}%`}
              OR a.summary ILIKE ${`%${options.search}%`})`
        : sql``
    }
  `;

  const base = sql`
    FROM activity_events a
    JOIN employees e ON e.id = a.employee_id
    JOIN departments d ON d.id = e.department_id
    LEFT JOIN users u ON u.employee_id = a.employee_id
    WHERE ${filters}
  `;

  const [typeRes, deptRes, roleRes, trendRes, recentRes, activeRes, coverageRes] =
    await Promise.all([
      db.execute(sql`
        SELECT a.event_type::text AS "eventType", COUNT(*)::int AS count
        ${base}
        GROUP BY 1
        ORDER BY count DESC, 1 ASC
      `),
      db.execute(sql`
        SELECT d.department_name AS "departmentName", COUNT(*)::int AS count
        ${base}
        GROUP BY 1
        ORDER BY count DESC, 1 ASC
      `),
      db.execute(sql`
        SELECT COALESCE(u.role::text, 'NO_ACCOUNT') AS role, COUNT(*)::int AS count
        ${base}
        GROUP BY 1
        ORDER BY count DESC, 1 ASC
      `),
      db.execute(sql`
        SELECT ${localDate}::text AS date, COUNT(*)::int AS count
        ${base}
        GROUP BY 1
        ORDER BY 1 ASC
      `),
      db.execute(sql`
        SELECT a.id, e.full_name AS "employeeName", e.employee_code AS "employeeCode",
               d.department_name AS "departmentName", a.event_type::text AS "eventType",
               a.summary, a.occurred_at AS "occurredAt"
        ${base}
        ORDER BY a.occurred_at DESC
        LIMIT ${RECENT_LIMIT}
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS total
          FROM employees
         WHERE status NOT IN ('RESIGNED', 'RETIRED')
      `),
      db.execute(sql`
        SELECT COUNT(DISTINCT a.employee_id)::int AS covered
        ${base}
      `),
    ]);

  const typeRows = (typeRes.rows ?? []) as Array<{ eventType: string; count: number }>;
  const deptRows = (deptRes.rows ?? []) as Array<{ departmentName: string; count: number }>;
  const roleRows = (roleRes.rows ?? []) as Array<{ role: string; count: number }>;
  const trendRows = (trendRes.rows ?? []) as Array<{ date: string; count: number }>;
  const recentRows = (recentRes.rows ?? []) as Array<{
    id: string;
    employeeName: string;
    employeeCode: string;
    departmentName: string;
    eventType: string;
    summary: string;
    occurredAt: unknown;
  }>;

  const totalEvents = typeRows.reduce((s, r) => s + Number(r.count), 0);
  const activeEmployees = Number(
    ((activeRes.rows ?? []) as Array<{ total: number }>)[0]?.total ?? 0
  );
  const covered = Number(
    ((coverageRes.rows ?? []) as Array<{ covered: number }>)[0]?.covered ?? 0
  );

  // Lengkapi hari tanpa event agar grafik tren tidak memutus garis.
  const countByDate = new Map(trendRows.map((r) => [String(r.date).slice(0, 10), Number(r.count)]));
  const dailyTrend: Array<{ date: string; count: number }> = [];
  const span = Math.max(
    0,
    Math.round(
      (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000
    )
  );
  for (let i = 0; i <= span; i++) {
    const date = addDays(fromDate, i);
    dailyTrend.push({ date, count: countByDate.get(date) ?? 0 });
  }

  const busiestDepartment = deptRows[0]?.departmentName ?? null;
  const busiestEventType = typeRows[0]?.eventType ?? null;
  const coveragePercentage = percentage(covered, activeEmployees);

  const highlights: string[] = [];
  if (totalEvents === 0) {
    highlights.push('Belum ada aktivitas pada rentang ini.');
  } else {
    highlights.push(
      `${totalEvents} aktivitas tercatat dari ${covered} pegawai (${coveragePercentage}% pegawai aktif).`
    );
    if (busiestDepartment) {
      highlights.push(
        `Departemen paling aktif: ${busiestDepartment} (${deptRows[0].count} aktivitas).`
      );
    }
    if (activeEmployees > covered) {
      highlights.push(`${activeEmployees - covered} pegawai aktif tanpa aktivitas tercatat.`);
    }
  }

  return {
    fromDate,
    toDate,
    sampleSize: totalEvents,
    totalEvents,
    byEventType: typeRows.map((r) => ({
      eventType: r.eventType,
      count: Number(r.count),
      percentage: percentage(Number(r.count), totalEvents),
    })),
    byDepartment: deptRows.map((r) => ({
      departmentName: r.departmentName,
      count: Number(r.count),
    })),
    byOwnerRole: roleRows.map((r) => ({
      role: r.role,
      count: Number(r.count),
      percentage: percentage(Number(r.count), totalEvents),
    })),
    dailyTrend,
    recent: recentRows.map((r) => ({
      id: String(r.id),
      employeeName: r.employeeName,
      employeeCode: r.employeeCode,
      departmentName: r.departmentName,
      eventType: r.eventType,
      summary: r.summary,
      occurredAt: new Date(r.occurredAt as string).toISOString(),
    })),
    analysis: {
      busiestDepartment,
      busiestEventType,
      coveragePercentage,
      activeEmployees,
      highlights,
    },
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/unit/boardActivityAnalyticsService.test.ts`
Expected: PASS (9 test).

- [ ] **Step 7: Write the route**

Buat `src/app/api/v1/analytics/board-activity/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { getBoardActivityAnalytics } from '@/lib/services/boardActivityAnalyticsService';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Daftar tipe valid; dicek di route agar tidak error cast enum di SQL. */
const EVENT_TYPES = [
  'ATTENDANCE', 'KPI_DAILY', 'DPI_STATUS', 'LEAVE', 'OVERTIME',
  'TRAINING', 'LETTER', 'DISCIPLINARY', 'RECOGNITION', 'CAREER',
];

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'analytics:read');

    const sp = req.nextUrl.searchParams;
    const fromDate = sp.get('fromDate') || undefined;
    const toDate = sp.get('toDate') || undefined;
    const eventType = sp.get('eventType') || undefined;
    const departmentId = sp.get('departmentId') || undefined;
    const search = sp.get('search') || undefined;

    if (fromDate && !DATE_RE.test(fromDate)) {
      return fail('VALIDATION_ERROR', 'fromDate harus berformat YYYY-MM-DD.', 400);
    }
    if (toDate && !DATE_RE.test(toDate)) {
      return fail('VALIDATION_ERROR', 'toDate harus berformat YYYY-MM-DD.', 400);
    }
    if (fromDate && toDate && fromDate > toDate) {
      return fail('VALIDATION_ERROR', 'fromDate tidak boleh setelah toDate.', 400);
    }
    if (eventType && !EVENT_TYPES.includes(eventType)) {
      return fail('VALIDATION_ERROR', `Tipe event '${eventType}' tidak dikenal.`, 400);
    }
    if (departmentId && !UUID_RE.test(departmentId)) {
      return fail('VALIDATION_ERROR', 'departmentId harus berupa UUID.', 400);
    }

    const data = await getBoardActivityAnalytics(db, {
      fromDate,
      toDate,
      eventType,
      departmentId,
      search,
    });
    return ok(data);
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat aktivitas Boardroom',
      status
    );
  }
}
```

- [ ] **Step 8: Write the integration test for this route**

Buat `tests/integration/board-api.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { db } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getActivity } from '@/app/api/v1/analytics/board-activity/route';

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
      expect(JSON.stringify(json)).not.toContain('rahasia');
      expect(JSON.stringify(json)).not.toContain('RESTRICTED');
    });

    it('menolak tipe event tak dikenal (400)', async () => {
      const res = await getActivity(
        req('/api/v1/analytics/board-activity?eventType=BUKAN_TIPE', bodCookie)
      );
      expect(res.status).toBe(400);
    });
  });
});
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run tests/integration/board-api.test.ts tests/unit/boardActivityAnalyticsService.test.ts`
Expected: PASS (14 test).

- [ ] **Step 10: Commit**

```bash
git add src/lib/utils/wibDate.ts src/lib/services/contractService.ts src/lib/services/boardActivityAnalyticsService.ts src/app/api/v1/analytics/board-activity tests/unit/boardActivityAnalyticsService.test.ts tests/integration/board-api.test.ts
git commit -m "feat(board): analitik aktivitas seluruh profil untuk BOD"
```

---

### Task 4: `boardVisionAchievementService` + route

**Files:**
- Create: `src/lib/services/boardVisionAchievementService.ts`
- Create: `src/app/api/v1/analytics/vision-achievement/route.ts`
- Test: `tests/unit/boardVisionAchievementService.test.ts`
- Test: `tests/integration/board-api.test.ts` (tambahkan blok visi)

**Interfaces:**
- Consumes: `Db`, tabel `company_vision_mission`, `strategic_pillars`, `corporate_kpis`, `individual_kpis`
- Produces: `getVisionAchievement(db: Db, periodCode?: string): Promise<VisionAchievement>`

**Fakta data seed (dipakai untuk menulis test):** 4 pilar masing-masing bobot 25%. Budi punya 4 KPI: FINANCIAL 92,5%; INTERNAL_PROCESS 102,5% (2 KPI); LEARNING_GROWTH 83,3%; **CUSTOMER tanpa KPI** → harus `NO_DATA`, bukan NaN.

- [ ] **Step 1: Write the failing test**

Buat `tests/unit/boardVisionAchievementService.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getVisionAchievement } from '@/lib/services/boardVisionAchievementService';

describe('Vision Achievement (Visi-Misi & RJMP)', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  it('membaca visi dan memecah misi dari pemisah pipa', async () => {
    const result = await getVisionAchievement(db);
    expect(result.vision).toContain('kelas dunia');
    expect(result.missions).toHaveLength(3);
    expect(result.missions[0]).toContain('ekosistem penilaian kinerja');
  });

  it('menghitung capaian pilar secara tertimbang', async () => {
    const result = await getVisionAchievement(db);

    const financial = result.pillars.find((p) => p.perspective === 'FINANCIAL');
    expect(financial?.achievementPercentage).toBe(92.5);
    expect(financial?.status).toBe('BELOW_TARGET');

    const internal = result.pillars.find((p) => p.perspective === 'INTERNAL_PROCESS');
    expect(internal?.achievementPercentage).toBe(102.5);
    expect(internal?.status).toBe('ACHIEVED');

    const learning = result.pillars.find((p) => p.perspective === 'LEARNING_GROWTH');
    expect(learning?.achievementPercentage).toBe(83.3);
  });

  it('pilar tanpa KPI menjadi NO_DATA dengan 0%, bukan NaN', async () => {
    const result = await getVisionAchievement(db);
    const customer = result.pillars.find((p) => p.perspective === 'CUSTOMER');
    expect(customer?.kpiCount).toBe(0);
    expect(customer?.achievementPercentage).toBe(0);
    expect(customer?.status).toBe('NO_DATA');
  });

  it('capaian keseluruhan hanya memakai pilar yang punya data', async () => {
    const result = await getVisionAchievement(db);
    expect(Number.isFinite(result.overallAchievementPercentage)).toBe(true);
    // (92.5 + 102.5 + 83.3) / 3 ≈ 92.8 — pilar tanpa data tidak dihitung sebagai 0.
    expect(result.overallAchievementPercentage).toBeGreaterThan(92);
    expect(result.overallAchievementPercentage).toBeLessThan(94);
  });

  it('menurunkan capaian RJMP dari pilar terkait', async () => {
    const result = await getVisionAchievement(db);
    expect(result.rjmp).toHaveLength(4);

    const fin = result.rjmp.find((r) => r.kpiCode === 'CORP-FIN-01');
    expect(fin?.derivedAchievementPercentage).toBe(92.5);
    expect(fin?.status).toBe('BELOW_TARGET');

    const cus = result.rjmp.find((r) => r.kpiCode === 'CORP-CUS-01');
    expect(cus?.derivedAchievementPercentage).toBe(0);
    expect(cus?.status).toBe('NO_DATA');
  });

  it('menyusun analisis: pilar terkuat, terlemah, dan jumlah tercapai', async () => {
    const result = await getVisionAchievement(db);
    expect(result.analysis.achievedPillarCount).toBe(1);
    expect(result.analysis.belowTargetPillarCount).toBe(2);
    expect(result.analysis.strongestPillar).toContain('Keunggulan Operasional');
    expect(result.analysis.weakestPillar).toContain('Kapabilitas Human Capital');
    expect(result.analysis.highlights.length).toBeGreaterThan(0);
  });

  it('menyatakan visi belum ditetapkan bila tabel kosong, tanpa mengarang teks', async () => {
    await client.exec('DELETE FROM company_vision_mission');
    const result = await getVisionAchievement(db);
    expect(result.vision).toBeNull();
    expect(result.missions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/boardVisionAchievementService.test.ts`
Expected: FAIL — `Cannot find module '@/lib/services/boardVisionAchievementService'`.

- [ ] **Step 3: Write the service**

Buat `src/lib/services/boardVisionAchievementService.ts`:

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export type AchievementStatus = 'ACHIEVED' | 'BELOW_TARGET' | 'NO_DATA';

export interface VisionPillar {
  pillarId: string;
  pillarName: string;
  perspective: string;
  strategicWeight: number;
  kpiCount: number;
  achievementPercentage: number;
  status: AchievementStatus;
}

export interface RjmpTarget {
  corporateKpiId: string;
  kpiCode: string;
  kpiName: string;
  periodYear: number;
  targetValue: number;
  unit: string;
  derivedAchievementPercentage: number;
  status: AchievementStatus;
}

export interface VisionAchievement {
  vision: string | null;
  missions: string[];
  sampleSize: number;
  overallAchievementPercentage: number;
  pillars: VisionPillar[];
  rjmp: RjmpTarget[];
  analysis: {
    achievedPillarCount: number;
    belowTargetPillarCount: number;
    noDataPillarCount: number;
    weakestPillar: string | null;
    strongestPillar: string | null;
    highlights: string[];
  };
}

function round1(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function statusOf(achievement: number, hasData: boolean): AchievementStatus {
  if (!hasData) return 'NO_DATA';
  return achievement >= 100 ? 'ACHIEVED' : 'BELOW_TARGET';
}

export async function getVisionAchievement(
  db: Db,
  _periodCode?: string
): Promise<VisionAchievement> {
  const vmRes = (await db.execute(sql`
    SELECT vision, mission FROM company_vision_mission ORDER BY updated_at DESC LIMIT 1
  `)) as unknown as { rows: Array<{ vision: string; mission: string }> };

  const vision = vmRes.rows?.[0]?.vision ?? null;
  const missionText = vmRes.rows?.[0]?.mission ?? '';
  const missions = missionText
    ? missionText.split(/\s*\|\s*|\n+/).map((m) => m.trim()).filter(Boolean)
    : [];

  // Rata-rata tertimbang bobot KPI; SUM(kpi_weight)=0 menghasilkan 0, bukan NaN.
  const pillarRes = (await db.execute(sql`
    SELECT
      sp.id AS "pillarId",
      sp.pillar_name AS "pillarName",
      sp.perspective::text AS perspective,
      sp.strategic_weight::float8 AS "strategicWeight",
      COUNT(ik.id)::int AS "kpiCount",
      COALESCE(SUM(ik.kpi_weight), 0)::float8 AS "totalWeight",
      CASE
        WHEN COALESCE(SUM(ik.kpi_weight), 0) > 0
        THEN (SUM(ik.achievement_percentage * ik.kpi_weight) / SUM(ik.kpi_weight))::float8
        ELSE 0
      END AS achievement
    FROM strategic_pillars sp
    LEFT JOIN individual_kpis ik ON ik.strategic_pillar_id = sp.id
    WHERE sp.is_active = TRUE
    GROUP BY sp.id, sp.pillar_name, sp.perspective, sp.strategic_weight
    ORDER BY sp.strategic_weight DESC, sp.pillar_name ASC
  `)) as unknown as {
    rows: Array<{
      pillarId: string;
      pillarName: string;
      perspective: string;
      strategicWeight: number;
      kpiCount: number;
      totalWeight: number;
      achievement: number;
    }>;
  };

  const pillars: VisionPillar[] = (pillarRes.rows ?? []).map((r) => {
    const hasData = Number(r.kpiCount) > 0 && Number(r.totalWeight) > 0;
    const achievement = hasData ? round1(Number(r.achievement)) : 0;
    return {
      pillarId: r.pillarId,
      pillarName: r.pillarName,
      perspective: r.perspective,
      strategicWeight: Number(r.strategicWeight),
      kpiCount: Number(r.kpiCount),
      achievementPercentage: achievement,
      status: statusOf(achievement, hasData),
    };
  });

  const withData = pillars.filter((p) => p.status !== 'NO_DATA');
  const weightSum = withData.reduce((s, p) => s + p.strategicWeight, 0);
  const overallAchievementPercentage =
    weightSum > 0
      ? round1(
          withData.reduce((s, p) => s + p.achievementPercentage * p.strategicWeight, 0) /
            weightSum
        )
      : 0;

  const rjmpRes = (await db.execute(sql`
    SELECT ck.id AS "corporateKpiId", ck.kpi_code AS "kpiCode", ck.kpi_name AS "kpiName",
           ck.period_year AS "periodYear", ck.target_value::float8 AS "targetValue",
           ck.unit_of_measure AS unit, ck.strategic_pillar_id AS "pillarId"
      FROM corporate_kpis ck
     ORDER BY ck.period_year DESC, ck.kpi_code ASC
  `)) as unknown as {
    rows: Array<{
      corporateKpiId: string;
      kpiCode: string;
      kpiName: string;
      periodYear: number;
      targetValue: number;
      unit: string;
      pillarId: string;
    }>;
  };

  const pillarById = new Map(pillars.map((p) => [p.pillarId, p]));
  const rjmp: RjmpTarget[] = (rjmpRes.rows ?? []).map((r) => {
    const pillar = pillarById.get(r.pillarId);
    const hasData = !!pillar && pillar.status !== 'NO_DATA';
    const derived = hasData ? pillar!.achievementPercentage : 0;
    return {
      corporateKpiId: r.corporateKpiId,
      kpiCode: r.kpiCode,
      kpiName: r.kpiName,
      periodYear: Number(r.periodYear),
      targetValue: Number(r.targetValue),
      unit: r.unit,
      derivedAchievementPercentage: derived,
      status: statusOf(derived, hasData),
    };
  });

  const achievedPillarCount = pillars.filter((p) => p.status === 'ACHIEVED').length;
  const belowTargetPillarCount = pillars.filter((p) => p.status === 'BELOW_TARGET').length;
  const noDataPillarCount = pillars.filter((p) => p.status === 'NO_DATA').length;

  const sorted = [...withData].sort(
    (a, b) => b.achievementPercentage - a.achievementPercentage
  );
  const strongestPillar = sorted[0]?.pillarName ?? null;
  const weakestPillar = sorted[sorted.length - 1]?.pillarName ?? null;

  const highlights: string[] = [];
  if (pillars.length === 0) {
    highlights.push('Belum ada pilar strategis aktif untuk diukur.');
  } else {
    highlights.push(
      `Capaian keseluruhan ${overallAchievementPercentage}% dari ${withData.length} pilar yang memiliki data.`
    );
    if (weakestPillar && sorted.length > 1) {
      const gap = round1(sorted[0].achievementPercentage - sorted[sorted.length - 1].achievementPercentage);
      highlights.push(`Pilar terlemah: ${weakestPillar}, tertinggal ${gap} poin dari pilar terkuat.`);
    }
    if (noDataPillarCount > 0) {
      highlights.push(`${noDataPillarCount} pilar belum memiliki KPI sehingga tidak dapat dinilai.`);
    }
  }

  return {
    vision,
    missions,
    sampleSize: pillars.reduce((s, p) => s + p.kpiCount, 0),
    overallAchievementPercentage,
    pillars,
    rjmp,
    analysis: {
      achievedPillarCount,
      belowTargetPillarCount,
      noDataPillarCount,
      weakestPillar,
      strongestPillar,
      highlights,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/boardVisionAchievementService.test.ts`
Expected: PASS (7 test).

- [ ] **Step 5: Write the route**

Buat `src/app/api/v1/analytics/vision-achievement/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { getVisionAchievement } from '@/lib/services/boardVisionAchievementService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'analytics:read');

    const periodCode = req.nextUrl.searchParams.get('periodCode') || undefined;
    const data = await getVisionAchievement(db, periodCode);
    return ok(data);
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat capaian visi-misi',
      status
    );
  }
}
```

- [ ] **Step 6: Add integration coverage**

Tambahkan blok berikut di dalam `describe('Boardroom API', ...)` pada `tests/integration/board-api.test.ts`, dan tambahkan impor di bagian atas:

```ts
import { GET as getVision } from '@/app/api/v1/analytics/vision-achievement/route';
```

```ts
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
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/unit/boardVisionAchievementService.test.ts tests/integration/board-api.test.ts`
Expected: PASS (7 unit + 8 integrasi = 15 test).

- [ ] **Step 8: Commit**

```bash
git add src/lib/services/boardVisionAchievementService.ts src/app/api/v1/analytics/vision-achievement tests/unit/boardVisionAchievementService.test.ts tests/integration/board-api.test.ts
git commit -m "feat(board): capaian visi-misi dan turunan RJMP untuk BOD"
```

---

### Task 5: `boardPositionFitService` + route

**Files:**
- Create: `src/lib/services/boardPositionFitService.ts`
- Create: `src/app/api/v1/analytics/position-fit/route.ts`
- Test: `tests/unit/boardPositionFitService.test.ts`
- Test: `tests/integration/board-api.test.ts` (tambahkan blok posisi)

**Interfaces:**
- Consumes: `Db`, tabel `position_kpi_templates`, `individual_kpis`, `employees`, `job_positions`, `performance_appraisals`
- Produces: `getPositionFit(db: Db, periodCode?: string): Promise<PositionFit>`

**Fakta data seed (dipakai untuk menulis test):** 7 posisi punya template (masing-masing 3 KPI, total bobot 100). `Senior Software Engineer` punya 4 pemegang. Budi punya 4 KPI individual yang **judulnya tidak cocok** dengan template SSE → `NOT_COMPLIANT` dengan coverage 0. Kasus `COMPLIANT` dan `PARTIAL` dibuat sebagai fixture di dalam test.

- [ ] **Step 1: Write the failing test**

Buat `tests/unit/boardPositionFitService.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getPositionFit } from '@/lib/services/boardPositionFitService';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const ANISA = 'b0000000-0000-4000-8000-000000000007';
const DIMAS = 'b0000000-0000-4000-8000-000000000008';
const CEO = 'b0000000-0000-4000-8000-000000000001';
const PERIOD = 'd0000000-0000-4000-8000-000000000001';

describe('Position Fit (Kesesuaian Posisi & RJMP)', () => {
  let client: PGlite;
  let db: Db;
  let pillarId = '';

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
    const p = await db.execute(sql`SELECT id FROM strategic_pillars LIMIT 1`);
    pillarId = String((p.rows[0] as { id: string }).id);
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  const insertKpi = async (employeeId: string, title: string, weight: number, actual: number) => {
    await db.execute(sql`
      INSERT INTO individual_kpis
        (period_id, employee_id, strategic_pillar_id, kpi_title, target_value, actual_value, kpi_weight)
      VALUES (${PERIOD}::uuid, ${employeeId}::uuid, ${pillarId}::uuid, ${title}, 100, ${actual}, ${weight})
    `);
  };

  it('mengevaluasi seluruh pegawai aktif', async () => {
    const result = await getPositionFit(db);
    expect(result.employees.length).toBeGreaterThanOrEqual(10);
    expect(result.sampleSize).toBe(result.employees.length);
  });

  it('menandai posisi tanpa template sebagai NO_TEMPLATE, bukan gagal', async () => {
    // Semua posisi seed punya template, jadi kasus ini dibuat sebagai fixture:
    // satu posisi baru tanpa template + satu pegawai yang mendudukinya.
    const dept = await db.execute(sql`SELECT id FROM departments LIMIT 1`);
    const deptId = String((dept.rows[0] as { id: string }).id);

    const pos = await db.execute(sql`
      INSERT INTO job_positions (id, department_id, position_title, job_grade)
      VALUES ('ff000000-0000-4000-8000-000000000001'::uuid, ${deptId}::uuid,
              'Posisi Tanpa Template', 'G2')
      RETURNING id
    `);
    const posId = String((pos.rows[0] as { id: string }).id);

    await db.execute(sql`
      INSERT INTO employees (employee_code, full_name, email, department_id, position_id,
                             status, base_salary, join_date)
      VALUES ('TEST-NOTPL-1', 'Pegawai Tanpa Template', 'tanpa.template@eperformiq.co.id',
              ${deptId}::uuid, ${posId}::uuid, 'PERMANENT', 8000000, CURRENT_DATE)
    `);

    const result = await getPositionFit(db);
    const target = result.employees.find((e) => e.employeeCode === 'TEST-NOTPL-1');
    expect(target?.status).toBe('NO_TEMPLATE');
    expect(target?.templateKpiCount).toBe(0);
    expect(target?.coveragePercentage).toBe(0);
  });

  it('melaporkan KPI yang tidak cocok template secara eksplisit', async () => {
    const result = await getPositionFit(db);
    const budi = result.employees.find((e) => e.employeeId === BUDI);
    expect(budi?.templateKpiCount).toBe(3);
    expect(budi?.matchedKpiCount).toBe(0);
    expect(budi?.coveragePercentage).toBe(0);
    expect(budi?.status).toBe('NOT_COMPLIANT');
  });

  it('menghitung COMPLIANT saat seluruh KPI template cocok dan capaian >= 100', async () => {
    await insertKpi(ANISA, 'Defect Density (Bug per KLOC)', 35, 105);
    await insertKpi(ANISA, 'Ketepatan Sprint Commitment', 35, 100);
    await insertKpi(ANISA, 'Coverage Unit Test', 30, 110);

    const result = await getPositionFit(db);
    const anisa = result.employees.find((e) => e.employeeId === ANISA);
    expect(anisa?.matchedKpiCount).toBe(3);
    expect(anisa?.coveragePercentage).toBe(100);
    expect(anisa?.achievementPercentage).toBe(104.8);
    expect(anisa?.status).toBe('COMPLIANT');
  });

  it('menghitung PARTIAL saat hanya sebagian KPI template cocok', async () => {
    await insertKpi(DIMAS, 'Defect Density (Bug per KLOC)', 35, 90);
    await insertKpi(DIMAS, 'Ketepatan Sprint Commitment', 35, 95);

    const result = await getPositionFit(db);
    const dimas = result.employees.find((e) => e.employeeId === DIMAS);
    expect(dimas?.matchedKpiCount).toBe(2);
    expect(dimas?.coveragePercentage).toBe(70);
    expect(dimas?.status).toBe('PARTIAL');
  });

  it('tidak menghasilkan NaN meski posisi tanpa template', async () => {
    const result = await getPositionFit(db);
    for (const e of result.employees) {
      expect(Number.isFinite(e.coveragePercentage)).toBe(true);
      expect(Number.isFinite(e.achievementPercentage)).toBe(true);
    }
    for (const p of result.byPosition) {
      expect(Number.isFinite(p.coveragePercentage)).toBe(true);
      expect(Number.isFinite(p.achievementPercentage)).toBe(true);
    }
  });

  it('menyusun analisis jumlah posisi patuh dan tanpa template', async () => {
    // Jadikan posisi CEO patuh: seluruh pemegangnya memenuhi template.
    // Template CEO: Pertumbuhan Pendapatan vs RKAP 40, EBITDA Margin 30, Indeks Kepuasan 30.
    await insertKpi(CEO, 'Pertumbuhan Pendapatan vs RKAP', 40, 110);
    await insertKpi(CEO, 'EBITDA Margin Korporasi', 30, 105);
    await insertKpi(CEO, 'Indeks Kepuasan Stakeholder', 30, 100);

    const result = await getPositionFit(db);
    const ceoPosition = result.byPosition.find((p) => p.positionTitle.includes('Chief Executive'));
    expect(ceoPosition?.status).toBe('COMPLIANT');
    expect(ceoPosition?.compliantHolders).toBe(1);

    expect(result.analysis.compliantPositions).toBeGreaterThanOrEqual(1);
    expect(result.analysis.positionsWithoutTemplate).toBeGreaterThanOrEqual(1);
    expect(result.analysis.highlights.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/boardPositionFitService.test.ts`
Expected: FAIL — `Cannot find module '@/lib/services/boardPositionFitService'`.

- [ ] **Step 3: Write the service**

Buat `src/lib/services/boardPositionFitService.ts`:

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';

export type FitStatus = 'COMPLIANT' | 'PARTIAL' | 'NOT_COMPLIANT' | 'NO_TEMPLATE';

export interface EmployeeFit {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  positionId: string;
  positionTitle: string;
  jobGrade: string | null;
  templateKpiCount: number;
  matchedKpiCount: number;
  coveragePercentage: number;
  achievementPercentage: number;
  latestGpa: number | null;
  latestRating: string | null;
  status: FitStatus;
}

export interface PositionFit {
  sampleSize: number;
  byPosition: Array<{
    positionId: string;
    positionTitle: string;
    jobGrade: string | null;
    holders: number;
    compliantHolders: number;
    templateKpiCount: number;
    matchedKpiCount: number;
    coveragePercentage: number;
    achievementPercentage: number;
    status: FitStatus;
  }>;
  employees: EmployeeFit[];
  analysis: {
    compliantPositions: number;
    positionsWithoutTemplate: number;
    averageCoveragePercentage: number;
    highlights: string[];
  };
}

/** Ambang kepatuhan (spec §5). */
const COMPLIANT_COVERAGE = 80;
const PARTIAL_COVERAGE = 50;
const COMPLIANT_ACHIEVEMENT = 100;

function round1(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function safeRatio(part: number, total: number, scale = 100): number {
  if (total <= 0) return 0;
  return round1((part / total) * scale);
}

function statusOf(templateCount: number, coverage: number, achievement: number): FitStatus {
  if (templateCount <= 0) return 'NO_TEMPLATE';
  if (coverage >= COMPLIANT_COVERAGE && achievement >= COMPLIANT_ACHIEVEMENT) return 'COMPLIANT';
  if (coverage >= PARTIAL_COVERAGE) return 'PARTIAL';
  return 'NOT_COMPLIANT';
}

export async function getPositionFit(db: Db, _periodCode?: string): Promise<PositionFit> {
  // Kecocokan KPI memakai judul yang dinormalkan (huruf kecil + trim).
  // KPI ganda pada judul yang sama diambil capaian tertinggi agar tidak ambigu.
  const res = (await db.execute(sql`
    WITH tpl AS (
      SELECT t.position_id AS position_id,
             LOWER(TRIM(t.kpi_title)) AS title_lc,
             t.kpi_weight::float8 AS weight
        FROM position_kpi_templates t
       WHERE t.is_active = TRUE
    ),
    tpl_total AS (
      SELECT position_id,
             COUNT(*)::int AS tpl_count,
             SUM(weight)::float8 AS tpl_weight
        FROM tpl
       GROUP BY position_id
    ),
    emp AS (
      SELECT e.id, e.employee_code, e.full_name, e.position_id,
             d.department_name, jp.position_title, jp.job_grade
        FROM employees e
        JOIN departments d ON d.id = e.department_id
        JOIN job_positions jp ON jp.id = e.position_id
       WHERE e.status NOT IN ('RESIGNED', 'RETIRED')
    ),
    emp_kpi AS (
      SELECT ik.employee_id,
             LOWER(TRIM(ik.kpi_title)) AS title_lc,
             MAX(ik.achievement_percentage)::float8 AS ach
        FROM individual_kpis ik
       GROUP BY ik.employee_id, LOWER(TRIM(ik.kpi_title))
    ),
    matched AS (
      SELECT emp.id AS employee_id,
             COUNT(*)::int AS matched_count,
             SUM(tpl.weight)::float8 AS matched_weight,
             SUM(tpl.weight * ek.ach)::float8 AS weighted_ach
        FROM emp
        JOIN tpl ON tpl.position_id = emp.position_id
        JOIN emp_kpi ek ON ek.employee_id = emp.id AND ek.title_lc = tpl.title_lc
       GROUP BY emp.id
    )
    SELECT emp.id AS "employeeId", emp.employee_code AS "employeeCode",
           emp.full_name AS "fullName", emp.department_name AS "departmentName",
           emp.position_id AS "positionId", emp.position_title AS "positionTitle",
           emp.job_grade AS "jobGrade",
           COALESCE(tt.tpl_count, 0)::int AS "templateKpiCount",
           COALESCE(tt.tpl_weight, 0)::float8 AS "templateWeight",
           COALESCE(m.matched_count, 0)::int AS "matchedKpiCount",
           COALESCE(m.matched_weight, 0)::float8 AS "matchedWeight",
           COALESCE(m.weighted_ach, 0)::float8 AS "weightedAchievement",
           (SELECT pa.composite_gpa FROM performance_appraisals pa
             WHERE pa.employee_id = emp.id
             ORDER BY pa.created_at DESC NULLS LAST LIMIT 1)::float8 AS "latestGpa",
           (SELECT pa.performance_rating FROM performance_appraisals pa
             WHERE pa.employee_id = emp.id
             ORDER BY pa.created_at DESC NULLS LAST LIMIT 1) AS "latestRating"
      FROM emp
      LEFT JOIN tpl_total tt ON tt.position_id = emp.position_id
      LEFT JOIN matched m ON m.employee_id = emp.id
     ORDER BY emp.department_name ASC, emp.full_name ASC
  `)) as unknown as {
    rows: Array<{
      employeeId: string;
      employeeCode: string;
      fullName: string;
      departmentName: string;
      positionId: string;
      positionTitle: string;
      jobGrade: string | null;
      templateKpiCount: number;
      templateWeight: number;
      matchedKpiCount: number;
      matchedWeight: number;
      weightedAchievement: number;
      latestGpa: number | null;
      latestRating: string | null;
    }>;
  };

  const employees: EmployeeFit[] = (res.rows ?? []).map((r) => {
    const templateKpiCount = Number(r.templateKpiCount);
    const coveragePercentage = safeRatio(Number(r.matchedWeight), Number(r.templateWeight));
    const achievementPercentage = safeRatio(
      Number(r.weightedAchievement),
      Number(r.matchedWeight)
    );
    return {
      employeeId: r.employeeId,
      employeeCode: r.employeeCode,
      fullName: r.fullName,
      departmentName: r.departmentName,
      positionId: r.positionId,
      positionTitle: r.positionTitle,
      jobGrade: r.jobGrade,
      templateKpiCount,
      matchedKpiCount: Number(r.matchedKpiCount),
      coveragePercentage,
      achievementPercentage,
      latestGpa: r.latestGpa === null ? null : Number(r.latestGpa),
      latestRating: r.latestRating,
      status: statusOf(templateKpiCount, coveragePercentage, achievementPercentage),
    };
  });

  const grouped = new Map<string, EmployeeFit[]>();
  for (const e of employees) {
    const list = grouped.get(e.positionId) ?? [];
    list.push(e);
    grouped.set(e.positionId, list);
  }

  const byPosition: PositionFit['byPosition'] = Array.from(grouped.entries()).map(([positionId, list]) => {
    const first = list[0];
    const compliantHolders = list.filter((e) => e.status === 'COMPLIANT').length;
    const avgCoverage = round1(
      list.reduce((s, e) => s + e.coveragePercentage, 0) / list.length
    );
    const avgAchievement = round1(
      list.reduce((s, e) => s + e.achievementPercentage, 0) / list.length
    );

    // Status posisi mengikuti sebaran pemegangnya, bukan rata-rata yang bisa
    // menutupi satu pegawai yang sudah memenuhi syarat.
    let status: FitStatus;
    if (first.templateKpiCount <= 0) {
      status = 'NO_TEMPLATE';
    } else if (compliantHolders === list.length) {
      status = 'COMPLIANT';
    } else if (compliantHolders > 0 || list.some((e) => e.status === 'PARTIAL')) {
      status = 'PARTIAL';
    } else {
      status = 'NOT_COMPLIANT';
    }

    return {
      positionId,
      positionTitle: first.positionTitle,
      jobGrade: first.jobGrade,
      holders: list.length,
      compliantHolders,
      templateKpiCount: first.templateKpiCount,
      matchedKpiCount: Math.round(
        list.reduce((s, e) => s + e.matchedKpiCount, 0) / list.length
      ),
      coveragePercentage: avgCoverage,
      achievementPercentage: avgAchievement,
      status,
    };
  });

  const compliantPositions = byPosition.filter((p) => p.status === 'COMPLIANT').length;
  const positionsWithoutTemplate = byPosition.filter((p) => p.status === 'NO_TEMPLATE').length;
  const positionsWithTemplate = byPosition.filter((p) => p.status !== 'NO_TEMPLATE');
  const averageCoveragePercentage =
    positionsWithTemplate.length > 0
      ? round1(
          positionsWithTemplate.reduce((s, p) => s + p.coveragePercentage, 0) /
            positionsWithTemplate.length
        )
      : 0;

  const notCompliant = employees.filter((e) => e.status === 'NOT_COMPLIANT').length;

  const highlights: string[] = [];
  if (employees.length === 0) {
    highlights.push('Belum ada pegawai aktif untuk dievaluasi.');
  } else {
    highlights.push(
      `${compliantPositions} dari ${byPosition.length} posisi sudah sesuai template KPI.`
    );
    if (positionsWithoutTemplate > 0) {
      highlights.push(`${positionsWithoutTemplate} posisi belum memiliki template KPI.`);
    }
    if (notCompliant > 0) {
      highlights.push(
        `${notCompliant} pegawai belum memenuhi KPI template jabatannya (KPI tidak cocok atau di bawah target).`
      );
    }
  }

  return {
    sampleSize: employees.length,
    byPosition,
    employees,
    analysis: {
      compliantPositions,
      positionsWithoutTemplate,
      averageCoveragePercentage,
      highlights,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/boardPositionFitService.test.ts`
Expected: PASS (7 test).

- [ ] **Step 5: Write the route**

Buat `src/app/api/v1/analytics/position-fit/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { getPositionFit } from '@/lib/services/boardPositionFitService';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'analytics:read');

    const periodCode = req.nextUrl.searchParams.get('periodCode') || undefined;
    const data = await getPositionFit(db, periodCode);
    return ok(data);
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat kesesuaian posisi',
      status
    );
  }
}
```

- [ ] **Step 6: Add integration coverage**

Tambahkan impor di `tests/integration/board-api.test.ts`:

```ts
import { GET as getPositionFit } from '@/app/api/v1/analytics/position-fit/route';
```

Dan blok berikut di dalam `describe('Boardroom API', ...)`:

```ts
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
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/unit/boardPositionFitService.test.ts tests/integration/board-api.test.ts`
Expected: PASS (7 unit + 10 integrasi = 17 test).

- [ ] **Step 8: Commit**

```bash
git add src/lib/services/boardPositionFitService.ts src/app/api/v1/analytics/position-fit tests/unit/boardPositionFitService.test.ts tests/integration/board-api.test.ts
git commit -m "feat(board): kesesuaian KPI pegawai terhadap template jabatan"
```

---

### Task 6: `boardCostService` + route

**Files:**
- Create: `src/lib/services/boardCostService.ts`
- Create: `src/app/api/v1/analytics/board-cost/route.ts`
- Test: `tests/unit/boardCostService.test.ts`
- Test: `tests/integration/board-api.test.ts` (tambahkan blok biaya)

**Interfaces:**
- Consumes: `Db`; `listSocialSecurityForHr(db)` dari `@/lib/services/socialSecurityService` (sudah mem-mask nomor)
- Produces: `getBoardCostOverview(db: Db, options?: BoardCostOptions): Promise<BoardCostOverview>`

**Fakta data seed:** 2 run (2026-09 APPROVED, 2026-08 PAID), masing-masing 4 item. Run terbaru: gross 150.250.000, net 135.710.000. 3 kartu BPJS. 3 pengajuan lembur (2 SUBMITTED). 3 klaim biaya.

- [ ] **Step 1: Write the failing test**

Buat `tests/unit/boardCostService.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { getBoardCostOverview } from '@/lib/services/boardCostService';

describe('Board Cost Overview (Payroll, BPJS, Lembur, Operasional)', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  it('memakai run payroll terbaru sebagai dasar rincian', async () => {
    const result = await getBoardCostOverview(db);
    expect(result.payroll.latest?.periodCode).toBe('2026-09');
    expect(result.payroll.latest?.totalNet).toBe(135710000);
    expect(result.sampleSize).toBe(4);
    expect(result.employees).toHaveLength(4);
  });

  it('menghitung jumlah item per run, bukan mengisi nol', async () => {
    const result = await getBoardCostOverview(db);
    expect(result.payroll.runs).toHaveLength(2);
    for (const run of result.payroll.runs) {
      expect(run.employeeCount).toBe(4);
    }
  });

  it('menghitung biaya per pegawai dan konsentrasi top-decil', async () => {
    const result = await getBoardCostOverview(db);
    expect(result.analysis.costPerEmployee).toBeCloseTo(33927500, 0);
    expect(Number.isFinite(result.analysis.topDecileCostShare)).toBe(true);
    expect(result.analysis.topDecileCostShare).toBeGreaterThan(0);
    expect(result.analysis.topDecileCostShare).toBeLessThanOrEqual(100);
  });

  it('menghitung pertumbuhan payroll dan null pada titik pertama', async () => {
    const result = await getBoardCostOverview(db);
    expect(result.analysis.payrollGrowthPercentage).not.toBeNull();

    const trend = result.payroll.trend;
    expect(trend).toHaveLength(2);
    // Trend diurutkan lama -> baru; titik pertama tidak punya pembanding.
    expect(trend[0].deltaPercentage).toBeNull();
    expect(trend[1].deltaPercentage).not.toBeNull();
  });

  it('mem-mask nomor BPJS dan tidak membocorkan nomor utuh', async () => {
    const result = await getBoardCostOverview(db);
    expect(result.bpjs.employees.length).toBeGreaterThanOrEqual(3);
    const withNumber = result.bpjs.employees.filter((e) => e.bpjsKesNumberMasked);
    expect(withNumber.length).toBeGreaterThanOrEqual(2);

    for (const row of result.bpjs.employees) {
      expect(row.bpjsKesNumberMasked ?? '').not.toMatch(/^\d{16}$/);
      expect(row.bpjsTkNumberMasked ?? '').not.toMatch(/^\d{16}$/);
    }
    expect(JSON.stringify(result)).not.toMatch(/\d{16}/);
  });

  it('meringkas lembur dan pengajuan yang menunggu persetujuan', async () => {
    const result = await getBoardCostOverview(db);
    expect(result.overtime.totalHours).toBe(2);
    expect(result.overtime.totalPay).toBe(750000);
    expect(result.overtime.pendingApprovals).toBe(2);
    expect(result.overtime.byDepartment.length).toBeGreaterThan(0);
  });

  it('meringkas biaya operasional per kategori dan status', async () => {
    const result = await getBoardCostOverview(db);
    expect(result.operational.totalAmount).toBe(2550000);
    const travel = result.operational.byCategory.find((c) => c.category === 'TRAVEL');
    expect(travel?.amount).toBe(1250000);
    expect(travel?.count).toBe(1);
  });

  it('menghormati paginasi rincian pegawai', async () => {
    const page1 = await getBoardCostOverview(db, { page: 1, pageSize: 2 });
    expect(page1.employees).toHaveLength(2);
    expect(page1.employeesPagination.total).toBe(4);

    const page2 = await getBoardCostOverview(db, { page: 2, pageSize: 2 });
    expect(page2.employees).toHaveLength(2);
    const ids1 = page1.employees.map((e) => e.employeeId);
    const ids2 = page2.employees.map((e) => e.employeeId);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it('aman saat belum ada run payroll sama sekali', async () => {
    await client.exec('DELETE FROM payroll_items; DELETE FROM payroll_runs;');
    const result = await getBoardCostOverview(db);

    expect(result.payroll.latest).toBeNull();
    expect(result.payroll.runs).toEqual([]);
    expect(result.employees).toEqual([]);
    expect(result.sampleSize).toBe(0);
    expect(result.analysis.costPerEmployee).toBe(0);
    expect(result.analysis.topDecileCostShare).toBe(0);
    expect(result.analysis.payrollGrowthPercentage).toBeNull();
    expect(result.analysis.highlights.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/boardCostService.test.ts`
Expected: FAIL — `Cannot find module '@/lib/services/boardCostService'`.

- [ ] **Step 3: Write the service**

Buat `src/lib/services/boardCostService.ts`:

```ts
import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { listPayrollRuns } from './payrollService';
import { listSocialSecurityForHr } from './socialSecurityService';

export interface BoardCostOptions {
  runId?: string;
  page?: number;
  pageSize?: number;
}

export interface BoardCostEmployeeRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  positionTitle: string;
  baseSalary: number;
  fixedAllowance: number;
  overtimePay: number;
  bpjsKesehatan: number;
  bpjsJht: number;
  bpjsJp: number;
  pph21: number;
  gross: number;
  totalDeductions: number;
  net: number;
  overtimeHours: number;
}

export interface BoardCostOverview {
  sampleSize: number;
  payroll: {
    runs: Array<{
      runId: string;
      periodCode: string;
      status: string;
      totalGross: number;
      totalDeductions: number;
      totalNet: number;
      employeeCount: number;
      approvedAt: string | null;
    }>;
    latest: { runId: string; periodCode: string; totalGross: number; totalNet: number } | null;
    trend: Array<{ periodCode: string; totalNet: number; deltaPercentage: number | null }>;
  };
  employees: BoardCostEmployeeRow[];
  employeesPagination: { page: number; pageSize: number; total: number };
  bpjs: {
    totalRegistered: number;
    totalPending: number;
    totalMissing: number;
    byClass: Array<{ className: string; count: number }>;
    employees: Array<{
      employeeId: string;
      employeeCode: string;
      fullName: string;
      bpjsTkNumberMasked: string | null;
      bpjsKesNumberMasked: string | null;
      bpjsKesClass: string | null;
      bpjsTkStatus: string;
      bpjsKesStatus: string;
    }>;
  };
  overtime: {
    totalHours: number;
    totalPay: number;
    pendingApprovals: number;
    byDepartment: Array<{ departmentName: string; hours: number; pay: number }>;
  };
  operational: {
    totalAmount: number;
    byCategory: Array<{ category: string; count: number; amount: number }>;
    byStatus: Array<{ status: string; count: number; amount: number }>;
  };
  analysis: {
    costPerEmployee: number;
    topDecileCostShare: number;
    payrollGrowthPercentage: number | null;
    highlights: string[];
  };
}

const DEFAULT_PAGE_SIZE = 50;

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export async function getBoardCostOverview(
  db: Db,
  options: BoardCostOptions = {}
): Promise<BoardCostOverview> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE));

  const runs = (await listPayrollRuns(db, 12)) as Array<{
    id: string;
    periodCode: string;
    status: string;
    totalGross: number;
    totalDeductions: number;
    totalNet: number;
    approvedAt: unknown;
  }>;

  const selectedRunId =
    options.runId ?? (runs.length > 0 ? String(runs[0].id) : null);
  const selectedRun = selectedRunId
    ? runs.find((r) => String(r.id) === selectedRunId) ?? null
    : null;

  // Jumlah item per run dihitung sekali, bukan ditebak atau diisi 0.
  const runCountsRes = (await db.execute(sql`
    SELECT run_id AS "runId", COUNT(*)::int AS total
      FROM payroll_items
     GROUP BY run_id
  `)) as unknown as { rows: Array<{ runId: string; total: number }> };
  const runCounts = new Map(
    (runCountsRes.rows ?? []).map((r) => [String(r.runId), Number(r.total)])
  );

  const countRes = (await db.execute(sql`
    SELECT COUNT(*)::int AS total
      FROM payroll_items
     WHERE ${selectedRunId ? sql`run_id = ${selectedRunId}::uuid` : sql`FALSE`}
  `)) as unknown as { rows: Array<{ total: number }> };
  const totalEmployees = Number(countRes.rows?.[0]?.total ?? 0);

  const itemsRes = (await db.execute(sql`
    SELECT pi.employee_id AS "employeeId", e.employee_code AS "employeeCode",
           e.full_name AS "fullName", d.department_name AS "departmentName",
           jp.position_title AS "positionTitle",
           pi.base_salary::float8 AS "baseSalary",
           pi.fixed_allowance::float8 AS "fixedAllowance",
           pi.overtime_pay::float8 AS "overtimePay",
           pi.bpjs_kesehatan::float8 AS "bpjsKesehatan",
           pi.bpjs_jht::float8 AS "bpjsJht",
           pi.bpjs_jp::float8 AS "bpjsJp",
           pi.pph21::float8 AS "pph21",
           pi.gross::float8 AS gross,
           pi.total_deductions::float8 AS "totalDeductions",
           pi.net::float8 AS net,
           pi.overtime_hours::float8 AS "overtimeHours"
      FROM payroll_items pi
      JOIN employees e ON e.id = pi.employee_id
      JOIN departments d ON d.id = e.department_id
      JOIN job_positions jp ON jp.id = e.position_id
     WHERE ${selectedRunId ? sql`pi.run_id = ${selectedRunId}::uuid` : sql`FALSE`}
     ORDER BY pi.net DESC
     LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `)) as unknown as { rows: BoardCostEmployeeRow[] };

  const employees = (itemsRes.rows ?? []).map((r) => ({
    ...r,
    baseSalary: Number(r.baseSalary),
    fixedAllowance: Number(r.fixedAllowance),
    overtimePay: Number(r.overtimePay),
    bpjsKesehatan: Number(r.bpjsKesehatan),
    bpjsJht: Number(r.bpjsJht),
    bpjsJp: Number(r.bpjsJp),
    pph21: Number(r.pph21),
    gross: Number(r.gross),
    totalDeductions: Number(r.totalDeductions),
    net: Number(r.net),
    overtimeHours: Number(r.overtimeHours),
  }));

  // Konsentrasi biaya: porsi total net yang dipegang 10% pegawai termahal.
  const decileRes = (await db.execute(sql`
    WITH ranked AS (
      SELECT net::float8 AS net,
             NTILE(10) OVER (ORDER BY net DESC) AS decile
        FROM payroll_items
       WHERE ${selectedRunId ? sql`run_id = ${selectedRunId}::uuid` : sql`FALSE`}
    )
    SELECT COALESCE(SUM(net), 0)::float8 AS total,
           COALESCE(SUM(CASE WHEN decile = 1 THEN net ELSE 0 END), 0)::float8 AS top
      FROM ranked
  `)) as unknown as { rows: Array<{ total: number; top: number }> };
  const decile = decileRes.rows?.[0];
  const totalNetAll = Number(decile?.total ?? 0);
  const topNet = Number(decile?.top ?? 0);

  // Trend diurutkan lama -> baru agar delta mudah dibaca.
  const chronological = [...runs].reverse();
  const trend = chronological.map((run, idx) => {
    const prev = idx > 0 ? Number(chronological[idx - 1].totalNet) : null;
    const current = Number(run.totalNet);
    return {
      periodCode: run.periodCode,
      totalNet: current,
      deltaPercentage:
        prev !== null && prev > 0 ? round2(((current - prev) / prev) * 100) : null,
    };
  });
  const payrollGrowthPercentage =
    trend.length >= 2 ? trend[trend.length - 1].deltaPercentage : null;

  const overtimeRes = (await db.execute(sql`
    SELECT d.department_name AS "departmentName",
           COALESCE(SUM(pi.overtime_hours), 0)::float8 AS hours,
           COALESCE(SUM(pi.overtime_pay), 0)::float8 AS pay
      FROM payroll_items pi
      JOIN employees e ON e.id = pi.employee_id
      JOIN departments d ON d.id = e.department_id
     WHERE ${selectedRunId ? sql`pi.run_id = ${selectedRunId}::uuid` : sql`FALSE`}
     GROUP BY d.department_name
     ORDER BY hours DESC
  `)) as unknown as {
    rows: Array<{ departmentName: string; hours: number; pay: number }>;
  };

  const pendingRes = (await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM overtime_requests WHERE status = 'SUBMITTED'
  `)) as unknown as { rows: Array<{ total: number }> };

  const opRes = (await db.execute(sql`
    SELECT claim_category AS category, COUNT(*)::int AS count, SUM(amount)::float8 AS amount
      FROM expense_claims GROUP BY claim_category ORDER BY amount DESC
  `)) as unknown as {
    rows: Array<{ category: string; count: number; amount: number }>;
  };
  const opStatusRes = (await db.execute(sql`
    SELECT status, COUNT(*)::int AS count, SUM(amount)::float8 AS amount
      FROM expense_claims GROUP BY status ORDER BY amount DESC
  `)) as unknown as {
    rows: Array<{ status: string; count: number; amount: number }>;
  };

  // Nomor BPJS sudah ter-masking di service sumber; jangan pernah membuka di sini.
  const bpjsRows = await listSocialSecurityForHr(db);
  const byClassMap = new Map<string, number>();
  for (const row of bpjsRows) {
    if (!row.registered) continue;
    const key = row.bpjsKesClass ?? 'Tidak diketahui';
    byClassMap.set(key, (byClassMap.get(key) ?? 0) + 1);
  }

  const overtimeHours = (overtimeRes.rows ?? []).reduce((s, r) => s + Number(r.hours), 0);
  const overtimePay = (overtimeRes.rows ?? []).reduce((s, r) => s + Number(r.pay), 0);
  const operationalTotal = (opRes.rows ?? []).reduce((s, r) => s + Number(r.amount), 0);

  const costPerEmployee = totalEmployees > 0 ? round2(totalNetAll / totalEmployees) : 0;
  const topDecileCostShare =
    totalNetAll > 0 ? Math.round((topNet / totalNetAll) * 1000) / 10 : 0;

  const highlights: string[] = [];
  if (!selectedRun) {
    highlights.push('Belum ada run payroll sehingga rincian biaya belum tersedia.');
  } else {
    highlights.push(
      `Payroll ${selectedRun.periodCode}: net ${totalNetAll.toLocaleString('id-ID')} untuk ${totalEmployees} pegawai.`
    );
    if (topDecileCostShare > 0) {
      highlights.push(`10% pegawai termahal menyerap ${topDecileCostShare}% total biaya.`);
    }
    if (payrollGrowthPercentage !== null) {
      const direction = payrollGrowthPercentage >= 0 ? 'naik' : 'turun';
      highlights.push(
        `Biaya payroll ${direction} ${Math.abs(payrollGrowthPercentage)}% dibanding periode sebelumnya.`
      );
    }
    if (Number(pendingRes.rows?.[0]?.total ?? 0) > 0) {
      highlights.push(
        `${pendingRes.rows[0].total} pengajuan lembur menunggu persetujuan.`
      );
    }
  }

  return {
    sampleSize: totalEmployees,
    payroll: {
      runs: runs.map((r) => ({
        runId: String(r.id),
        periodCode: r.periodCode,
        status: r.status,
        totalGross: Number(r.totalGross),
        totalDeductions: Number(r.totalDeductions),
        totalNet: Number(r.totalNet),
        employeeCount: runCounts.get(String(r.id)) ?? 0,
        approvedAt: r.approvedAt ? new Date(r.approvedAt as string).toISOString() : null,
      })),
      latest: selectedRun
        ? {
            runId: String(selectedRun.id),
            periodCode: selectedRun.periodCode,
            totalGross: Number(selectedRun.totalGross),
            totalNet: Number(selectedRun.totalNet),
          }
        : null,
      trend,
    },
    employees,
    employeesPagination: { page, pageSize, total: totalEmployees },
    bpjs: {
      totalRegistered: bpjsRows.filter((r) => r.registered).length,
      totalPending: bpjsRows.filter(
        (r) => r.registered && (r.bpjsTkStatus === 'PENDING' || r.bpjsKesStatus === 'PENDING')
      ).length,
      totalMissing: bpjsRows.filter((r) => !r.registered).length,
      byClass: Array.from(byClassMap.entries()).map(([className, count]) => ({ className, count })),
      employees: bpjsRows.map((r) => ({
        employeeId: r.employeeId,
        employeeCode: r.employeeCode,
        fullName: r.employeeName,
        bpjsTkNumberMasked: r.bpjsTkNumber,
        bpjsKesNumberMasked: r.bpjsKesNumber,
        bpjsKesClass: r.bpjsKesClass,
        bpjsTkStatus: r.bpjsTkStatus,
        bpjsKesStatus: r.bpjsKesStatus,
      })),
    },
    overtime: {
      totalHours: overtimeHours,
      totalPay: overtimePay,
      pendingApprovals: Number(pendingRes.rows?.[0]?.total ?? 0),
      byDepartment: (overtimeRes.rows ?? []).map((r) => ({
        departmentName: r.departmentName,
        hours: Number(r.hours),
        pay: Number(r.pay),
      })),
    },
    operational: {
      totalAmount: operationalTotal,
      byCategory: (opRes.rows ?? []).map((r) => ({
        category: r.category,
        count: Number(r.count),
        amount: Number(r.amount),
      })),
      byStatus: (opStatusRes.rows ?? []).map((r) => ({
        status: r.status,
        count: Number(r.count),
        amount: Number(r.amount),
      })),
    },
    analysis: {
      costPerEmployee,
      topDecileCostShare,
      payrollGrowthPercentage,
      highlights,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/boardCostService.test.ts`
Expected: PASS (9 test).

- [ ] **Step 5: Write the route**

Buat `src/app/api/v1/analytics/board-cost/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { getBoardCostOverview } from '@/lib/services/boardCostService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    // Data gaji bersifat RESTRICTED: hanya peran dengan payroll:read.
    assertCan(session, 'payroll:read');

    const sp = req.nextUrl.searchParams;
    const runId = sp.get('runId') || undefined;
    const page = Number(sp.get('page') ?? '1');
    const pageSize = Number(sp.get('pageSize') ?? '50');

    if (runId && !UUID_RE.test(runId)) {
      return fail('VALIDATION_ERROR', 'runId harus berupa UUID.', 400);
    }
    if (!Number.isInteger(page) || page < 1) {
      return fail('VALIDATION_ERROR', 'page harus bilangan bulat >= 1.', 400);
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
      return fail('VALIDATION_ERROR', 'pageSize harus 1-200.', 400);
    }

    const data = await getBoardCostOverview(db, { runId, page, pageSize });
    return ok(data);
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal memuat ringkasan biaya',
      status
    );
  }
}
```

- [ ] **Step 6: Add integration coverage**

Tambahkan impor di `tests/integration/board-api.test.ts`:

```ts
import { GET as getCost } from '@/app/api/v1/analytics/board-cost/route';
```

Dan blok berikut di dalam `describe('Boardroom API', ...)`:

```ts
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
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/unit/boardCostService.test.ts tests/integration/board-api.test.ts`
Expected: PASS (9 unit + 15 integrasi = 24 test).

- [ ] **Step 8: Commit**

```bash
git add src/lib/services/boardCostService.ts src/app/api/v1/analytics/board-cost tests/unit/boardCostService.test.ts tests/integration/board-api.test.ts
git commit -m "feat(board): rincian payroll, BPJS ter-masking, lembur, dan biaya operasional"
```

---

### Task 7: Konteks AI Boardroom + endpoint `ai/board-analysis`

**Files:**
- Modify: `src/lib/services/aiService.ts` (tambahkan `analyzeWithContext`, `analyzeFeature` memakainya)
- Modify: `src/lib/services/aiContext.ts` (tambahkan `case 'board'`)
- Create: `src/app/api/v1/ai/board-analysis/route.ts`
- Test: `tests/unit/aiBoardContext.test.ts`
- Test: `tests/integration/board-api.test.ts` (tambahkan blok AI)

**Interfaces:**
- Consumes: `buildFeatureContext`, `analyzeWithContext`, `activeProvider`, `hashPayload`, `getCachedInsight`, `saveInsight`, `logAction`
- Produces:
  - `analyzeWithContext(context: Record<string, unknown>, feature: string, role: string): Promise<{ insight: string; configured: boolean }>`
  - `POST /api/v1/ai/board-analysis` body `{ periodCode?: string; force?: boolean }`

**Aturan keras:** konteks `board` dibangun dengan **allowlist eksplisit**. Tidak boleh memuat `baseSalary`, `net`, `gross`, `pph21`, `bpjs*`, atau apa pun dari `payroll_*`.

- [ ] **Step 1: Write the failing context test**

Buat `tests/unit/aiBoardContext.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { buildFeatureContext } from '@/lib/services/aiContext';

const FORBIDDEN_KEYS = [
  'baseSalary', 'fixedAllowance', 'overtimePay', 'pph21',
  'gross', 'net', 'totalDeductions', 'bpjsKesehatan', 'bpjsJht', 'bpjsJp',
  'bpjsTkNumber', 'bpjsKesNumber', 'bpjsTkNumberMasked', 'bpjsKesNumberMasked',
];

describe('Konteks AI Boardroom', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  it('merakit konteks board dari visi, pilar, RJMP, posisi, dan aktivitas', async () => {
    const ctx: any = await buildFeatureContext(db, 'board');
    expect(ctx.feature).toBe('board');
    expect(ctx.vision).toContain('kelas dunia');
    expect(ctx.missions).toHaveLength(3);
    expect(ctx.pillars).toHaveLength(4);
    expect(ctx.rjmp).toHaveLength(4);
    expect(ctx.positionFit.sampleSize).toBeGreaterThan(0);
    expect(ctx.activity.totalEvents).toBeGreaterThan(0);
  });

  it('tidak memuat satu pun kunci payroll atau BPJS', async () => {
    const ctx: any = await buildFeatureContext(db, 'board');
    const flat = JSON.stringify(ctx);

    for (const key of FORBIDDEN_KEYS) {
      expect(flat).not.toContain(`"${key}"`);
    }
    // Nomor BPJS seed berjumlah 16 digit; tidak boleh ada di konteks.
    expect(flat).not.toMatch(/\d{16}/);
  });

  it('tidak memuat data RESTRICTED aktivitas', async () => {
    const ctx: any = await buildFeatureContext(db, 'board');
    expect(JSON.stringify(ctx)).not.toContain('rahasia');
  });

  it('tetap aman bila data kosong', async () => {
    await client.exec('DELETE FROM individual_kpis');
    const ctx: any = await buildFeatureContext(db, 'board');
    expect(ctx.pillars).toHaveLength(4);
    expect(ctx.overallAchievement).toBe(0);
    expect(JSON.stringify(ctx)).not.toContain('NaN');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/aiBoardContext.test.ts`
Expected: FAIL — `ctx.feature` bernilai `'board'` tetapi `ctx.vision` undefined (fallback generik), dan `ctx.pillars` undefined.

- [ ] **Step 3: Extend `aiContext.ts`**

Di `src/lib/services/aiContext.ts`, tambahkan impor di bagian atas:

```ts
import { getVisionAchievement } from './boardVisionAchievementService';
import { getPositionFit } from './boardPositionFitService';
import { getBoardActivityAnalytics } from './boardActivityAnalyticsService';
```

Lalu tambahkan `case` berikut **sebelum** `case 'audit':`:

```ts
      case 'board': {
        // Allowlist eksplisit: hanya agregat non-RESTRICTED. Gaji, komponen
        // payroll, dan nomor BPJS sengaja TIDAK diambil sama sekali.
        const [vision, fit, activity] = await Promise.all([
          getVisionAchievement(db),
          getPositionFit(db),
          getBoardActivityAnalytics(db),
        ]);
        return {
          feature: 'board',
          vision: vision.vision,
          missions: vision.missions,
          overallAchievement: vision.overallAchievementPercentage,
          pillars: vision.pillars.map((p) => ({
            name: p.pillarName,
            perspective: p.perspective,
            weight: p.strategicWeight,
            achievement: p.achievementPercentage,
            status: p.status,
          })),
          rjmp: vision.rjmp.map((r) => ({
            code: r.kpiCode,
            name: r.kpiName,
            target: r.targetValue,
            derivedAchievement: r.derivedAchievementPercentage,
            status: r.status,
          })),
          positionFit: {
            sampleSize: fit.sampleSize,
            compliantPositions: fit.analysis.compliantPositions,
            positionsWithoutTemplate: fit.analysis.positionsWithoutTemplate,
            averageCoverage: fit.analysis.averageCoveragePercentage,
          },
          activity: {
            totalEvents: activity.totalEvents,
            coveragePercentage: activity.analysis.coveragePercentage,
            busiestDepartment: activity.analysis.busiestDepartment,
            busiestEventType: activity.analysis.busiestEventType,
          },
        };
      }
```

- [ ] **Step 4: Run context test to verify it passes**

Run: `npx vitest run tests/unit/aiBoardContext.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Refactor `aiService` to accept a context**

Di `src/lib/services/aiService.ts`, ganti isi `analyzeFeature` menjadi:

```ts
/** Menganalisis konteks yang sudah dirakit pemanggil (dipakai endpoint ber-cache). */
export async function analyzeWithContext(
  context: Record<string, unknown>,
  feature: string,
  role: string
): Promise<{ insight: string; configured: boolean }> {
  const prompt =
    `Peran pengguna: ${ROLE_HINT[role] ?? role}.\n` +
    `Fitur yang dianalisis: ${feature}.\n` +
    `Ringkasan data (JSON):\n${JSON.stringify(context)}\n\n` +
    `Tulis analisis dalam BAHASA INDONESIA dengan struktur tepat berikut, ` +
    `tanpa menambahkan bagian lain:\n` +
    `**Ringkasan:** (2 kalimat tentang kondisi saat ini)\n` +
    `**Temuan Penting:**\n- (temuan 1)\n- (temuan 2)\n- (temuan 3)\n` +
    `**Rekomendasi Tindakan:**\n1. (rekomendasi 1)\n2. (rekomendasi 2)\n` +
    `Gunakan hanya data pada ringkasan di atas; jangan mengarang angka. Ringkas dan profesional.`;
  const res = await generateContent(prompt, { maxOutputTokens: 2048, temperature: 0.25 });
  return { insight: res.text, configured: res.configured };
}

export async function analyzeFeature(
  db: Db,
  feature: string,
  role: string
): Promise<{ insight: string; configured: boolean }> {
  const context = await buildFeatureContext(db, feature);
  return analyzeWithContext(context, feature, role);
}
```

- [ ] **Step 6: Verify existing AI route still works**

Run: `npx vitest run tests/api/ai-routes.test.ts`
Expected: PASS — refactor tidak mengubah perilaku `/api/v1/ai/analyze`.

- [ ] **Step 7: Write the board-analysis route**

Buat `src/app/api/v1/ai/board-analysis/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, fail } from '@/lib/api/response';
import { db } from '@/lib/db/client';
import { buildFeatureContext } from '@/lib/services/aiContext';
import { analyzeWithContext, activeProvider } from '@/lib/services/aiService';
import {
  getCachedInsight,
  saveInsight,
  hashPayload,
} from '@/lib/services/aiInsightCacheService';
import { logAction } from '@/lib/services/auditService';

const Body = z.object({
  periodCode: z.string().min(1).max(50).optional(),
  force: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return fail('UNAUTHORIZED', 'Sesi tidak valid.', 401);
    assertCan(session, 'ai:read');

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', 'Body tidak valid.', 400);
    }

    const periodCode = parsed.data.periodCode ?? 'ALL';
    const force = parsed.data.force === true;
    const key = { feature: 'board', periodCode, role: session.role };

    const existing = await getCachedInsight(db, key);

    // Tanpa force: sajikan cache agar rapat BOD tidak memicu panggilan berulang.
    if (!force && existing) {
      return ok({
        insight: existing.insight,
        provider: existing.provider,
        generatedAt: existing.generatedAt,
        fromCache: true,
        configured: true,
      });
    }

    const context = await buildFeatureContext(db, 'board');
    const { insight, configured } = await analyzeWithContext(context, 'board', session.role);

    if (!configured) {
      // Tanpa kunci provider bukan kegagalan server: beri pesan ramah.
      return ok({
        insight,
        provider: null,
        generatedAt: null,
        fromCache: false,
        configured: false,
      });
    }

    const provider = activeProvider();
    await saveInsight(db, {
      ...key,
      insight,
      provider,
      payloadHash: hashPayload(context),
    });

    // action_type dibatasi CHECK constraint audit_logs: CREATE/UPDATE saja.
    await logAction(db, {
      userId: session.userId,
      actionType: existing ? 'UPDATE' : 'CREATE',
      entityName: 'ai_insights',
      recordId: `${key.feature}:${key.periodCode}:${key.role}`,
      description: `Analisis AI ${key.feature} periode ${key.periodCode}`,
    });

    return ok({
      insight,
      provider,
      generatedAt: new Date().toISOString(),
      fromCache: false,
      configured: true,
    });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500;
    return fail(
      status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR',
      err?.message ?? 'Gagal menjalankan analisis AI',
      status
    );
  }
}
```

- [ ] **Step 8: Add integration coverage**

Tambahkan impor di `tests/integration/board-api.test.ts`:

```ts
import { POST as postBoardAnalysis } from '@/app/api/v1/ai/board-analysis/route';
import { saveInsight, hashPayload } from '@/lib/services/aiInsightCacheService';
```

Dan blok berikut di dalam `describe('Boardroom API', ...)`:

```ts
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

    it('mengembalikan cache bila tersedia tanpa memanggil provider', async () => {
      await saveInsight(db, {
        feature: 'board',
        periodCode: '2026-Q3',
        role: 'BOD',
        insight: 'Analisis tersimpan.',
        provider: 'groq',
        payloadHash: hashPayload({ cached: true }),
      });

      const res = await postBoardAnalysis(
        postReq({ periodCode: '2026-Q3' }, bodCookie)
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.fromCache).toBe(true);
      expect(json.data.insight).toBe('Analisis tersimpan.');
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
  });
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run tests/unit/aiBoardContext.test.ts tests/api/ai-routes.test.ts tests/integration/board-api.test.ts`
Expected: PASS (4 unit konteks + 18 integrasi board-api + seluruh suite AI routes yang sudah ada).

- [ ] **Step 10: Commit**

```bash
git add src/lib/services/aiService.ts src/lib/services/aiContext.ts src/app/api/v1/ai/board-analysis tests/unit/aiBoardContext.test.ts tests/integration/board-api.test.ts
git commit -m "feat(ai): analisis boardroom ber-cache dengan konteks tanpa data RESTRICTED"
```

---

### Task 8: UI lima tab `/dashboard/executive`

**Files:**
- Create: `src/components/executive/BoardTabNav.tsx`
- Create: `src/components/executive/BoardActivityPanel.tsx`
- Create: `src/components/executive/BoardVisionPanel.tsx`
- Create: `src/components/executive/BoardPositionFitPanel.tsx`
- Create: `src/components/executive/BoardCostPanel.tsx`
- Create: `src/components/executive/BoardAiInsight.tsx`
- Modify: `src/app/dashboard/executive/page.tsx`
- Test: `tests/ui/board-executive.test.tsx`

**Interfaces:**
- Consumes: keempat endpoint Task 3–6 dan `POST /api/v1/ai/board-analysis`
- Produces: `BoardTab`, `BOARD_TABS`, `BoardTabNav`

- [ ] **Step 1: Write the failing UI test**

Buat `tests/ui/board-executive.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import BoardTabNav from '@/components/executive/BoardTabNav';
import BoardActivityPanel from '@/components/executive/BoardActivityPanel';
import BoardVisionPanel from '@/components/executive/BoardVisionPanel';
import BoardPositionFitPanel from '@/components/executive/BoardPositionFitPanel';
import BoardCostPanel from '@/components/executive/BoardCostPanel';

const okJson = (data: unknown) => ({ ok: true, json: async () => ({ status: 'success', data }) });

const activity = {
  fromDate: '2026-09-19', toDate: '2026-09-24', sampleSize: 11, totalEvents: 11,
  byEventType: [{ eventType: 'KPI_DAILY', count: 3, percentage: 27.3 }],
  byDepartment: [{ departmentName: 'IT', count: 8 }],
  byOwnerRole: [{ role: 'EMPLOYEE', count: 6, percentage: 54.5 }],
  dailyTrend: [{ date: '2026-09-24', count: 3 }],
  recent: [{ id: 'a1', employeeName: 'Budi Pratama', employeeCode: 'EMP-0042',
    departmentName: 'IT', eventType: 'KPI_DAILY', summary: 'Mengisi KPI harian',
    occurredAt: '2026-09-24T02:30:00.000Z' }],
  analysis: { busiestDepartment: 'IT', busiestEventType: 'KPI_DAILY',
    coveragePercentage: 50, activeEmployees: 10, highlights: ['11 aktivitas tercatat.'] },
};

const vision = {
  vision: 'Menjadi perusahaan kelas dunia.', missions: ['Misi satu', 'Misi dua'],
  sampleSize: 4, overallAchievementPercentage: 92.8,
  pillars: [
    { pillarId: 'p1', pillarName: 'Finansial', perspective: 'FINANCIAL',
      strategicWeight: 25, kpiCount: 1, achievementPercentage: 92.5, status: 'BELOW_TARGET' },
    { pillarId: 'p2', pillarName: 'Pelanggan', perspective: 'CUSTOMER',
      strategicWeight: 25, kpiCount: 0, achievementPercentage: 0, status: 'NO_DATA' },
  ],
  rjmp: [{ corporateKpiId: 'c1', kpiCode: 'CORP-FIN-01', kpiName: 'Revenue Growth',
    periodYear: 2026, targetValue: 15, unit: '%', derivedAchievementPercentage: 92.5,
    status: 'BELOW_TARGET' }],
  analysis: { achievedPillarCount: 0, belowTargetPillarCount: 1, noDataPillarCount: 1,
    weakestPillar: 'Finansial', strongestPillar: 'Finansial', highlights: ['Capaian 92.8%.'] },
};

const fit = {
  sampleSize: 10,
  byPosition: [{ positionId: 'pos1', positionTitle: 'Senior Software Engineer',
    jobGrade: 'G4', holders: 4, compliantHolders: 1, templateKpiCount: 3, matchedKpiCount: 1,
    coveragePercentage: 42.5, achievementPercentage: 90, status: 'PARTIAL' }],
  employees: [{ employeeId: 'e1', employeeCode: 'EMP-0042', fullName: 'Budi Pratama',
    departmentName: 'IT', positionId: 'pos1', positionTitle: 'Senior Software Engineer',
    jobGrade: 'G4', templateKpiCount: 3, matchedKpiCount: 0, coveragePercentage: 0,
    achievementPercentage: 0, latestGpa: 3.67, latestRating: 'A', status: 'NOT_COMPLIANT' }],
  analysis: { compliantPositions: 1, positionsWithoutTemplate: 2,
    averageCoveragePercentage: 42.5, highlights: ['1 dari 8 posisi sesuai template.'] },
};

const cost = {
  sampleSize: 4,
  payroll: {
    runs: [{ runId: 'r1', periodCode: '2026-09', status: 'APPROVED', totalGross: 150250000,
      totalDeductions: 14540000, totalNet: 135710000, employeeCount: 4, approvedAt: null }],
    latest: { runId: 'r1', periodCode: '2026-09', totalGross: 150250000, totalNet: 135710000 },
    trend: [{ periodCode: '2026-09', totalNet: 135710000, deltaPercentage: null }],
  },
  employees: [{ employeeId: 'e1', employeeCode: 'EMP-0042', fullName: 'Budi Pratama',
    departmentName: 'IT', positionTitle: 'Senior Software Engineer', baseSalary: 28500000,
    fixedAllowance: 2500000, overtimePay: 750000, bpjsKesehatan: 285000, bpjsJht: 570000,
    bpjsJp: 285000, pph21: 1500000, gross: 31750000, totalDeductions: 2640000,
    net: 29110000, overtimeHours: 2 }],
  employeesPagination: { page: 1, pageSize: 50, total: 4 },
  bpjs: { totalRegistered: 3, totalPending: 1, totalMissing: 7,
    byClass: [{ className: 'Kelas 1', count: 2 }],
    employees: [{ employeeId: 'e1', employeeCode: 'EMP-0042', fullName: 'Budi Pratama',
      bpjsTkNumberMasked: '••••••••••••0123', bpjsKesNumberMasked: '••••••••••••0123',
      bpjsKesClass: 'Kelas 1', bpjsTkStatus: 'ACTIVE', bpjsKesStatus: 'ACTIVE' }] },
  overtime: { totalHours: 2, totalPay: 750000, pendingApprovals: 2,
    byDepartment: [{ departmentName: 'IT', hours: 2, pay: 750000 }] },
  operational: { totalAmount: 2550000,
    byCategory: [{ category: 'TRAVEL', count: 1, amount: 1250000 }],
    byStatus: [{ status: 'APPROVED', count: 1, amount: 1250000 }] },
  analysis: { costPerEmployee: 33927500, topDecileCostShare: 47.7,
    payrollGrowthPercentage: 0.56,
    highlights: ['Payroll 2026-09 net 135.710.000 untuk 4 pegawai.',
      '10% pegawai termahal menyerap 47.7% total biaya.',
      '2 pengajuan lembur menunggu persetujuan.'] },
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes('board-activity')) return okJson(activity);
    if (u.includes('vision-achievement')) return okJson(vision);
    if (u.includes('position-fit')) return okJson(fit);
    if (u.includes('board-cost')) return okJson(cost);
    if (u.includes('board-analysis')) {
      return { ok: true, json: async () => ({ status: 'success', data: {
        insight: 'Ringkasan AI.', provider: 'groq', generatedAt: '2026-10-26T00:00:00.000Z',
        fromCache: false, configured: true } }) };
    }
    return okJson({});
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('BoardTabNav', () => {
  it('merender lima tab dan memanggil onChange saat diklik', async () => {
    const onChange = vi.fn();
    render(<BoardTabNav active="overview" onChange={onChange} />);

    expect(screen.getByText('Ringkasan VMAI & BSC')).toBeTruthy();
    expect(screen.getByText('Aktivitas Semua Profil')).toBeTruthy();
    expect(screen.getByText('Visi-Misi & Analisis AI')).toBeTruthy();
    expect(screen.getByText('Kesesuaian Posisi & RJMP')).toBeTruthy();
    expect(screen.getByText('Payroll, BPJS & Biaya')).toBeTruthy();

    fireEvent.click(screen.getByText('Aktivitas Semua Profil'));
    expect(onChange).toHaveBeenCalledWith('activity');
  });
});

describe('BoardActivityPanel', () => {
  it('menampilkan analisis dan rincian aktivitas', async () => {
    render(<BoardActivityPanel />);
    await waitFor(() => expect(screen.getByText(/11 aktivitas tercatat/)).toBeTruthy());
    expect(screen.getByText(/Budi Pratama/)).toBeTruthy();
    // KPI_DAILY muncul di ringkasan tipe sekaligus di tabel terbaru.
    expect(screen.getAllByText(/KPI_DAILY/).length).toBeGreaterThan(0);
  });

  it('menampilkan pesan gagal tanpa angka saat API gagal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      json: async () => ({ detail: 'Server mati' }),
    })));
    render(<BoardActivityPanel />);
    await waitFor(() => expect(screen.getByText(/Gagal memuat aktivitas/)).toBeTruthy());
    expect(screen.queryByText(/11 aktivitas tercatat/)).toBeNull();
  });
});

describe('BoardVisionPanel', () => {
  it('menampilkan visi, misi, capaian pilar, dan RJMP', async () => {
    render(<BoardVisionPanel />);
    await waitFor(() => expect(screen.getByText(/kelas dunia/)).toBeTruthy());
    expect(screen.getByText(/Misi satu/)).toBeTruthy();
    expect(screen.getByText(/92\.8%/)).toBeTruthy();
    expect(screen.getByText(/CORP-FIN-01/)).toBeTruthy();
    expect(screen.getByText(/Belum ada KPI/)).toBeTruthy();
  });

  it('tidak memanggil AI secara otomatis saat mount', async () => {
    const spy = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('vision-achievement')) return okJson(vision);
      return okJson({});
    });
    vi.stubGlobal('fetch', spy);

    render(<BoardVisionPanel />);
    await waitFor(() => expect(screen.getByText(/kelas dunia/)).toBeTruthy());

    const called = spy.mock.calls.some(([u]) => String(u).includes('board-analysis'));
    expect(called).toBe(false);
  });

  it('menjalankan analisis AI hanya setelah tombol ditekan', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('board-analysis')) {
        return {
          ok: true,
          json: async () => ({
            status: 'success',
            data: {
              insight: 'Ringkasan AI.',
              provider: 'groq',
              generatedAt: '2026-10-26T00:00:00.000Z',
              fromCache: false,
              configured: true,
            },
          }),
        };
      }
      if (u.includes('vision-achievement')) return okJson(vision);
      return okJson({});
    }));

    render(<BoardVisionPanel />);
    await waitFor(() => expect(screen.getByText(/kelas dunia/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Analisis AI/ }));
    await waitFor(() => expect(screen.getByText(/Ringkasan AI/)).toBeTruthy());
  });
});

describe('BoardPositionFitPanel', () => {
  it('menampilkan status kepatuhan posisi dan pegawai', async () => {
    render(<BoardPositionFitPanel />);
    // Nama posisi muncul di ringkasan posisi sekaligus di rincian pegawai.
    await waitFor(() =>
      expect(screen.getAllByText(/Senior Software Engineer/).length).toBeGreaterThan(0)
    );
    expect(screen.getByText(/PARTIAL/)).toBeTruthy();
    expect(screen.getByText(/NOT_COMPLIANT/)).toBeTruthy();
  });
});

describe('BoardCostPanel', () => {
  it('menampilkan payroll, BPJS ter-masking, lembur, dan biaya operasional', async () => {
    render(<BoardCostPanel />);
    // Periode muncul di kartu metrik sekaligus di highlight analisis.
    await waitFor(() =>
      expect(screen.getAllByText(/2026-09/).length).toBeGreaterThan(0)
    );
    // Nomor BPJS tampil di dua kolom (TK dan Kesehatan).
    expect(screen.getAllByText('••••••••••••0123').length).toBe(2);
    expect(screen.getByText(/TRAVEL/)).toBeTruthy();
    expect(screen.getByText(/2 pengajuan lembur menunggu/)).toBeTruthy();
  });

  it('tidak pernah menampilkan nomor BPJS 16 digit', async () => {
    render(<BoardCostPanel />);
    await waitFor(() =>
      expect(screen.getAllByText(/2026-09/).length).toBeGreaterThan(0)
    );
    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/\d{16}/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/board-executive.test.tsx`
Expected: FAIL — komponen belum ada.

- [ ] **Step 3: Create `BoardTabNav.tsx`**

```tsx
'use client';
import React from 'react';

export type BoardTab = 'overview' | 'activity' | 'vision' | 'position-fit' | 'cost';

export const BOARD_TABS: Array<{ key: BoardTab; label: string }> = [
  { key: 'overview', label: 'Ringkasan VMAI & BSC' },
  { key: 'activity', label: 'Aktivitas Semua Profil' },
  { key: 'vision', label: 'Visi-Misi & Analisis AI' },
  { key: 'position-fit', label: 'Kesesuaian Posisi & RJMP' },
  { key: 'cost', label: 'Payroll, BPJS & Biaya' },
];

export default function BoardTabNav({
  active,
  onChange,
}: {
  active: BoardTab;
  onChange: (tab: BoardTab) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
      {BOARD_TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
            active === tab.key
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create a shared fetch helper inside each panel**

Setiap panel memakai helper lokal yang sama (tidak membuat file util baru agar tidak menambah permukaan):

```tsx
async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
  return json;
}
```

- [ ] **Step 5: Create `BoardActivityPanel.tsx`**

```tsx
'use client';
import React, { useEffect, useState } from 'react';
import { Activity, Users, Building2 } from 'lucide-react';

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
  return json;
}

export default function BoardActivityPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchJson('/api/v1/analytics/board-activity')
      .then((json) => {
        if (active && json?.status === 'success') setData(json.data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat aktivitas...</div>;
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat aktivitas: {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Activity className="w-4 h-4 text-indigo-600" /> Total Aktivitas
          </div>
          <div className="text-2xl font-bold text-slate-800">{data?.totalEvents ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {data?.fromDate} s.d. {data?.toDate}
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Users className="w-4 h-4 text-emerald-600" /> Coverage Pegawai
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {data?.analysis?.coveragePercentage ?? 0}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            dari {data?.analysis?.activeEmployees ?? 0} pegawai aktif
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Building2 className="w-4 h-4 text-amber-600" /> Departemen Teraktif
          </div>
          <div className="text-lg font-bold text-slate-800 truncate">
            {data?.analysis?.busiestDepartment ?? '-'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {data?.analysis?.busiestEventType ?? '-'}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-xs font-semibold text-slate-700 mb-2">Temuan Analisis</h3>
        <ul className="space-y-1">
          {(data?.analysis?.highlights ?? []).map((h: string, i: number) => (
            <li key={i} className="text-[11px] text-slate-600 flex gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
              {h}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Per Tipe Event</h3>
          <ul className="space-y-1.5">
            {(data?.byEventType ?? []).map((row: any) => (
              <li key={row.eventType} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600">{row.eventType}</span>
                <span className="font-semibold text-slate-800">
                  {row.count} ({row.percentage}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Per Peran Pemilik</h3>
          <ul className="space-y-1.5">
            {(data?.byOwnerRole ?? []).map((row: any) => (
              <li key={row.role} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600">{row.role}</span>
                <span className="font-semibold text-slate-800">
                  {row.count} ({row.percentage}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-700">
          Aktivitas Terbaru
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Pegawai</th>
                <th className="p-3">Departemen</th>
                <th className="p-3">Tipe</th>
                <th className="p-3">Ringkasan</th>
                <th className="p-3">Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.recent ?? []).map((row: any) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">{row.employeeName}</td>
                  <td className="p-3">{row.departmentName}</td>
                  <td className="p-3">{row.eventType}</td>
                  <td className="p-3">{row.summary}</td>
                  <td className="p-3 text-slate-500">{String(row.occurredAt).slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `BoardAiInsight.tsx`**

```tsx
'use client';
import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

export default function BoardAiInsight({ periodCode }: { periodCode?: string }) {
  const [insight, setInsight] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ provider: string | null; generatedAt: string | null; fromCache: boolean } | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (force: boolean) => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/ai/board-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodCode, force }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.detail ?? json?.message ?? 'Gagal menjalankan analisis');
      }
      setInsight(json?.data?.insight ?? 'Tidak ada keluaran dari model.');
      setConfigured(json?.data?.configured ?? false);
      setMeta({
        provider: json?.data?.provider ?? null,
        generatedAt: json?.data?.generatedAt ?? null,
        fromCache: json?.data?.fromCache ?? false,
      });
    } catch (err) {
      setInsight((err as Error).message);
      setConfigured(false);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-indigo-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-semibold text-slate-800">Analisis AI Boardroom</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => run(false)}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Analisis AI'}
          </button>
          {insight && (
            <button
              onClick={() => run(true)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 text-[11px] font-semibold disabled:opacity-50"
            >
              Analisis ulang
            </button>
          )}
        </div>
      </div>

      {loading && (
        <p className="text-[11px] text-slate-500 inline-flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menganalisis data…
        </p>
      )}

      {!loading && insight && (
        <>
          {configured === false && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Analisis AI belum tersedia karena kunci provider belum dikonfigurasi.
            </p>
          )}
          <p className="text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap">{insight}</p>
          {meta?.generatedAt && (
            <p className="text-[10px] text-slate-400">
              {meta.fromCache ? 'Dari cache' : 'Baru dibuat'} &bull; {meta.provider ?? '-'} &bull;{' '}
              {String(meta.generatedAt).slice(0, 19).replace('T', ' ')}
            </p>
          )}
        </>
      )}

      {!loading && !insight && (
        <p className="text-[11px] text-slate-500">
          Tekan &ldquo;Analisis AI&rdquo; untuk merangkum capaian pilar, RJMP, kesesuaian posisi,
          dan aktivitas. Gaji serta data BPJS tidak pernah dikirim ke model.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Create `BoardVisionPanel.tsx`**

```tsx
'use client';
import React, { useEffect, useState } from 'react';
import { Compass, Target } from 'lucide-react';
import BoardAiInsight from './BoardAiInsight';

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
  return json;
}

const STATUS_LABEL: Record<string, string> = {
  ACHIEVED: 'Tercapai',
  BELOW_TARGET: 'Di bawah target',
  NO_DATA: 'Belum ada KPI',
};

export default function BoardVisionPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchJson('/api/v1/analytics/vision-achievement')
      .then((json) => {
        if (active && json?.status === 'success') setData(json.data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat capaian visi-misi...</div>;
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat capaian visi-misi: {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Compass className="w-6 h-6 text-emerald-700 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Visi</p>
              <p className="text-sm font-semibold text-slate-800">
                {data?.vision ?? 'Visi perusahaan belum ditetapkan.'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Misi</p>
              <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-0.5">
                {(data?.missions ?? []).map((m: string, i: number) => (
                  <li key={i}>{m}</li>
                ))}
                {(data?.missions ?? []).length === 0 && (
                  <li className="list-none text-slate-500">Misi belum ditetapkan.</li>
                )}
              </ul>
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] font-semibold text-slate-500">Capaian Keseluruhan</p>
            <p className="text-3xl font-extrabold text-emerald-700">
              {data?.overallAchievementPercentage ?? 0}%
            </p>
            <p className="text-[10px] text-slate-500">
              {data?.sampleSize ?? 0} KPI individual
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(data?.pillars ?? []).map((p: any) => (
          <div key={p.pillarId} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-xs font-semibold text-slate-800">{p.pillarName}</p>
                <p className="text-[10px] text-slate-500">
                  {p.perspective} &bull; bobot {p.strategicWeight}%
                </p>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                  p.status === 'ACHIEVED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : p.status === 'BELOW_TARGET'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.min(100, p.achievementPercentage)}%` }}
              />
            </div>
            <p className="text-[11px] font-semibold text-slate-700 mt-1">
              {p.achievementPercentage}% &bull; {p.kpiCount} KPI
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-indigo-600" /> Sasaran RJMP (diturunkan dari roll-up pilar)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Kode</th>
                <th className="p-3">Sasaran</th>
                <th className="p-3">Tahun</th>
                <th className="p-3">Target</th>
                <th className="p-3">Capaian Turunan</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.rjmp ?? []).map((r: any) => (
                <tr key={r.corporateKpiId} className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-[11px] text-slate-500">{r.kpiCode}</td>
                  <td className="p-3">{r.kpiName}</td>
                  <td className="p-3">{r.periodYear}</td>
                  <td className="p-3">
                    {r.targetValue} {r.unit}
                  </td>
                  <td className="p-3 font-semibold text-slate-800">
                    {r.derivedAchievementPercentage}%
                  </td>
                  <td className="p-3">{STATUS_LABEL[r.status] ?? r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <BoardAiInsight />
    </div>
  );
}
```

- [ ] **Step 8: Create `BoardPositionFitPanel.tsx`**

```tsx
'use client';
import React, { useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
  return json;
}

const FIT_CLASS: Record<string, string> = {
  COMPLIANT: 'bg-emerald-100 text-emerald-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  NOT_COMPLIANT: 'bg-red-100 text-red-700',
  NO_TEMPLATE: 'bg-slate-100 text-slate-600',
};

export default function BoardPositionFitPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchJson('/api/v1/analytics/position-fit')
      .then((json) => {
        if (active && json?.status === 'success') setData(json.data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat kesesuaian posisi...</div>;
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat kesesuaian posisi: {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
          <Briefcase className="w-3.5 h-3.5 text-indigo-600" /> Temuan Analisis
        </h3>
        <ul className="space-y-1">
          {(data?.analysis?.highlights ?? []).map((h: string, i: number) => (
            <li key={i} className="text-[11px] text-slate-600 flex gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
              {h}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-700">
          Ringkasan per Posisi
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Posisi</th>
                <th className="p-3">Grade</th>
                <th className="p-3">Pemegang</th>
                <th className="p-3">Patuh</th>
                <th className="p-3">Template KPI</th>
                <th className="p-3">Coverage</th>
                <th className="p-3">Capaian</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.byPosition ?? []).map((p: any) => (
                <tr key={p.positionId} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">{p.positionTitle}</td>
                  <td className="p-3">{p.jobGrade ?? '-'}</td>
                  <td className="p-3">{p.holders}</td>
                  <td className="p-3">{p.compliantHolders}</td>
                  <td className="p-3">{p.templateKpiCount}</td>
                  <td className="p-3">{p.coveragePercentage}%</td>
                  <td className="p-3">{p.achievementPercentage}%</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        FIT_CLASS[p.status] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-700">
          Rincian per Pegawai
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Pegawai</th>
                <th className="p-3">Posisi</th>
                <th className="p-3">KPI Cocok</th>
                <th className="p-3">Coverage</th>
                <th className="p-3">Capaian</th>
                <th className="p-3">GPA</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.employees ?? []).map((e: any) => (
                <tr key={e.employeeId} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">
                    {e.fullName}
                    <span className="ml-2 font-mono text-[10px] text-slate-400">{e.employeeCode}</span>
                  </td>
                  <td className="p-3">{e.positionTitle}</td>
                  <td className="p-3">
                    {e.matchedKpiCount}/{e.templateKpiCount}
                  </td>
                  <td className="p-3">{e.coveragePercentage}%</td>
                  <td className="p-3">{e.achievementPercentage}%</td>
                  <td className="p-3">{e.latestGpa ?? '-'}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        FIT_CLASS[e.status] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Create `BoardCostPanel.tsx`**

```tsx
'use client';
import React, { useEffect, useState } from 'react';
import { Wallet, ShieldCheck, Clock, Receipt } from 'lucide-react';

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
  return json;
}

const rupiah = (value: number | null | undefined) =>
  `Rp ${Number(value ?? 0).toLocaleString('id-ID')}`;

export default function BoardCostPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchJson('/api/v1/analytics/board-cost')
      .then((json) => {
        if (active && json?.status === 'success') setData(json.data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat rincian biaya...</div>;
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat rincian biaya: {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Wallet className="w-4 h-4 text-indigo-600" /> Payroll Net
          </div>
          <div className="text-lg font-bold text-slate-800">
            {rupiah(data?.payroll?.latest?.totalNet)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Periode {data?.payroll?.latest?.periodCode ?? '-'}
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 mb-1">Biaya per Pegawai</div>
          <div className="text-lg font-bold text-slate-800">
            {rupiah(data?.analysis?.costPerEmployee)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {data?.sampleSize ?? 0} pegawai
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Clock className="w-4 h-4 text-amber-600" /> Lembur
          </div>
          <div className="text-lg font-bold text-slate-800">{data?.overtime?.totalHours ?? 0} jam</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {rupiah(data?.overtime?.totalPay)}
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Receipt className="w-4 h-4 text-emerald-600" /> Biaya Operasional
          </div>
          <div className="text-lg font-bold text-slate-800">
            {rupiah(data?.operational?.totalAmount)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Konsentrasi top-decil {data?.analysis?.topDecileCostShare ?? 0}%
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-xs font-semibold text-slate-700 mb-2">Temuan Analisis</h3>
        <ul className="space-y-1">
          {(data?.analysis?.highlights ?? []).map((h: string, i: number) => (
            <li key={i} className="text-[11px] text-slate-600 flex gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
              {h}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-700">
          Rincian Payroll per Pegawai ({data?.employeesPagination?.page ?? 1}/
          {Math.max(1, Math.ceil((data?.employeesPagination?.total ?? 0) / (data?.employeesPagination?.pageSize ?? 50)))})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Pegawai</th>
                <th className="p-3">Departemen</th>
                <th className="p-3">Gaji Pokok</th>
                <th className="p-3">Tunjangan</th>
                <th className="p-3">Lembur</th>
                <th className="p-3">PPh 21</th>
                <th className="p-3">Gross</th>
                <th className="p-3">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.employees ?? []).map((e: any) => (
                <tr key={e.employeeId} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">{e.fullName}</td>
                  <td className="p-3">{e.departmentName}</td>
                  <td className="p-3">{rupiah(e.baseSalary)}</td>
                  <td className="p-3">{rupiah(e.fixedAllowance)}</td>
                  <td className="p-3">{rupiah(e.overtimePay)}</td>
                  <td className="p-3">{rupiah(e.pph21)}</td>
                  <td className="p-3">{rupiah(e.gross)}</td>
                  <td className="p-3 font-semibold text-slate-800">{rupiah(e.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Kepesertaan BPJS (nomor ter-masking)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Pegawai</th>
                <th className="p-3">BPJS TK</th>
                <th className="p-3">BPJS Kesehatan</th>
                <th className="p-3">Kelas</th>
                <th className="p-3">Status TK</th>
                <th className="p-3">Status Kes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.bpjs?.employees ?? []).map((e: any) => (
                <tr key={e.employeeId} className="hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">{e.fullName}</td>
                  <td className="p-3 font-mono text-[11px]">{e.bpjsTkNumberMasked ?? '-'}</td>
                  <td className="p-3 font-mono text-[11px]">{e.bpjsKesNumberMasked ?? '-'}</td>
                  <td className="p-3">{e.bpjsKesClass ?? '-'}</td>
                  <td className="p-3">{e.bpjsTkStatus}</td>
                  <td className="p-3">{e.bpjsKesStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Biaya Operasional per Kategori</h3>
          <ul className="space-y-1.5">
            {(data?.operational?.byCategory ?? []).map((row: any) => (
              <li key={row.category} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600">{row.category}</span>
                <span className="font-semibold text-slate-800">
                  {rupiah(row.amount)} ({row.count})
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-2">Lembur per Departemen</h3>
          <ul className="space-y-1.5">
            {(data?.overtime?.byDepartment ?? []).map((row: any) => (
              <li key={row.departmentName} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 truncate pr-2">{row.departmentName}</span>
                <span className="font-semibold text-slate-800">
                  {row.hours} jam &bull; {rupiah(row.pay)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Wire the tabs into `page.tsx`**

Di `src/app/dashboard/executive/page.tsx`:

**a. Tambahkan impor** (setelah impor `FlightRiskHeatmap`):

```tsx
import BoardTabNav, { type BoardTab } from '@/components/executive/BoardTabNav';
import BoardActivityPanel from '@/components/executive/BoardActivityPanel';
import BoardVisionPanel from '@/components/executive/BoardVisionPanel';
import BoardPositionFitPanel from '@/components/executive/BoardPositionFitPanel';
import BoardCostPanel from '@/components/executive/BoardCostPanel';
```

**b. Tambahkan helper deep-link** di atas komponen:

```tsx
/** Membaca `?tab=` agar tautan langsung membuka tab yang tepat. */
function resolveInitialTab(): BoardTab {
  if (typeof window === 'undefined') return 'overview';
  const tab = new URLSearchParams(window.location.search).get('tab');
  const valid: BoardTab[] = ['overview', 'activity', 'vision', 'position-fit', 'cost'];
  return (valid as string[]).includes(tab ?? '') ? (tab as BoardTab) : 'overview';
}
```

**c. Ganti state dan efek pemuatan** menjadi:

```tsx
  const [resolution, setResolution] = useState<'Bulanan' | 'Kuartalan' | 'Semester'>('Bulanan');
  const [scorecard, setScorecard] = useState<any>(null);
  const [openFeature, setOpenFeature] = useState<ExecFeature | null>(null);
  const [mainTab, setMainTab] = useState<BoardTab>('overview');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setMainTab(resolveInitialTab());
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch('/api/v1/analytics/vmai-scorecard');
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat scorecard');
        }
        setScorecard(json?.data ?? null);
      } catch (err) {
        setScorecard(null);
        setLoadError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);
```

**d. Hapus seluruh angka cadangan.** Ganti lima baris berikut:

```tsx
  const vmai = scorecard?.vmai_score ?? 89.4;
  const financialScore = scorecard?.balanced_scorecard_perspectives?.financial?.score ?? 92.4;
  const customerScore = scorecard?.balanced_scorecard_perspectives?.customer_stakeholder?.score ?? 87.1;
  const internalScore = scorecard?.balanced_scorecard_perspectives?.internal_business_process?.score ?? 94.8;
  const learningScore = scorecard?.balanced_scorecard_perspectives?.learning_growth?.score ?? 83.3;
```

menjadi:

```tsx
  // Tanpa angka cadangan: nilai 0 hanya berarti data belum termuat, dan
  // banner galat di bawah menjelaskan mengapa.
  const vmai = scorecard?.vmai_score ?? 0;
  const financialScore = scorecard?.balanced_scorecard_perspectives?.financial?.score ?? 0;
  const customerScore = scorecard?.balanced_scorecard_perspectives?.customer_stakeholder?.score ?? 0;
  const internalScore = scorecard?.balanced_scorecard_perspectives?.internal_business_process?.score ?? 0;
  const learningScore = scorecard?.balanced_scorecard_perspectives?.learning_growth?.score ?? 0;
```

Juga ganti `?? 4.4` pada teks ekspor menjadi `?? 0`.

**e. Sisipkan navigasi tab dan banner galat** tepat setelah blok header (setelah `</div>` penutup header, sebelum `{/* 2. Feature Card Grid (click to open) */}`):

```tsx
      <BoardTabNav active={mainTab} onChange={setMainTab} />

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          Gagal memuat scorecard eksekutif: {loadError}. Angka sengaja tidak ditampilkan agar
          tidak menyesatkan.
        </div>
      )}
```

**f. Bungkus konten lama dalam tab overview.** Tambahkan sebelum `<FeatureGrid>`:

```tsx
      {mainTab === 'overview' && !loadError && (
        <>
```

dan tutup setelah `<FlightRiskHeatmap />`:

```tsx
        </>
      )}
```

**g. Tambahkan empat panel baru** setelah penutup tab overview (sebelum footer legal):

```tsx
      {mainTab === 'activity' && <BoardActivityPanel />}
      {mainTab === 'vision' && <BoardVisionPanel />}
      {mainTab === 'position-fit' && <BoardPositionFitPanel />}
      {mainTab === 'cost' && <BoardCostPanel />}
```

- [ ] **Step 11: Run UI tests to verify they pass**

Run: `npx vitest run tests/ui/board-executive.test.tsx`
Expected: PASS (9 test).

- [ ] **Step 12: Run typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: tidak ada error.

Run: `npm run lint`
Expected: `✔ No ESLint warnings or errors`.

- [ ] **Step 13: Verify the page renders five tabs**

Run: `npx vitest run tests/unit/middleware.test.ts tests/ui/board-executive.test.tsx`
Expected: PASS — rute `/dashboard/executive` masih diizinkan untuk BOD/SUPER_ADMIN/AUDITOR/ASSESSOR.

- [ ] **Step 14: Commit**

```bash
git add src/components/executive src/app/dashboard/executive/page.tsx tests/ui/board-executive.test.tsx
git commit -m "feat(ui): lima tab Boardroom BOD dan penghapusan angka cadangan"
```

---

## Catatan Operasional untuk Pelaksana

1. **Migrasi dev:** setelah Task 1, jalankan `npm run db:migrate` lalu **restart** server dev (instance PGlite dipegang di memori; tanpa restart kolom/tabel baru tidak terlihat).
2. **Seed dev:** setelah Task 2, jalankan `npm run db:seed` agar tab Aktivitas dan Biaya tidak kosong.
3. **Jangan** menambahkan nilai baru pada `audit_logs.action_type`; CHECK constraint akan menolak.
4. **Jangan** menambah baris `individual_kpis` ke seed: `tests/integration/seed.test.ts` menegaskan jumlahnya 4 dan total bobot 100.
5. Seluruh perintah test dijalankan serial oleh Vitest (`fileParallelism: false`), jadi tidak perlu flag tambahan.

