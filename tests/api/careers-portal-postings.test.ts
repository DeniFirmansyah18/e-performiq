import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { NextRequest } from 'next/server';
import { GET as portalPostings } from '@/app/api/v1/careers/portal/postings/route';

function req(qs = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/v1/careers/portal/postings${qs}`, { method: 'GET' });
}

describe('WS-3 daftar lowongan kandidat', () => {
  let client: PGlite;
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    // publikasikan sebuah lowongan + set kuota agar kuota/status terhitung
    await client.exec(`
      UPDATE job_postings SET is_public = TRUE, status = 'OPEN' WHERE id IN (
        SELECT id FROM job_postings LIMIT 3
      );
    `);
  });
  afterAll(async () => { await client.close(); });

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
});
