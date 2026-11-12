// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import RecruitmentPanel from '@/components/governance/RecruitmentPanel';

const kandidat = [
  {
    id: 'a1', applicationNo: 'APP-1', status: 'SUBMITTED', appliedAt: '2026-01-01',
    fullName: 'Kandidat Uji', email: 'k@x.id', postingTitle: 'Engineer', offerStatus: null,
  },
];

/**
 * Profil dengan bentuk data seperti yang dikirim getApplicationDetail:
 * `level` kosong tapi `degree` terisi, dan tanggal pekerjaan hanya berupa
 * startDate/endDate (bukan startMonth/startYear).
 */
const profil = {
  id: 'a1', applicationNo: 'APP-1', applicationStatus: 'SUBMITTED', candidateId: 'c1',
  fullName: 'Kandidat Uji', email: 'k@x.id', postingTitle: 'Engineer',
  educations: [
    {
      id: 'e1', level: null, degree: 'S1', institution: 'Pesantren Tinggi Darul Ulum University',
      major: 'Teknik Informatika', startYear: 2022, endYear: 2026, graduationStatus: 'LULUS', gpa: 3.5,
    },
  ],
  experiences: [
    {
      id: 'x1', experienceType: 'KERJA', roleTitle: 'Staff IT', company: 'PT Contoh',
      startMonth: null, startYear: null, endMonth: null, endYear: null, isCurrent: false,
      startDate: '2023-07-01T00:00:00.000Z', endDate: '2024-08-01T00:00:00.000Z',
    },
  ],
  certifications: [], documents: [], skills: [],
};

const stub = () => {
  global.fetch = vi.fn(async (url: any) => {
    const u = String(url);
    const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ status: 'success', data }) }) as any;
    if (u.includes('/recruitment/candidates/a1')) return ok(profil);
    if (u.includes('/recruitment/candidates')) return ok({ candidates: kandidat });
    return ok({}) as any;
  }) as any;
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('detail kandidat menampilkan riwayat lengkap', () => {
  it('riwayat pendidikan tidak menampilkan "—" bila degree terisi', async () => {
    stub();
    render(<RecruitmentPanel />);
    await waitFor(() => expect(screen.getByText('Kandidat Uji')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Detail/i }));
    await waitFor(() => expect(screen.getByText('Riwayat Pendidikan')).toBeTruthy(), { timeout: 8000 });

    const teks = (document.body.textContent || '').replace(/\s+/g, ' ');
    expect(teks).toContain('Pesantren Tinggi Darul Ulum University');
    // Inti keluhan: jenjang tampil "—" padahal degree='S1' ada. Baris harus
    // DIAWALI "S1" (bukan "—").
    expect(teks).toContain('S1 · Teknik Informatika');
    expect(teks).toContain('Riwayat PendidikanS1');
  });

  it('riwayat pekerjaan menampilkan periode dari startDate/endDate', async () => {
    stub();
    render(<RecruitmentPanel />);
    await waitFor(() => expect(screen.getByText('Kandidat Uji')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Detail/i }));
    await waitFor(() => expect(screen.getByText('Riwayat Pekerjaan')).toBeTruthy(), { timeout: 8000 });

    const teks = (document.body.textContent || '').replace(/\s+/g, ' ');
    expect(teks).toContain('Staff IT');
    expect(teks).toContain('PT Contoh');
    // Periode harus terbentuk dari startDate/endDate: "Jul 2023 – Agu 2024".
    expect(teks).toMatch(/Jul 2023/);
    expect(teks).toMatch(/Agu 2024/);
    // Jenis pengalaman ditulis manusiawi, bukan kode.
    expect(teks).toContain('[Kerja]');
    expect(teks).not.toContain('[KERJA]');
  });
});
