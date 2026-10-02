import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import { NextRequest } from 'next/server';
import { POST as apply } from '@/app/api/v1/careers/apply/route';
import { GET as getTimeline } from '@/app/api/v1/careers/timeline/[applicationNo]/route';

function timelineReq(applicationNo: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/v1/careers/timeline/${applicationNo}`, { method: 'GET' });
}
function applyReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/v1/careers/apply', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

const CV = `Sari Dewi
sari.dewi@example.com | 0812-5555-6666
RINGKASAN
Analis data dengan pengalaman 3 tahun menggunakan SQL dan Power BI untuk pelaporan bisnis.

PENGALAMAN KERJA
Data Analyst | PT Data Prima | Mar 2022 - Sekarang
Membangun dasbor Power BI dan kueri SQL.

PENDIDIKAN
S1 Statistika, Universitas Brawijaya, 2017 - 2021, IPK 3.40

KEAHLIAN
SQL, Power BI, Excel, Analisis Data, Komunikasi
`;

describe('WS-5 endpoint timeline', () => {
  let client: PGlite;
  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    await client.exec(`UPDATE job_postings SET is_public = TRUE, status = 'OPEN' WHERE id IN (SELECT id FROM job_postings LIMIT 3);`);
  });
  afterAll(async () => { await client.close(); });

  it('GET timeline mengembalikan 7 tahap untuk lamaran yang baru dikirim', async () => {
    const q = await client.query<{ id: string }>(`SELECT id FROM job_postings WHERE is_public = TRUE LIMIT 1`);
    const applyRes = await apply(applyReq({
      fullName: 'Sari Dewi', email: 'sari.dewi@example.com', jobPostingId: q.rows[0].id,
      resumeText: CV, resumeFileName: 'cv-sari.txt',
    }));
    expect(applyRes.status).toBe(200);
    const applicationNo = (await applyRes.json()).data.applicationNo as string;

    const res = await getTimeline(timelineReq(applicationNo), { params: { applicationNo } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.entries.length).toBe(7);
    // APPLIED otomatis tercatat saat apply.
    const applied = json.data.entries.find((e: any) => e.stage === 'APPLIED');
    expect(applied.state).toBe('DONE');
    // ATS_REVIEW tercatat karena resumeText dianalisis.
    const ats = json.data.entries.find((e: any) => e.stage === 'ATS_REVIEW');
    expect(ats.status).toBe('PASSED');
  });

  it('GET timeline nomor tak dikenal → 404', async () => {
    const res = await getTimeline(timelineReq('APP-99999999-ZZZZZ'), { params: { applicationNo: 'APP-99999999-ZZZZZ' } });
    expect(res.status).toBe(404);
  });
});
