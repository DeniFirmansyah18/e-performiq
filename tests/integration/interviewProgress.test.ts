import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { syncApplicationTimeline, getTimelineByApplicationNo } from '@/lib/services/timelineService';

let client: PGlite;
let db: Db;
let appId = '';
let appNo = '';

/** Kembalikan lamaran ke kondisi awal: INTERVIEW, jadwal SCHEDULED, tes lulus. */
async function siapkanTahapWawancara() {
  await client.query(
    `DELETE FROM application_timeline WHERE application_id = $1::uuid`,
    [appId]
  );
  await client.query(
    `DELETE FROM interview_schedules WHERE application_id = $1::uuid`,
    [appId]
  );
  await client.query(
    `UPDATE job_applications SET status = 'INTERVIEW'::application_status_enum WHERE id = $1::uuid`,
    [appId]
  );
  await client.query(
    `INSERT INTO interview_schedules (application_id, scheduled_at, status)
     VALUES ($1::uuid, NOW() + INTERVAL '1 day', 'SCHEDULED')`,
    [appId]
  );
  // Kandidat yang sudah diwawancarai pasti melewati psikotes & teknis.
  for (const stage of ['PSYCHOMETRIC', 'TECHNICAL']) {
    await client.query(
      `INSERT INTO application_timeline (application_id, stage, status, note)
       VALUES ($1::uuid, $2::timeline_stage_enum, 'PASSED', 'Lolos seleksi tahap ini')
       ON CONFLICT (application_id, stage) DO UPDATE SET status = 'PASSED'`,
      [appId, stage]
    );
  }
}

async function stateTahap(): Promise<Record<string, string>> {
  const view: any = await getTimelineByApplicationNo(db, appNo);
  const map: Record<string, string> = {};
  for (const e of view?.entries ?? []) map[e.stage] = e.state;
  return map;
}

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;

  const a = await client.query<{ id: string; application_no: string }>(
    'SELECT id::text AS id, application_no FROM job_applications LIMIT 1'
  );
  appId = a.rows[0].id;
  appNo = a.rows[0].application_no;
}, 60000);

afterAll(async () => {
  await client.close();
});

describe('progres wawancara mengikuti "tandai selesai"', () => {
  it('sebelum ditandai selesai: wawancara berjalan', async () => {
    await siapkanTahapWawancara();
    await syncApplicationTimeline(db, appId);
    const s = await stateTahap();
    expect(s.INTERVIEW).toBe('CURRENT');
  });

  it('setelah jadwal ditandai DONE: wawancara SELESAI, keputusan akhir menunggu', async () => {
    await siapkanTahapWawancara();
    await client.query(
      `UPDATE interview_schedules SET status = 'DONE' WHERE application_id = $1::uuid`,
      [appId]
    );
    await syncApplicationTimeline(db, appId);

    const s = await stateTahap();
    // Inti perbaikan: status lamaran masih INTERVIEW, tetapi wawancara sudah
    // ditandai selesai sehingga tampil DONE — bukan "Sedang Berjalan".
    expect(s.INTERVIEW, 'wawancara harus selesai').toBe('DONE');
    expect(s.DECISION, 'keputusan akhir menunggu').toBe('CURRENT');
  });

  it('kandidat menerima penawaran (HIRED): keputusan akhir selesai', async () => {
    await siapkanTahapWawancara();
    await client.query(`UPDATE interview_schedules SET status = 'DONE' WHERE application_id = $1::uuid`, [appId]);
    await client.query(
      `UPDATE job_applications SET status = 'HIRED'::application_status_enum WHERE id = $1::uuid`,
      [appId]
    );
    await syncApplicationTimeline(db, appId);

    const s = await stateTahap();
    // DECISION sudah PASSED. buildTimelineView sengaja menjadikan tahap TERAKHIR
    // sebagai CURRENT (kandidat sudah di ujung proses), jadi yang diuji adalah
    // statusnya PASSED — bukan state visualnya.
    const view: any = await getTimelineByApplicationNo(db, appNo);
    const decision = (view?.entries ?? []).find((e: any) => e.stage === 'DECISION');
    expect(decision?.status).toBe('PASSED');
    expect(s.INTERVIEW, 'wawancara tetap selesai').toBe('DONE');
  });

  it('kandidat menolak penawaran (OFFER_DECLINED): keputusan akhir ditolak', async () => {
    await siapkanTahapWawancara();
    await client.query(`UPDATE interview_schedules SET status = 'DONE' WHERE application_id = $1::uuid`, [appId]);
    await client.query(
      `UPDATE job_applications SET status = 'OFFER_DECLINED'::application_status_enum WHERE id = $1::uuid`,
      [appId]
    );
    await syncApplicationTimeline(db, appId);

    const s = await stateTahap();
    expect(s.DECISION).toBe('FAILED');
  });

  it('tidak ada tahap review HR pada timeline', async () => {
    await siapkanTahapWawancara();
    await syncApplicationTimeline(db, appId);
    const s = await stateTahap();
    expect(Object.keys(s)).not.toContain('HR_REVIEW');
  });
});
