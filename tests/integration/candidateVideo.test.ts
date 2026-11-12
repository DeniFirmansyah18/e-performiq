import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import {
  simpanVideoKandidat,
  ambilVideoKandidat,
  hapusVideoJikaStatusFinal,
} from '@/lib/services/candidateVideoService';

let client: PGlite;
let db: Db;

// Kandidat dari seed rekrutmen.
let candidateId = '';
let applicationId = '';

async function statusLamaran(status: string) {
  await client.query('UPDATE job_applications SET status = $1 WHERE id = $2::uuid', [status, applicationId]);
}

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;

  const c = await client.query<{ id: string }>('SELECT id FROM candidates LIMIT 1');
  candidateId = c.rows[0]?.id ?? '';
  const a = await client.query<{ id: string }>(
    `INSERT INTO job_applications (candidate_id, job_posting_id, application_no, status)
     VALUES ($1::uuid, '87000000-0000-4000-8000-000000000001', 'APP-VIDEO-1', 'SUBMITTED')
     RETURNING id`,
    [candidateId]
  );
  applicationId = a.rows[0].id;
}, 60000);

afterAll(async () => {
  await client.close();
});

describe('video perkenalan kandidat', () => {
  it('menyimpan metadata video dan bisa dibaca kembali', async () => {
    const v = await simpanVideoKandidat(db, {
      candidateId,
      applicationId,
      storageKey: 'candidates/videos/uji-1.mp4',
      fileName: 'perkenalan.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 1024,
      durationSeconds: 42,
    });
    expect(v.id).toBeTruthy();

    const daftar = await ambilVideoKandidat(db, candidateId);
    expect(daftar.length).toBe(1);
    expect(daftar[0].fileName).toBe('perkenalan.mp4');
    expect(daftar[0].sizeBytes).toBe(1024);
    expect(daftar[0].durationSeconds).toBe(42);
  });

  it('tidak menghapus video selama status belum final', async () => {
    for (const s of ['SUBMITTED', 'SCREENING', 'INTERVIEW', 'OFFERED']) {
      await statusLamaran(s);
      const hasil = await hapusVideoJikaStatusFinal(db, applicationId, s);
      expect(hasil.dihapus, `status ${s} tidak boleh menghapus`).toBe(0);
      const sisa = await ambilVideoKandidat(db, candidateId);
      expect(sisa.length, `video harus tetap ada saat ${s}`).toBeGreaterThan(0);
    }
  });

  it('menghapus video saat status HIRED (diterima)', async () => {
    await statusLamaran('HIRED');
    const hasil = await hapusVideoJikaStatusFinal(db, applicationId, 'HIRED');
    expect(hasil.dihapus).toBeGreaterThan(0);
    expect(hasil.storageKeys.length).toBeGreaterThan(0);

    const sisa = await ambilVideoKandidat(db, candidateId);
    expect(sisa.length).toBe(0);
  });

  it('menghapus video saat status REJECTED (ditolak)', async () => {
    await simpanVideoKandidat(db, {
      candidateId,
      applicationId,
      storageKey: 'candidates/videos/uji-2.mp4',
      fileName: 'perkenalan-2.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 2048,
      durationSeconds: 60,
    });
    await statusLamaran('REJECTED');
    const hasil = await hapusVideoJikaStatusFinal(db, applicationId, 'REJECTED');
    expect(hasil.dihapus).toBe(1);
    expect(await ambilVideoKandidat(db, candidateId)).toEqual([]);
  });

  it('tidak error bila dipanggil saat tidak ada video', async () => {
    const hasil = await hapusVideoJikaStatusFinal(db, applicationId, 'HIRED');
    expect(hasil.dihapus).toBe(0);
    expect(hasil.storageKeys).toEqual([]);
  });
});
