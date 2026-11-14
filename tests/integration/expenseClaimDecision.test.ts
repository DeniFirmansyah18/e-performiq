import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from '../setup';
import { runSeed } from '@/lib/db/seed';
import {
  submitExpenseClaim,
  listExpenseClaimsForHr,
  decideExpenseClaim,
} from '@/lib/services/payrollFinanceService';

/**
 * Keputusan klaim reimbursement oleh HR (#5).
 *
 * Service menerima koneksi injeksi agar pengujian memakai DB tes ini, bukan
 * koneksi global aplikasi (yang pada tes terpisah dan bisa kosong).
 */
let client: PGlite;

// Id diambil dari seed lewat KODE karyawan — stabil antar lingkungan.
let BUDI = '';
let SITI_USER = '';
let BUDI_USER = '';

beforeAll(async () => {
  ({ client } = await createTestDb());
  await runSeed(client);

  const budi = await client.query<{ eid: string; uid: string }>(
    `SELECT e.id::text AS eid, u.id::text AS uid
       FROM users u JOIN employees e ON e.id = u.employee_id
      WHERE e.employee_code = 'EMP-2022-0042' LIMIT 1`
  );
  BUDI = budi.rows[0].eid;
  BUDI_USER = budi.rows[0].uid;

  const siti = await client.query<{ uid: string }>(
    `SELECT u.id::text AS uid
       FROM users u JOIN employees e ON e.id = u.employee_id
      WHERE e.employee_code = 'HRM-2018-0002' LIMIT 1`
  );
  SITI_USER = siti.rows[0].uid;
}, 60000);

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await client.query('DELETE FROM expense_claims WHERE employee_id = $1::uuid', [BUDI]);
});

/** Ajukan satu klaim lalu kembalikan id-nya. */
async function klaimBaru(amount = 900000): Promise<string> {
  const hasil: any = await submitExpenseClaim(
    {
      employeeId: BUDI,
      claimCategory: 'MEDICAL',
      amount,
      receiptUrl: 'https://contoh.id/struk.jpg',
      claimDate: '2026-11-01',
    },
    client
  );
  return hasil.id;
}

describe('HR memutuskan klaim reimbursement', () => {
  it('menyetujui klaim: status APPROVED, pemutus & waktu tercatat', async () => {
    const id = await klaimBaru();
    const hasil = await decideExpenseClaim({
      claimId: id,
      keputusan: 'APPROVED',
      decidedByUserId: SITI_USER,
      peran: 'HR_MANAGER',
      dbInjeksi: client,
    });
    expect(hasil.status).toBe('APPROVED');
    expect(hasil.decidedByName).toBeTruthy();
    expect(hasil.processedAt).toBeTruthy();
    expect(hasil.approvedAmount).toBe(900000);
  });

  it('menolak klaim tanpa alasan harus gagal', async () => {
    const id = await klaimBaru();
    await expect(
      decideExpenseClaim({
        claimId: id,
        keputusan: 'REJECTED',
        decidedByUserId: SITI_USER,
        peran: 'HR_MANAGER',
        dbInjeksi: client,
      })
    ).rejects.toThrow(/alasan/i);
  });

  it('alasan penolakan tercatat dan terbaca HR', async () => {
    const id = await klaimBaru();
    const hasil = await decideExpenseClaim({
      claimId: id,
      keputusan: 'REJECTED',
      catatan: 'Bukti struk tidak terbaca.',
      decidedByUserId: SITI_USER,
      peran: 'HR_MANAGER',
      dbInjeksi: client,
    });
    expect(hasil.status).toBe('REJECTED');
    expect(hasil.decisionNote).toContain('tidak terbaca');

    const daftar = await listExpenseClaimsForHr({}, client);
    expect(daftar.find((k) => k.id === id)?.decisionNote).toContain('tidak terbaca');
  });

  it('menyetujui sebagian: nominal disetujui lebih kecil dari pengajuan', async () => {
    const id = await klaimBaru(1000000);
    const hasil = await decideExpenseClaim({
      claimId: id,
      keputusan: 'APPROVED',
      disetujui: 600000,
      decidedByUserId: SITI_USER,
      peran: 'HR_MANAGER',
      dbInjeksi: client,
    });
    expect(hasil.status).toBe('APPROVED');
    expect(hasil.approvedAmount).toBe(600000);
  });

  it('menolak nominal disetujui melebihi pengajuan', async () => {
    const id = await klaimBaru(500000);
    await expect(
      decideExpenseClaim({
        claimId: id,
        keputusan: 'APPROVED',
        disetujui: 900000,
        decidedByUserId: SITI_USER,
        peran: 'HR_MANAGER',
        dbInjeksi: client,
      })
    ).rejects.toThrow(/melebihi/i);
  });

  it('klaim yang sudah diputuskan tidak dapat diputuskan ulang', async () => {
    const id = await klaimBaru();
    await decideExpenseClaim({
      claimId: id,
      keputusan: 'APPROVED',
      decidedByUserId: SITI_USER,
      peran: 'HR_MANAGER',
      dbInjeksi: client,
    });
    await expect(
      decideExpenseClaim({
        claimId: id,
        keputusan: 'REJECTED',
        catatan: 'Berubah pikiran.',
        decidedByUserId: SITI_USER,
        peran: 'HR_MANAGER',
        dbInjeksi: client,
      })
    ).rejects.toThrow(/diputuskan/i);
  });

  it('pegawai tidak boleh memutuskan klaim', async () => {
    const id = await klaimBaru();
    await expect(
      decideExpenseClaim({
        claimId: id,
        keputusan: 'APPROVED',
        decidedByUserId: BUDI_USER,
        peran: 'EMPLOYEE',
        dbInjeksi: client,
      })
    ).rejects.toThrow(/HR|BOD|berwenang/i);
  });

  it('antrean menunggu keputusan hanya berisi SUBMITTED', async () => {
    await klaimBaru(300000);
    const antrean = await listExpenseClaimsForHr({ status: 'SUBMITTED' }, client);
    expect(antrean.length).toBeGreaterThan(0);
    expect(antrean.every((k) => k.status === 'SUBMITTED')).toBe(true);
    expect(antrean[0].employeeName).toBeTruthy();
  });
});
