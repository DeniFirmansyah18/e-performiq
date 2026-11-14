import { describe, it, expect } from 'vitest';
import {
  hitungAlpaDariFakta,
  rekomendasiAbsensi,
  type FaktaKehadiran,
} from '@/lib/services/absensiSanksiService';
import { sanksiAbsensiYangDisarankan } from '@/lib/services/disciplinaryPoints';

function fakta(workDate: string, opts: Partial<FaktaKehadiran> = {}): FaktaKehadiran {
  return { workDate, isPresent: true, isWeekend: false, isSickLeave: false, ...opts };
}

describe('hitung alpa dari fakta kehadiran', () => {
  it('menghitung hanya hari kerja yang TIDAK hadir dan bukan sakit', () => {
    const alpa = hitungAlpaDariFakta([
      fakta('2026-11-02', { isPresent: false }), // alpa
      fakta('2026-11-03', { isPresent: false, isSickLeave: true }), // sakit → bukan alpa
      fakta('2026-11-04', { isPresent: false, isWeekend: true }), // weekend → bukan alpa
      fakta('2026-11-05'), // hadir
      fakta('2026-11-06', { isPresent: false }), // alpa
    ]);
    expect(alpa).toBe(2);
  });

  it('mengembalikan 0 bila tidak ada baris maupun semua hadir', () => {
    expect(hitungAlpaDariFakta([])).toBe(0);
    expect(hitungAlpaDariFakta([fakta('2026-11-02')])).toBe(0);
  });
});

describe('rekomendasi sanksi absensi', () => {
  it('tidak memberi sanksi di bawah ambang wajar', () => {
    expect(rekomendasiAbsensi(hitungAlpaDariFakta([
      fakta('2026-11-02', { isPresent: false }),
      fakta('2026-11-03', { isPresent: false }),
    ]))).toBeNull();
  });

  it('teguran mulai 3 kali alpa dalam sebulan', () => {
    const rekom = rekomendasiAbsensi(hitungAlpaDariFakta([
      fakta('2026-11-02', { isPresent: false }),
      fakta('2026-11-03', { isPresent: false }),
      fakta('2026-11-04', { isPresent: false }),
    ]));
    expect(rekom).not.toBeNull();
    expect(rekom?.actionType).toBe('TEGURAN');
  });

  it('konsisten dengan aturan baku di disciplinaryPoints', () => {
    expect(rekomendasiAbsensi(5)?.actionType).toBe(sanksiAbsensiYangDisarankan(5)?.actionType);
    expect(rekomendasiAbsensi(6)?.actionType).toBe('SP2');
  });
});
