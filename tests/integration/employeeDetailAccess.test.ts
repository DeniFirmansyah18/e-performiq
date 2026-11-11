import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import type { Db } from '@/lib/db/client';
import { bolehLihatPegawai } from '@/lib/services/employeeDetailService';

// Karyawan seed yang dipakai:
//   b..0001 Hendra (BOD, Dewan Direksi)
//   b..0002 Siti   (HR, atasan = Hendra)
//   b..0003 Danu   (People Manager, atasan = Hendra)
//   b..0004 Budi   (Employee, atasan = Danu)
const HENDRA = 'b0000000-0000-4000-8000-000000000001';
const SITI = 'b0000000-0000-4000-8000-000000000002';
const DANU = 'b0000000-0000-4000-8000-000000000003';
const BUDI = 'b0000000-0000-4000-8000-000000000004';
const RINA = 'b0000000-0000-4000-8000-000000000006';

const sesi = (role: string, employeeId: string) =>
  ({ userId: 'x', employeeId, role, email: 'x@y.z' }) as any;

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

describe('aturan akses halaman detail pegawai', () => {
  it('HR dapat melihat semua pegawai', async () => {
    for (const target of [HENDRA, DANU, BUDI, RINA]) {
      expect(await bolehLihatPegawai(db, sesi('HR_MANAGER', SITI), target)).toBe(true);
    }
  });

  it('BOD dapat melihat semua pegawai', async () => {
    for (const target of [SITI, DANU, BUDI]) {
      expect(await bolehLihatPegawai(db, sesi('BOD', HENDRA), target)).toBe(true);
    }
  });

  it('Super Admin dapat melihat semua pegawai', async () => {
    expect(await bolehLihatPegawai(db, sesi('SUPER_ADMIN', RINA), BUDI)).toBe(true);
  });

  it('People Manager hanya bawahan langsung dan dirinya sendiri', async () => {
    expect(await bolehLihatPegawai(db, sesi('PEOPLE_MANAGER', DANU), BUDI)).toBe(true);
    expect(await bolehLihatPegawai(db, sesi('PEOPLE_MANAGER', DANU), DANU)).toBe(true);
    // Bukan bawahannya:
    expect(await bolehLihatPegawai(db, sesi('PEOPLE_MANAGER', DANU), SITI)).toBe(false);
    expect(await bolehLihatPegawai(db, sesi('PEOPLE_MANAGER', DANU), RINA)).toBe(false);
  });

  it('Employee hanya dirinya sendiri', async () => {
    expect(await bolehLihatPegawai(db, sesi('EMPLOYEE', BUDI), BUDI)).toBe(true);
    expect(await bolehLihatPegawai(db, sesi('EMPLOYEE', BUDI), DANU)).toBe(false);
    expect(await bolehLihatPegawai(db, sesi('EMPLOYEE', BUDI), SITI)).toBe(false);
  });

  it('tanpa employeeId pada sesi ditolak', async () => {
    expect(await bolehLihatPegawai(db, sesi('HR_MANAGER', ''), BUDI)).toBe(false);
  });
});
