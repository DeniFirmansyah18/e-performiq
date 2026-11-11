import { describe, it, expect } from 'vitest';
import { susunPromptDetailPegawai } from '@/lib/services/employeeDetailAi';

const dasar = {
  profil: {
    fullName: 'Budi Pratama',
    employeeCode: 'EMP-2022-0042',
    departmentName: 'Information Technology',
    positionTitle: 'Senior Engineer',
    status: 'PERMANENT',
    masaKerja: '3 tahun 2 bulan',
    managerName: 'Raden Mas Danu',
    directReportCount: 0,
  },
  gpaTerakhir: 3.67,
  ratingTerakhir: 'A',
  jumlahKpi: 5,
  capaianRataRata: 92.4,
  jumlahIndikatorHarian: 3,
  dokumen: [] as Array<{ documentType: string; verificationStatus: string }>,
  bpjsAda: true,
};

describe('prompt analisis detail pegawai', () => {
  it('memuat identitas pegawai dan angka kinerjanya', () => {
    const p = susunPromptDetailPegawai(dasar);
    expect(p).toContain('Budi Pratama');
    expect(p).toContain('92.4');
    expect(p).toContain('3.67');
  });

  it('menyebut berkas yang belum terverifikasi', () => {
    const p = susunPromptDetailPegawai({
      ...dasar,
      dokumen: [
        { documentType: 'KTP', verificationStatus: 'VERIFIED' },
        { documentType: 'Ijazah', verificationStatus: 'PENDING' },
      ],
    });
    expect(p).toContain('Ijazah');
    expect(p.toLowerCase()).toContain('belum terverifikasi');
  });

  it('meminta rekomendasi mempertahankan kinerja bila capaian tinggi', () => {
    const p = susunPromptDetailPegawai({ ...dasar, capaianRataRata: 96 });
    expect(p.toLowerCase()).toContain('mempertahankan');
  });

  it('meminta rekomendasi perbaikan bila capaian rendah', () => {
    const p = susunPromptDetailPegawai({ ...dasar, capaianRataRata: 55, ratingTerakhir: 'C' });
    expect(p.toLowerCase()).toMatch(/perbaikan|peningkatan/);
  });

  it('memakai Bahasa Indonesia dan melarang mengarang data', () => {
    const p = susunPromptDetailPegawai(dasar);
    expect(p).toContain('Bahasa Indonesia');
    expect(p.toLowerCase()).toContain('jangan mengarang');
  });

  it('tetap aman bila data kosong', () => {
    const p = susunPromptDetailPegawai({
      profil: {
        fullName: 'Tanpa Data',
        employeeCode: '-',
        departmentName: null,
        positionTitle: null,
        status: null,
        masaKerja: null,
        managerName: null,
        directReportCount: 0,
      },
      gpaTerakhir: null,
      ratingTerakhir: null,
      jumlahKpi: 0,
      capaianRataRata: null,
      jumlahIndikatorHarian: 0,
      dokumen: [],
      bpjsAda: false,
    });
    expect(typeof p).toBe('string');
    expect(p.length).toBeGreaterThan(80);
  });
});
