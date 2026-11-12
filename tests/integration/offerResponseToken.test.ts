import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import {
  terbitkanTokenRespons,
  bacaTokenRespons,
  catatResponsKandidat,
} from '@/lib/services/offerResponseService';

let client: PGlite;
let db: Db;
let applicationId = '';

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;

  // Lamaran tanpa penawaran, lalu buat penawaran baru untuknya.
  const a = await client.query<{ id: string }>(
    `SELECT ja.id::text AS id FROM job_applications ja
      WHERE NOT EXISTS (SELECT 1 FROM job_offers jo WHERE jo.application_id = ja.id)
      LIMIT 1`
  );
  applicationId = a.rows[0].id;

  await client.query(
    `INSERT INTO job_offers (application_id, base_salary, response_deadline, status)
     VALUES ($1::uuid, 15000000, NOW() + INTERVAL '7 days', 'SENT')`,
    [applicationId]
  );
}, 60000);

afterAll(async () => {
  await client.close();
});

describe('token respons penawaran', () => {
  it('menerbitkan token dan bisa dibaca kembali', async () => {
    const { token } = await terbitkanTokenRespons(db, applicationId, 7);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(30);

    const hasil = await bacaTokenRespons(db, token);
    expect(hasil.valid).toBe(true);
    expect(hasil.applicationId).toBe(applicationId);
  });

  it('token tidak disimpan mentah di database', async () => {
    const { token } = await terbitkanTokenRespons(db, applicationId, 7);
    const r = await client.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM job_offers WHERE response_token_hash = $1',
      [token]
    );
    expect(r.rows[0].n, 'nilai mentah tidak boleh tersimpan').toBe(0);
  });

  it('token palsu ditolak', async () => {
    const hasil = await bacaTokenRespons(db, 'token-palsu-yang-tidak-ada-1234567890');
    expect(hasil.valid).toBe(false);
  });

  it('token kedaluwarsa ditolak', async () => {
    const { token } = await terbitkanTokenRespons(db, applicationId, -1);
    const hasil = await bacaTokenRespons(db, token);
    expect(hasil.valid).toBe(false);
    expect(hasil.alasan).toMatch(/kedaluwarsa/i);
  });

  it('kandidat menerima penawaran -> status penawaran ACCEPTED', async () => {
    const { token } = await terbitkanTokenRespons(db, applicationId, 7);
    const hasil = await catatResponsKandidat(db, token, 'ACCEPTED');
    expect(hasil.berhasil).toBe(true);

    const r = await client.query<{ status: string }>(
      'SELECT status::text AS status FROM job_offers WHERE application_id = $1::uuid',
      [applicationId]
    );
    expect(r.rows[0].status).toBe('ACCEPTED');
  });

  it('kandidat menolak -> status penawaran DECLINED dan lamaran OFFER_DECLINED', async () => {
    // Penawaran baru: tes sebelumnya sudah memakai penawaran ini (sekali pakai).
    await client.query(
      `UPDATE job_offers SET status = 'SENT', responded_at = NULL WHERE application_id = $1::uuid`,
      [applicationId]
    );
    const { token } = await terbitkanTokenRespons(db, applicationId, 7);
    const hasil = await catatResponsKandidat(db, token, 'DECLINED');
    expect(hasil.berhasil, hasil.alasan ?? '').toBe(true);

    const r = await client.query<{ status: string }>(
      'SELECT status::text AS status FROM job_offers WHERE application_id = $1::uuid',
      [applicationId]
    );
    expect(r.rows[0].status).toBe('DECLINED');

    const app = await client.query<{ status: string }>(
      'SELECT status::text AS status FROM job_applications WHERE id = $1::uuid',
      [applicationId]
    );
    expect(app.rows[0].status).toBe('OFFER_DECLINED');
  });

  it('token tidak bisa dipakai dua kali', async () => {
    const { token } = await terbitkanTokenRespons(db, applicationId, 7);
    await catatResponsKandidat(db, token, 'ACCEPTED');
    const kedua = await catatResponsKandidat(db, token, 'DECLINED');
    expect(kedua.berhasil).toBe(false);
  });
});
