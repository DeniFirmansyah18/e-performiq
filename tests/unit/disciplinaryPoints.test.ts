import { describe, it, expect } from 'vitest';
import {
  POIN_BAKU,
  AMBANG_POIN,
  poinSanksi,
  masihBerlaku,
  hitungPoinPelanggaran,
  sanksiAbsensiYangDisarankan,
} from '@/lib/services/disciplinaryPoints';

const HARI_INI = new Date('2026-06-15T00:00:00.000Z');

describe('poin pelanggaran', () => {
  it('poin baku naik sesuai berat sanksi', () => {
    expect(POIN_BAKU.TEGURAN).toBe(1);
    expect(POIN_BAKU.SP1).toBe(5);
    expect(POIN_BAKU.SP2).toBe(10);
    expect(POIN_BAKU.SP3).toBeGreaterThan(POIN_BAKU.SP2);
  });

  it('memakai poin tersimpan bila ada, atau bobot baku bila kosong', () => {
    expect(poinSanksi({ actionType: 'SP1', violationPoints: 7 })).toBe(7);
    expect(poinSanksi({ actionType: 'SP1', violationPoints: null })).toBe(5);
    expect(poinSanksi({ actionType: 'sp2' })).toBe(10);
    expect(poinSanksi({ actionType: 'TIDAK_DIKENAL' })).toBe(0);
  });

  it('sanksi tanpa tanggal berakhir tetap dianggap berlaku', () => {
    expect(masihBerlaku({ actionType: 'SP1' }, HARI_INI)).toBe(true);
    expect(masihBerlaku({ actionType: 'SP1', expiryDate: '2026-12-31' }, HARI_INI)).toBe(true);
    expect(masihBerlaku({ actionType: 'SP1', expiryDate: '2026-01-01' }, HARI_INI)).toBe(false);
  });

  it('total poin aktif HANYA menghitung sanksi yang masih berlaku', () => {
    const r = hitungPoinPelanggaran(
      [
        { actionType: 'SP1', expiryDate: '2026-12-31', violationCategory: 'ABSENSI' }, // 5 aktif
        { actionType: 'TEGURAN', expiryDate: '2026-12-31', violationCategory: 'ABSENSI' }, // 1 aktif
        { actionType: 'SP3', expiryDate: '2026-01-01' }, // 20, sudah berakhir
      ],
      { hariIni: HARI_INI }
    );
    expect(r.totalPoinAktif).toBe(6);
    expect(r.totalPoinKeseluruhan).toBe(26);
    expect(r.jumlahSanksiAktif).toBe(2);
  });

  it('menandai ambang yang terlampaui', () => {
    const r = hitungPoinPelanggaran([{ actionType: 'SP2' }], { hariIni: HARI_INI }); // 10 poin
    expect(r.ambangTerlampaui).toEqual({ poin: 10, label: 'Tinjauan HR untuk SP' });
    // Di bawah ambang terendah → null
    const kecil = hitungPoinPelanggaran([{ actionType: 'TEGURAN' }], { hariIni: HARI_INI });
    expect(kecil.ambangTerlampaui).toBeNull();
    // Ambang tertinggi menang bila terlampaui
    const besar = hitungPoinPelanggaran([{ actionType: 'SP3' }], { hariIni: HARI_INI });
    expect(besar.ambangTerlampaui?.poin).toBe(20);
  });

  it('merekap poin per kategori pelanggaran', () => {
    const r = hitungPoinPelanggaran(
      [
        { actionType: 'SP1', violationCategory: 'ABSENSI' },
        { actionType: 'TEGURAN', violationCategory: 'ABSENSI' },
        { actionType: 'SP2', violationCategory: 'KODE_ETIK' },
      ],
      { hariIni: HARI_INI }
    );
    const absensi = r.perKategori.find((k) => k.kategori === 'ABSENSI');
    expect(absensi?.poin).toBe(6);
    expect(absensi?.label).toBe('Absensi & Kehadiran');
    const etik = r.perKategori.find((k) => k.kategori === 'KODE_ETIK');
    expect(etik?.poin).toBe(10);
  });

  it('sanksi tanpa kategori dikelompokkan sebagai Lainnya', () => {
    const r = hitungPoinPelanggaran([{ actionType: 'SP1' }], { hariIni: HARI_INI });
    expect(r.perKategori[0].label).toBe('Lainnya');
  });

  it('pegawai tanpa sanksi memiliki 0 poin', () => {
    const r = hitungPoinPelanggaran([], { hariIni: HARI_INI });
    expect(r.totalPoinAktif).toBe(0);
    expect(r.ambangTerlampaui).toBeNull();
    expect(r.perKategori).toEqual([]);
  });

  it('menyebut tanggal berlaku terdekat', () => {
    const r = hitungPoinPelanggaran(
      [
        { actionType: 'SP1', expiryDate: '2026-12-31' },
        { actionType: 'TEGURAN', expiryDate: '2026-08-01' },
      ],
      { hariIni: HARI_INI }
    );
    expect(r.berlakuSampai).toBe('2026-08-01');
  });
});

describe('pelanggaran absensi otomatis', () => {
  it('tidak menyarankan sanksi bila alpa < 3', () => {
    expect(sanksiAbsensiYangDisarankan(0)).toBeNull();
    expect(sanksiAbsensiYangDisarankan(2)).toBeNull();
  });

  it('3-4 kali alpa → teguran', () => {
    expect(sanksiAbsensiYangDisarankan(3)?.actionType).toBe('TEGURAN');
    expect(sanksiAbsensiYangDisarankan(4)?.actionType).toBe('TEGURAN');
  });

  it('5 kali alpa → SP1', () => {
    expect(sanksiAbsensiYangDisarankan(5)?.actionType).toBe('SP1');
  });

  it('6 kali atau lebih → SP2', () => {
    expect(sanksiAbsensiYangDisarankan(6)?.actionType).toBe('SP2');
    expect(sanksiAbsensiYangDisarankan(9)?.actionType).toBe('SP2');
  });

  it('menyertakan alasan yang menyebut jumlah ketidakhadiran', () => {
    expect(sanksiAbsensiYangDisarankan(4)?.alasan).toContain('4 kali');
  });

  it('ambang poin berurutan naik', () => {
    const poin = AMBANG_POIN.map((a) => a.poin);
    expect(poin).toEqual([...poin].sort((a, b) => a - b));
  });
});
