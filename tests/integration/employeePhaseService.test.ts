import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  getEmployeePhase,
  changeEmployeePhase,
  syncEmployeePhase,
  listByPhase,
  listPhaseHistory,
  canTransition,
} from '@/lib/services/employeePhaseService';
import { getMyLifecycleProfile } from '@/lib/services/employeeProfileService';
import type { Db } from '@/lib/db/client';

const BUDI = 'b0000000-0000-4000-8000-000000000004';
const HR_USER = 'e0000000-0000-4000-8000-000000000002';

async function countPhaseHistory(client: PGlite, employeeId: string): Promise<number> {
  const res = await client.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM employee_phase_history WHERE employee_id = $1`,
    [employeeId],
  );
  return Number(res.rows[0].c);
}

async function setPhase(client: PGlite, employeeId: string, phase: string) {
  await client.query(`UPDATE employees SET employee_phase = $1::employee_phase_enum WHERE id = $2`, [
    phase,
    employeeId,
  ]);
}

describe('employeePhaseService', () => {
  let client: PGlite;
  let db: Db;

  beforeAll(async () => {
    ({ client } = await createTestDb());
    await runSeed(client);
    db = drizzle(client) as unknown as Db;
  });

  afterAll(async () => {
    await client.close();
  });

  it('membaca fase karyawan beserta riwayatnya', async () => {
    const row = await getEmployeePhase(db, BUDI);
    expect(row).not.toBeNull();
    expect(row!.fullName).toBeTruthy();
    expect(['PRE', 'DURING', 'POST']).toContain(row!.phase);
    expect(Array.isArray(row!.history)).toBe(true);
  });

  it('mengembalikan null untuk karyawan yang tidak ada', async () => {
    const row = await getEmployeePhase(db, '00000000-0000-4000-8000-000000000000');
    expect(row).toBeNull();
  });

  it('canTransition hanya mengizinkan PRE → DURING → POST', () => {
    expect(canTransition('PRE', 'DURING')).toBe(true);
    expect(canTransition('DURING', 'POST')).toBe(true);
    expect(canTransition('PRE', 'POST')).toBe(false);
    expect(canTransition('POST', 'PRE')).toBe(false);
    expect(canTransition('DURING', 'PRE')).toBe(false);
  });

  it('mencatat transisi PRE → DURING ke riwayat', async () => {
    await setPhase(client, BUDI, 'PRE');
    const before = await countPhaseHistory(client, BUDI);

    const after = await changeEmployeePhase(db, {
      employeeId: BUDI,
      newPhase: 'DURING',
      effectiveDate: '2025-01-31',
      reason: 'Masa percobaan lulus dan orientasi tuntas.',
      decidedBy: HR_USER,
    });

    expect(after.phase).toBe('DURING');
    expect(await countPhaseHistory(client, BUDI)).toBe(before + 1);

    const history = after.history ?? [];
    expect(history[0]).toMatchObject({
      previousPhase: 'PRE',
      newPhase: 'DURING',
      // PGlite mengembalikan kolom DATE sebagai string ISO.
      reason: 'Masa percobaan lulus dan orientasi tuntas.',
    });
    expect(String(history[0].effectiveDate).slice(0, 10)).toBe('2025-01-31');
  });

  it('menolak alasan kurang dari 5 karakter', async () => {
    await expect(
      changeEmployeePhase(db, {
        employeeId: BUDI,
        newPhase: 'POST',
        effectiveDate: '2025-02-01',
        reason: 'ok',
        decidedBy: HR_USER,
      }),
    ).rejects.toThrow(/minimal 5 karakter/i);
  });

  it('menolak perubahan tanpa perubahan fase (no-op)', async () => {
    await setPhase(client, BUDI, 'DURING');
    await expect(
      changeEmployeePhase(db, {
        employeeId: BUDI,
        newPhase: 'DURING',
        effectiveDate: '2025-02-01',
        reason: 'Mencoba mencatat fase yang sama.',
        decidedBy: HR_USER,
      }),
    ).rejects.toThrow(/tidak ada perubahan/i);
  });

  it('menolak lompatan fase PRE → POST tanpa koreksi', async () => {
    await setPhase(client, BUDI, 'PRE');
    await expect(
      changeEmployeePhase(db, {
        employeeId: BUDI,
        newPhase: 'POST',
        effectiveDate: '2025-02-01',
        reason: 'Mencoba melompati fase Saat Kerja.',
        decidedBy: HR_USER,
      }),
    ).rejects.toThrow(/tidak sah/i);
  });

  it('mengizinkan koreksi fase mundur dengan flag allowCorrection', async () => {
    await setPhase(client, BUDI, 'POST');
    const after = await changeEmployeePhase(db, {
      employeeId: BUDI,
      newPhase: 'DURING',
      effectiveDate: '2025-02-02',
      reason: 'Koreksi: offboarding dibatalkan.',
      decidedBy: HR_USER,
      allowCorrection: true,
    });
    expect(after.phase).toBe('DURING');
  });

  // Regresi: nama pemutus diambil dari employees.full_name lewat users.employee_id,
  // bukan users.full_name (kolom itu tidak ada → error 42703).
  it('listPhaseHistory menyertakan nama pemutus dari tabel employees', async () => {
    const history = await listPhaseHistory(db, BUDI);
    expect(history.length).toBeGreaterThan(0);

    const withDecider = history.find((h) => h.decidedByName);
    expect(withDecider).toBeTruthy();
    expect(String(withDecider!.decidedByName)).toMatch(/Siti Nurhaliza/);
  });

  it('koreksi tidak boleh melompati fase ke depan', async () => {
    await setPhase(client, BUDI, 'PRE');
    await expect(
      changeEmployeePhase(db, {
        employeeId: BUDI,
        newPhase: 'POST',
        effectiveDate: '2025-02-03',
        reason: 'Koreksi ke fase akhir.',
        decidedBy: HR_USER,
        allowCorrection: true,
      }),
    ).rejects.toThrow(/Koreksi fase hanya untuk memundurkan/i);
  });

  it('syncEmployeePhase idempoten dan mencatat transisi hanya sekali', async () => {
    await setPhase(client, BUDI, 'PRE');
    const before = await countPhaseHistory(client, BUDI);

    await syncEmployeePhase(db, {
      employeeId: BUDI,
      targetPhase: 'DURING',
      effectiveDate: '2025-03-01',
      reason: 'Hook otomatis: orientasi tuntas.',
    });
    await syncEmployeePhase(db, {
      employeeId: BUDI,
      targetPhase: 'DURING',
      effectiveDate: '2025-03-01',
      reason: 'Hook otomatis: orientasi tuntas.',
    });

    expect(await countPhaseHistory(client, BUDI)).toBe(before + 1);
    const row = await getEmployeePhase(db, BUDI);
    expect(row!.phase).toBe('DURING');
  });

  it('syncEmployeePhase mengabaikan target yang bukan transisi sah', async () => {
    await setPhase(client, BUDI, 'POST');
    const before = await countPhaseHistory(client, BUDI);
    const phase = await syncEmployeePhase(db, {
      employeeId: BUDI,
      targetPhase: 'PRE',
      effectiveDate: '2025-03-02',
      reason: 'Hook otomatis tidak boleh mundur.',
    });
    expect(phase).toBe('POST');
    expect(await countPhaseHistory(client, BUDI)).toBe(before);
  });

  it('listByPhase memfilter karyawan per fase', async () => {
    await setPhase(client, BUDI, 'DURING');
    const during = await listByPhase(db, 'DURING');
    expect(during.some((r) => r.employeeId === BUDI)).toBe(true);
    expect(during.every((r) => r.phase === 'DURING')).toBe(true);

    const all = await listByPhase(db);
    expect(all.length).toBeGreaterThanOrEqual(during.length);
  });

  it('kolom employee_phase menjadi acuan getMyLifecycleProfile', async () => {
    await setPhase(client, BUDI, 'POST');
    const profile = await getMyLifecycleProfile(db, BUDI);
    expect(profile!.phase).toBe('POST');
  });
});
