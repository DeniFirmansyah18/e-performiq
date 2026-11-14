import { describe, it, expect } from 'vitest';
import {
  validasiKeputusanKlaim,
  STATUS_MENUNGGU,
  STATUS_DISETUJUI,
  bolehPutuskan,
} from '@/lib/services/expenseClaimDecision';

/**
 * Aturan keputusan klaim reimbursement oleh HR/Finance.
 *
 * HR memutuskan: setujui (nominal boleh disesuaikan) atau tolak dengan alasan
 * WAJIB. Klaim yang sudah diputuskan tidak boleh diputuskan ulang.
 */

describe('validasi keputusan klaim', () => {
  it('menyetujui tanpa catatan diperbolehkan', () => {
    const h = validasiKeputusanKlaim({
      statusSekarang: STATUS_MENUNGGU,
      keputusan: 'APPROVED',
      disetujui: 500000,
      diajukan: 500000,
    });
    expect(h.ok).toBe(true);
  });

  it('menolak wajib menyertakan alasan yang memadai', () => {
    const tanpaAlasan = validasiKeputusanKlaim({
      statusSekarang: STATUS_MENUNGGU,
      keputusan: 'REJECTED',
      disetujui: 0,
      diajukan: 500000,
    });
    expect(tanpaAlasan.ok).toBe(false);

    const alasanPendek = validasiKeputusanKlaim({
      statusSekarang: STATUS_MENUNGGU,
      keputusan: 'REJECTED',
      disetujui: 0,
      diajukan: 500000,
      catatan: 'no',
    });
    expect(alasanPendek.ok).toBe(false);

    const alasanCukup = validasiKeputusanKlaim({
      statusSekarang: STATUS_MENUNGGU,
      keputusan: 'REJECTED',
      disetujui: 0,
      diajukan: 500000,
      catatan: 'Bukti struk tidak terbaca.',
    });
    expect(alasanCukup.ok).toBe(true);
  });

  it('menolak nominal yang melebihi pengajuan atau bukan angka', () => {
    const melebihi = validasiKeputusanKlaim({
      statusSekarang: STATUS_MENUNGGU,
      keputusan: 'APPROVED',
      disetujui: 900000,
      diajukan: 500000,
    });
    expect(melebihi.ok).toBe(false);

    const bukanAngka = validasiKeputusanKlaim({
      statusSekarang: STATUS_MENUNGGU,
      keputusan: 'APPROVED',
      disetujui: Number.NaN,
      diajukan: 500000,
    });
    expect(bukanAngka.ok).toBe(false);
  });

  it('menolak klaim yang sudah diputuskan', () => {
    const h = validasiKeputusanKlaim({
      statusSekarang: STATUS_DISETUJUI,
      keputusan: 'REJECTED',
      disetujui: 0,
      diajukan: 500000,
      catatan: 'Berubah pikiran.',
    });
    expect(h.ok).toBe(false);
  });
});

describe('izin memutuskan', () => {
  it('HR, BOD, dan SUPER_ADMIN boleh memutuskan', () => {
    expect(bolehPutuskan('HR_MANAGER')).toBe(true);
    expect(bolehPutuskan('BOD')).toBe(true);
    expect(bolehPutuskan('SUPER_ADMIN')).toBe(true);
  });

  it('pegawai dan people manager tidak boleh memutuskan', () => {
    expect(bolehPutuskan('EMPLOYEE')).toBe(false);
    expect(bolehPutuskan('PEOPLE_MANAGER')).toBe(false);
  });
});
