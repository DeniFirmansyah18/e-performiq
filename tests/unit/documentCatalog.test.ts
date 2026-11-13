import { describe, it, expect } from 'vitest';
import {
  KATALOG_DOKUMEN,
  DOKUMEN_BY_KODE,
  dokumenWajib,
  hitungKelengkapan,
  LABEL_KELOMPOK,
} from '@/lib/services/documentCatalog';

describe('daftar baku jenis dokumen', () => {
  it('memuat jenis yang diminta pengguna', () => {
    for (const kode of ['KTP', 'KK', 'NPWP', 'IJAZAH', 'TRANSKRIP', 'PKWT', 'SK_PENGANGKATAN', 'BPJS', 'REKENING', 'SKCK']) {
      expect(DOKUMEN_BY_KODE[kode], kode).toBeTruthy();
    }
  });

  it('setiap jenis punya label, kelompok, dan penanda wajib/opsional', () => {
    for (const d of KATALOG_DOKUMEN) {
      expect(d.label, d.kode).toBeTruthy();
      expect(LABEL_KELOMPOK[d.kelompok], d.kode).toBeTruthy();
      expect(typeof d.wajib).toBe('boolean');
      expect(['HR', 'ATASAN']).toContain(d.verifikator);
    }
  });

  it('kode unik', () => {
    const kode = KATALOG_DOKUMEN.map((d) => d.kode);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('menandai dokumen berkedaluwarsa (PKWT, sertifikat, STR/SIP, SKCK)', () => {
    for (const kode of ['PKWT', 'SERTIFIKAT', 'STR_SIP', 'SKCK']) {
      expect(DOKUMEN_BY_KODE[kode].berkedaluwarsa, kode).toBe(true);
    }
    // KTP & ijazah tidak berkedaluwarsa.
    expect(DOKUMEN_BY_KODE.KTP.berkedaluwarsa).toBe(false);
    expect(DOKUMEN_BY_KODE.IJAZAH.berkedaluwarsa).toBe(false);
  });

  it('berkas hukum diverifikasi HR, berkas kerja oleh atasan', () => {
    expect(DOKUMEN_BY_KODE.KTP.verifikator).toBe('HR');
    expect(DOKUMEN_BY_KODE.SK_PENGANGKATAN.verifikator).toBe('HR');
    expect(DOKUMEN_BY_KODE.SP.verifikator).toBe('ATASAN');
  });

  it('borongan wajib berisi KTP, KK, NPWP, Ijazah, PKWT, SK, BPJS, Rekening, SKCK', () => {
    const wajib = dokumenWajib('PKWTT').map((d) => d.kode);
    for (const k of ['KTP', 'KK', 'NPWP', 'IJAZAH', 'PKWT', 'SK_PENGANGKATAN', 'BPJS', 'REKENING', 'SKCK']) {
      expect(wajib, k).toContain(k);
    }
    // Opsional tidak masuk daftar wajib.
    expect(wajib).not.toContain('FOTO');
    expect(wajib).not.toContain('TRANSKRIP');
  });
});

describe('indikator kelengkapan berkas', () => {
  it('menampilkan "Berkas wajib: 6 dari 9 lengkap"', () => {
    const r = hitungKelengkapan([
      { documentType: 'KTP' },
      { documentType: 'KK' },
      { documentType: 'NPWP' },
      { documentType: 'IJAZAH' },
      { documentType: 'PKWT' },
      { documentType: 'BPJS' },
    ]);
    expect(r.teksKelengkapan).toBe('Berkas wajib: 6 dari 9 lengkap');
    expect(r.jumlahLengkap).toBe(6);
    expect(r.jumlahWajib).toBe(9);
    expect(r.persen).toBe(67);
    expect(r.belumAda.map((d) => d.kode).sort()).toEqual(['REKENING', 'SKCK', 'SK_PENGANGKATAN']);
  });

  it('mengabaikan nama jenis lama/tak dikenal (teks bebas) agar hitungan tidak keliru', () => {
    const r = hitungKelengkapan([
      { documentType: 'KTP' },
      { documentType: 'ktp' }, // huruf kecil tetap dihitung
      { documentType: 'Kartu Tanda Penduduk' }, // teks bebas lama: diabaikan
    ]);
    expect(r.jumlahLengkap).toBe(1);
  });

  it('semua lengkap → 100%', () => {
    const semua = dokumenWajib('PKWTT').map((d) => ({ documentType: d.kode }));
    const r = hitungKelengkapan(semua);
    expect(r.persen).toBe(100);
    expect(r.belumAda).toEqual([]);
  });

  it('mendeteksi dokumen KEDALUWARSA', () => {
    const r = hitungKelengkapan(
      [{ documentType: 'PKWT', expiryDate: '2026-01-31T00:00:00.000Z' }],
      { hariIni: new Date('2026-06-01T00:00:00.000Z') }
    );
    expect(r.kedaluwarsa.map((d) => d.kode)).toContain('PKWT');
    expect(r.kedaluwarsa[0].label).toContain('Perjanjian Kerja');
  });

  it('mendeteksi dokumen yang SEGERA kedaluwarsa (≤ 60 hari)', () => {
    const r = hitungKelengkapan(
      [{ documentType: 'SKCK', expiryDate: '2026-07-15T00:00:00.000Z' }],
      { hariIni: new Date('2026-06-01T00:00:00.000Z') }
    );
    expect(r.segeraKedaluwarsa.map((d) => d.kode)).toContain('SKCK');
    expect(r.kedaluwarsa).toEqual([]);
  });

  it('dokumen jauh di masa depan tidak masuk peringatan', () => {
    const r = hitungKelengkapan(
      [{ documentType: 'PKWT', expiryDate: '2028-01-01T00:00:00.000Z' }],
      { hariIni: new Date('2026-06-01T00:00:00.000Z') }
    );
    expect(r.kedaluwarsa).toEqual([]);
    expect(r.segeraKedaluwarsa).toEqual([]);
  });

  it('tanpa dokumen sama sekali → 0 dari 9', () => {
    const r = hitungKelengkapan([]);
    expect(r.teksKelengkapan).toBe('Berkas wajib: 0 dari 9 lengkap');
    expect(r.persen).toBe(0);
  });
});
