import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { isiOtotomatisBerkasDariKandidat, dataTerisiDariKandidat } from '@/lib/services/documentAutoFill';
import { getDetailPegawai, bolehLihatPegawai } from '@/lib/services/employeeDetailService';
import type { SessionPayload } from '@/lib/auth/session';

let client: PGlite;
let db: Db;
let candidateId = '';
let employeeId = '';
const EMAIL = 'uji.berkas@example.com';

const DANU = 'b0000000-0000-4000-8000-000000000003'; // PEOPLE_MANAGER
const HENDRA = 'b0000000-0000-4000-8000-000000000001'; // BOD
const SITI = 'b0000000-0000-4000-8000-000000000002'; // HR_MANAGER
const BUDI = 'b0000000-0000-4000-8000-000000000004'; // EMPLOYEE

function sesi(employeeId: string, role: any): SessionPayload {
  return { userId: `u-${employeeId.slice(-4)}`, employeeId, role, email: 'x@x.id' } as SessionPayload;
}

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);
  db = drizzle(client) as unknown as Db;

  // Kandidat dengan dokumen hasil lamaran.
  const c = await client.query<{ id: string }>(
    `INSERT INTO candidates (full_name, email, phone, education)
     VALUES ('Kandidat Berkas', $1, '0812', 'S1') RETURNING id::text AS id`,
    [EMAIL]
  );
  candidateId = c.rows[0].id;
  for (const t of ['CV', 'KTP', 'IJAZAH']) {
    await client.query(
      `INSERT INTO candidate_documents (candidate_id, doc_type, file_name, file_url)
       VALUES ($1::uuid, $2, $3, $4)`,
      [candidateId, t, `${t}.pdf`, `https://contoh.id/${t}.pdf`]
    );
  }

  // Pegawai hasil konversi.
  const e = await client.query<{ id: string }>(
    `INSERT INTO employees (employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
     VALUES ('UJI-BERKAS-01', 'Kandidat Berkas', $1,
             'a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000204',
             'PERMANENT', 20000000, CURRENT_DATE)
     RETURNING id::text AS id`,
    [EMAIL]
  );
  employeeId = e.rows[0].id;
}, 60000);

afterAll(async () => {
  await client.close();
});

describe('berkas kepegawaian terisi otomatis dari data kandidat', () => {
  it('memindahkan CV, KTP, dan Ijazah yang diunggah kandidat', async () => {
    const hasil = await isiOtotomatisBerkasDariKandidat(db, { employeeId, candidateId });
    expect(hasil.dipindahkan).toBe(3);
    expect(hasil.jenis.sort()).toEqual(['CV', 'IJAZAH', 'KTP']);

    const d = await client.query<{ document_type: string }>(
      'SELECT document_type FROM employee_documents WHERE employee_id = $1::uuid ORDER BY document_type',
      [employeeId]
    );
    expect(d.rows.map((x) => x.document_type)).toEqual(['CV', 'IJAZAH', 'KTP']);
  });

  it('idempoten: menjalankan ulang tidak menggandakan berkas', async () => {
    const hasil = await isiOtotomatisBerkasDariKandidat(db, { employeeId, candidateId });
    expect(hasil.dipindahkan).toBe(0);
    const n = await client.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM employee_documents WHERE employee_id = $1::uuid',
      [employeeId]
    );
    expect(n.rows[0].n).toBe(3);
  });

  it('melaporkan data pribadi mana yang terisi dari lamaran', async () => {
    const d = await dataTerisiDariKandidat(db, { employeeEmail: EMAIL });
    expect(d.nama).toBe(true);
    expect(d.email).toBe(true);
    expect(d.telepon).toBe(true);
    expect(d.pendidikan).toBe(true);
    expect(d.berkas).toEqual(expect.arrayContaining(['CV', 'KTP', 'IJAZAH']));
  });
});

describe('berkas terintegrasi untuk semua peran', () => {
  it('HR melihat berkas + kelengkapan pada detail pegawai', async () => {
    const d: any = await getDetailPegawai(db, sesi(SITI, 'HR_MANAGER'), employeeId);
    expect(d.dokumen.length).toBe(3);
    expect(d.kelengkapanBerkas).toBeTruthy();
    expect(d.kelengkapanBerkas.teksKelengkapan).toMatch(/^Berkas wajib: \d+ dari \d+ lengkap$/);
    // CV bukan berkas wajib → terhitung 2 dari 9 (KTP + IJAZAH).
    expect(d.kelengkapanBerkas.jumlahLengkap).toBe(2);
  });

  it('BOD melihat data yang sama', async () => {
    const d: any = await getDetailPegawai(db, sesi(HENDRA, 'BOD'), employeeId);
    expect(d.kelengkapanBerkas.jumlahLengkap).toBe(2);
  });

  it('People Manager melihat bawahan langsungnya', async () => {
    // Jadikan pegawai ini bawahan Danu agar sesuai aturan lingkup.
    await client.query('UPDATE employees SET manager_id = $1::uuid WHERE id = $2::uuid', [DANU, employeeId]);
    const d: any = await getDetailPegawai(db, sesi(DANU, 'PEOPLE_MANAGER'), employeeId);
    expect(d.kelengkapanBerkas.jumlahLengkap).toBe(2);
  });

  it('pegawai dapat melihat data dirinya sendiri', async () => {
    expect(await bolehLihatPegawai(db, sesi(BUDI, 'EMPLOYEE'), BUDI)).toBe(true);
    expect(await bolehLihatPegawai(db, sesi(BUDI, 'EMPLOYEE'), employeeId)).toBe(false);
  });
});

describe('peringatan kedaluwarsa dokumen', () => {
  it('dokumen kedaluwarsa muncul pada ringkasan detail pegawai', async () => {
    await client.query(
      `INSERT INTO employee_documents (employee_id, document_type, file_url, expiry_date, verification_status)
       VALUES ($1::uuid, 'PKWT', 'https://contoh.id/pkwt.pdf', '2020-01-31', 'VERIFIED')`,
      [employeeId]
    );
    const d: any = await getDetailPegawai(db, sesi(SITI, 'HR_MANAGER'), employeeId);
    expect(d.kelengkapanBerkas.kedaluwarsa.map((x: any) => x.kode)).toContain('PKWT');
  });
});
