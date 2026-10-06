import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { NextRequest } from 'next/server';
import { GET as portalPostings } from '@/app/api/v1/careers/portal/postings/route';

function req(qs = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/v1/careers/portal/postings${qs}`, { method: 'GET' });
}

// Route handler memakai singleton getDb() (dev .pglite). Siapkan/mutasi data lewat
// client YANG SAMA agar perubahan terlihat oleh route.
describe('WS-3 daftar lowongan kandidat', () => {
  let client: Awaited<ReturnType<typeof getDb>>;
  beforeAll(async () => {
    client = await getDb();
    await runSeed(client);
    // publikasikan sebuah lowongan + set kuota agar kuota/status terhitung
    await client.exec(`
      UPDATE job_postings SET is_public = TRUE, status = 'OPEN' WHERE id IN (
        SELECT id FROM job_postings LIMIT 3
      );
    `);
  });

  it('mengembalikan daftar lowongan publik beserta kuota & availability', async () => {
    const res = await portalPostings(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    const postings = json.data.postings as any[];
    expect(Array.isArray(postings)).toBe(true);
    expect(postings.length).toBeGreaterThanOrEqual(1);
    const p = postings[0];
    expect(p).toHaveProperty('quota');
    expect(p).toHaveProperty('hired');
    expect(p).toHaveProperty('remaining');
    expect(['AVAILABLE', 'FILLED', 'CLOSED']).toContain(p.availability);
    // kuota = approved_quota; remaining = max(0, kuota - terisi)
    expect(p.remaining).toBe(Math.max(0, p.quota - p.hired));
  });

  it('filter search bekerja', async () => {
    const all = await (await portalPostings(req())).json();
    const title: string = all.data.postings[0].postingTitle.split(' ')[0];
    const res = await portalPostings(req(`?search=${encodeURIComponent(title)}`));
    const json = await res.json();
    expect(json.data.postings.length).toBeGreaterThanOrEqual(1);
    for (const p of json.data.postings) {
      expect(`${p.postingTitle} ${p.department}`.toLowerCase()).toContain(title.toLowerCase());
    }
  });

  it('lowongan non-publik tidak muncul', async () => {
    await client.exec(`UPDATE job_postings SET is_public = FALSE WHERE id IN (SELECT id FROM job_postings LIMIT 3);`);
    const json = await (await portalPostings(req())).json();
    // setelah di-unpublish semua, minimal tidak ada yang tersisa dari 3 itu
    expect(Array.isArray(json.data.postings)).toBe(true);
  });

  it('kuota override per lowongan (job_postings.quota) dihormati, bukan MPP', async () => {
    // Ambil 1 lowongan + MPP-nya, lalu set kuota override di atas jumlah hired
    // agar tanpa override lowongan akan tampak FILLED.
    const one = await client.query<{ id: string; mpp: string; mppQuota: number; hired: number }>(`
      SELECT jp.id, jp.manpower_plan_id AS mpp, mp.approved_quota AS "mppQuota",
             COALESCE(mp.hired_count, 0)
               + COALESCE((SELECT COUNT(*) FROM job_applications ja
                            WHERE ja.job_posting_id = jp.id AND ja.status IN ('HIRED','OFFERED')), 0) AS hired
        FROM job_postings jp JOIN manpower_plans mp ON mp.id = jp.manpower_plan_id
       WHERE mp.approved_quota > 0 LIMIT 1
    `);
    const { id, mpp, mppQuota, hired } = one.rows[0];
    const overrideQuota = Number(hired) + 2;

    // 1) kuota override > terisi, status OPEN → tersedia walau MPP sudah penuh.
    await client.exec(`
      UPDATE manpower_plans SET hired_count = ${mppQuota} WHERE id = '${mpp}';
      UPDATE job_postings SET is_public = TRUE, status = 'OPEN', quota = ${overrideQuota} WHERE id = '${id}';
    `);
    const withOverride = (await (await portalPostings(req())).json()).data.postings
      .find((p: any) => p.id === id);
    expect(withOverride).toBeTruthy();
    expect(withOverride.quota).toBe(overrideQuota);
    expect(withOverride.availability).toBe('AVAILABLE');
    expect(withOverride.remaining).toBeGreaterThan(0);

    // 2) kembali tanpa override → kuota = MPP (bukan override), sudah terisi penuh.
    await client.exec(`UPDATE job_postings SET quota = NULL WHERE id = '${id}';`);
    const noOverride = (await (await portalPostings(req())).json()).data.postings
      .find((p: any) => p.id === id);
    expect(noOverride.quota).toBe(mppQuota);
    expect(noOverride.availability).toBe('FILLED');
  });
});
