// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import ApplicationForm from '@/components/careers/ApplicationForm';

let payloadTerkirim: any = null;

function stub() {
  payloadTerkirim = null;
  global.fetch = vi.fn(async (url: any, init: any) => {
    const u = String(url);
    const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ status: 'success', data }) }) as any;
    if (u.includes('/careers/apply')) {
      payloadTerkirim = JSON.parse(init?.body ?? '{}');
      return ok({ applicationNo: 'APP-TEST', applicationId: 'a1', ats: null });
    }
    if (u.includes('/upload')) return ok({ url: '/media/uji.mp4' });
    if (u.includes('/institutions')) return ok([]);
    if (u.includes('/majors')) return ok([]);
    if (u.includes('/reference/pt/')) return ok({});
    return ok([]);
  }) as any;
}

const POSTINGS = [{ id: '00000000-0000-4000-8000-000000000001', postingTitle: 'Engineer', department: 'IT', position: 'Engineer' }] as any;

function renderForm() {
  return render(
    <ApplicationForm
      postings={POSTINGS}
      selectedPosting="00000000-0000-4000-8000-000000000001"
      onSelectPosting={() => {}}
      onSubmitted={() => {}}
    />
  );
}

/**
 * Bagian riwayat ada di bawah; form punya syarat video perkenalan sehingga
 * pengiriman sungguhan tidak diuji di sini. Yang diuji adalah BENTUK PAYLOAD
 * yang dibangun form — inti keluhan pengguna.
 */
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('form ajukan lamaran — riwayat pendidikan & pekerjaan', () => {
  it('bagian riwayat tersedia beserta inputnya', async () => {
    stub();
    renderForm();
    await waitFor(() => expect(screen.getByText(/Riwayat Pendidikan/i)).toBeTruthy(), { timeout: 8000 });

    const teks = (document.body.textContent || '').replace(/\s+/g, ' ');
    expect(teks).toMatch(/Riwayat Pekerjaan/);
    expect(teks).toMatch(/Jenjang/);
    expect(teks).toMatch(/Sekolah \/ Kampus/);
    expect(teks).toMatch(/Jurusan \/ Prodi/);
    expect(teks).toMatch(/Tahun Masuk/);
    expect(teks).toMatch(/Tahun Lulus/);
    expect(teks).toMatch(/Tidak punya pengalaman/);
  });

  it('tersedia input IPK (sebelumnya tidak ada sama sekali)', async () => {
    stub();
    renderForm();
    await waitFor(() => expect(screen.getByText(/Riwayat Pendidikan/i)).toBeTruthy(), { timeout: 8000 });
    fireEvent.click(screen.getAllByRole('button', { name: /\+ Tambah/i })[0]);

    await waitFor(() => {
      const ada = Array.from(document.querySelectorAll('label')).some((l) => /IPK/i.test(l.textContent || ''));
      expect(ada, 'input IPK harus ada agar kandidat dapat mengisi IPK').toBe(true);
    });

    // Bisa diisi dan nilainya terbaca.
    const label = Array.from(document.querySelectorAll('label')).find((l) => /IPK/i.test(l.textContent || ''));
    const input = label!.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '3.75' } });
    expect(input.value).toBe('3.75');
  });

  it('entri pendidikan berisi jurusan saja tidak dibuang saat dikirim', async () => {
    stub();
    renderForm();
    await waitFor(() => expect(screen.getByText(/Riwayat Pendidikan/i)).toBeTruthy(), { timeout: 8000 });

    // Baca langsung dari modul payload: cek perilaku filter dengan data entri
    // yang hanya berisi tahun (kasus yang dahulu hilang diam-diam).
    const mod: any = await import('@/components/careers/ApplicationForm');
    const bangun = mod.__susunPayloadRiwayatUji;
    expect(typeof bangun, 'fungsi penyusun payload tersedia untuk diuji').toBe('function');

    const hasil = bangun(
      [{ level: '', institution: '', institutionCode: '', institutionExternalId: '', major: '',
        startYear: '2020', endYear: '', graduationStatus: 'LULUS', gpa: '' }],
      []
    );
    expect(hasil.educations.length, 'entri dengan tahun saja tidak boleh hilang').toBe(1);
    expect(hasil.educations[0].startYear).toBe(2020);
  });

  it('IPK 0 disusun sebagai 0, bukan null', async () => {
    const mod: any = await import('@/components/careers/ApplicationForm');
    const hasil = mod.__susunPayloadRiwayatUji(
      [{ level: 'S1', institution: 'Kampus', institutionCode: '', institutionExternalId: '', major: '',
        startYear: '2020', endYear: '2024', graduationStatus: 'LULUS', gpa: '0' }],
      []
    );
    expect(hasil.educations[0].gpa, 'IPK 0 harus tetap 0').toBe(0);
  });

  it('riwayat pekerjaan menyusun periode & status masih bekerja', async () => {
    const mod: any = await import('@/components/careers/ApplicationForm');
    const hasil = mod.__susunPayloadRiwayatUji(
      [],
      [{ experienceType: 'KERJA', roleTitle: 'Staff IT', company: 'PT Contoh', location: 'Jakarta',
         startMonth: '7', startYear: '2023', endMonth: '8', endYear: '2024', isCurrent: false }]
    );
    const x = hasil.experiences[0];
    expect(x.roleTitle).toBe('Staff IT');
    expect(x.company).toBe('PT Contoh');
    expect(x.startMonth).toBe(7);
    expect(x.startYear).toBe(2023);
    expect(x.endMonth).toBe(8);
    expect(x.endYear).toBe(2024);

    const current = mod.__susunPayloadRiwayatUji(
      [],
      [{ experienceType: 'KERJA', roleTitle: 'E', company: 'C', location: '',
         startMonth: '1', startYear: '2024', endMonth: '8', endYear: '2024', isCurrent: true }]
    );
    // "Masih bekerja di sini" mengosongkan tanggal akhir.
    expect(current.experiences[0].endMonth).toBeNull();
    expect(current.experiences[0].endYear).toBeNull();
  });
});
