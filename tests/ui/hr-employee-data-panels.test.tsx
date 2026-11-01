// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import SocialSecurityManagerPanel from '@/components/governance/SocialSecurityManagerPanel';
import DocumentVerificationPanel from '@/components/governance/DocumentVerificationPanel';
import DisciplinaryManagerPanel from '@/components/governance/DisciplinaryManagerPanel';
import CareerLadderManagerPanel from '@/components/governance/CareerLadderManagerPanel';
import { AuthProvider } from '@/lib/context/AuthContext';
import type { ReactElement } from 'react';

// Panel BPJS & sanksi memakai `useAuth()` untuk menentukan hak tulis, jadi
// render harus dibungkus `AuthProvider` agar sesi HR terbaca.
const asHr = (ui: ReactElement) => render(<AuthProvider>{ui}</AuthProvider>);

const bpjs = {
  ok: true,
  json: async () => ({ data: { total: 2, items: [
    { employeeId: 'e1', employeeCode: 'EMP-001', employeeName: 'Budi Pratama',
      bpjsTkNumber: '••••••••••••3334', bpjsKesNumber: '•••••••••3210', bpjsKesClass: 'Kelas 1',
      bpjsTkStatus: 'ACTIVE', bpjsKesStatus: 'ACTIVE', registeredAt: '2024-01-05', registered: true },
    { employeeId: 'e2', employeeCode: 'EMP-002', employeeName: 'Siti Aminah',
      bpjsTkNumber: null, bpjsKesNumber: null, bpjsKesClass: null,
      bpjsTkStatus: 'PENDING', bpjsKesStatus: 'PENDING', registeredAt: null, registered: false },
  ] } }),
};

const docs = {
  ok: true,
  json: async () => ({ data: { total: 1, items: [
    { id: 'd1', employeeId: 'e1', employeeCode: 'EMP-001', employeeName: 'Budi Pratama',
      documentType: 'KTP', fileUrl: 'https://files.example.com/ktp.pdf',
      verificationStatus: 'PENDING', expiryDate: null, verifiedAt: null },
  ] } }),
};

const actions = {
  ok: true,
  json: async () => ({ data: { total: 2, items: [
    { id: 'a1', employeeId: 'e1', employeeCode: 'EMP-001', employeeName: 'Budi Pratama',
      actionType: 'SP1', reason: 'Terlambat berulang', effectiveDate: '2026-10-20',
      expiryDate: null, appealStatus: 'UNDER_APPEAL', appealDeadline: '2026-10-25',
      appealReason: 'saya dinas luar', issuedByName: 'hr@eperformiq.co.id' },
    { id: 'a2', employeeId: 'e2', employeeCode: 'EMP-002', employeeName: 'Siti Aminah',
      actionType: 'TEGURAN', reason: 'Tidak memakai ID card', effectiveDate: '2026-09-01',
      expiryDate: null, appealStatus: 'NONE', appealDeadline: '2026-09-06',
      appealReason: null, issuedByName: 'hr@eperformiq.co.id' },
  ] } }),
};

const ladder = {
  ok: true,
  json: async () => ({ data: { total: 1, items: [
    { id: 's1', fromPositionId: 'p1', fromPositionTitle: 'Staff IT',
      toPositionId: 'p2', toPositionTitle: 'Senior Staff IT', stepOrder: 1,
      stepName: 'Sertifikasi manajemen proyek', requirementType: 'CERTIFICATION',
      requirementRef: 'PMP', thresholdValue: 1, isMandatory: true },
  ] } }),
};

const employees = {
  ok: true,
  json: async () => ({ data: { employees: [
    { employeeId: 'e1', employeeCode: 'EMP-001', fullName: 'Budi Pratama' },
    { employeeId: 'e2', employeeCode: 'EMP-002', fullName: 'Siti Aminah' },
  ] } }),
};

const positions = {
  ok: true,
  json: async () => ({ data: { items: [
    { id: 'p1', positionTitle: 'Staff IT' },
    { id: 'p2', positionTitle: 'Senior Staff IT' },
  ] } }),
};

let calls: string[] = [];

beforeEach(() => {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: any) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('/auth/me')) {
      return { ok: true, json: async () => ({ data: { user: {
        id: 'u-hr', email: 'siti.nurhaliza@eperformiq.co.id', name: 'Siti Nurhaliza', role: 'HR_MANAGER',
      } } }) } as any;
    }
    if (url.includes('/hr/social-security')) return bpjs as any;
    if (url.includes('/hr/documents')) return docs as any;
    if (url.includes('/hr/disciplinary-actions')) return actions as any;
    if (url.includes('/hr/career-ladder')) return ladder as any;
    if (url.includes('/hr/employees')) return employees as any;
    if (url.includes('/recruitment/positions')) return positions as any;
    return { ok: true, json: async () => ({ data: { items: [] } }) } as any;
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SocialSecurityManagerPanel', () => {
  it('menampilkan peserta ter-masking dan yang belum terdaftar', async () => {
    asHr(<SocialSecurityManagerPanel />);
    await waitFor(() => expect(screen.getByText('Budi Pratama')).toBeTruthy());
    expect(screen.getByText(/••••••••••••3334/)).toBeTruthy();
    expect(screen.getByText(/Belum terdaftar/)).toBeTruthy();
    expect(screen.getByText(/Kelas 1/)).toBeTruthy();
  });

  it('menyediakan tombol kelola per karyawan', async () => {
    asHr(<SocialSecurityManagerPanel />);
    await waitFor(() => expect(screen.getByText('Budi Pratama')).toBeTruthy());
    expect(screen.getAllByRole('button', { name: /Kelola/i }).length).toBe(2);
  });

  it('membuka form edit dengan field nomor BPJS', async () => {
    asHr(<SocialSecurityManagerPanel />);
    await waitFor(() => expect(screen.getByText('Budi Pratama')).toBeTruthy());
    fireEvent.click(screen.getAllByRole('button', { name: /Kelola/i })[0]);
    await waitFor(() => expect(screen.getByLabelText(/Nomor BPJS Ketenagakerjaan/i)).toBeTruthy());
    expect(screen.getByLabelText(/Kelas BPJS Kesehatan/i)).toBeTruthy();
  });
});

describe('DocumentVerificationPanel', () => {
  it('menampilkan antrean berkas dengan nama karyawan', async () => {
    render(<DocumentVerificationPanel />);
    await waitFor(() => expect(screen.getByText('KTP')).toBeTruthy());
    expect(screen.getByText(/Budi Pratama/)).toBeTruthy();
    expect(screen.getByText(/Menunggu verifikasi/)).toBeTruthy();
  });

  it('menyediakan tombol setujui dan tolak', async () => {
    render(<DocumentVerificationPanel />);
    await waitFor(() => expect(screen.getByText('KTP')).toBeTruthy());
    expect(screen.getByRole('button', { name: /Setujui/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tolak/i })).toBeTruthy();
  });

  it('menyetujui memanggil endpoint verifikasi', async () => {
    render(<DocumentVerificationPanel />);
    await waitFor(() => expect(screen.getByText('KTP')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Setujui/i }));
    await waitFor(() => expect(calls.some((c) => c.includes('/documents/d1/verify'))).toBe(true));
  });
});

describe('DisciplinaryManagerPanel', () => {
  it('menampilkan sanksi dan status keberatan', async () => {
    asHr(<DisciplinaryManagerPanel />);
    await waitFor(() => expect(screen.getByText(/Terlambat berulang/)).toBeTruthy());
    expect(screen.getByText(/Menunggu keputusan/)).toBeTruthy();
    expect(screen.getByText(/Belum diajukan/)).toBeTruthy();
  });

  it('menampilkan tombol keputusan hanya untuk keberatan yang menunggu', async () => {
    asHr(<DisciplinaryManagerPanel />);
    await waitFor(() => expect(screen.getByText(/Terlambat berulang/)).toBeTruthy());
    expect(screen.getAllByRole('button', { name: /Terima keberatan/i }).length).toBe(1);
    expect(screen.getAllByRole('button', { name: /Tolak keberatan/i }).length).toBe(1);
  });

  it('menyediakan form penerbitan sanksi', async () => {
    asHr(<DisciplinaryManagerPanel />);
    // Form hanya muncul setelah sesi HR terbaca dan daftar karyawan selesai dimuat.
    await waitFor(() => expect(screen.getByLabelText(/Karyawan/i)).toBeTruthy());
    expect(screen.getByLabelText(/Jenis sanksi/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Alasan/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Terbitkan sanksi/i })).toBeTruthy();
  });
});

describe('CareerLadderManagerPanel', () => {
  it('menampilkan tahapan beserta posisi asal dan tujuan', async () => {
    render(<CareerLadderManagerPanel />);
    await waitFor(() => expect(screen.getByText(/Sertifikasi manajemen proyek/)).toBeTruthy());
    expect(screen.getByText(/Staff IT\s+ke\s+Senior Staff IT/)).toBeTruthy();
  });

  it('menyediakan form tambah tahapan', () => {
    render(<CareerLadderManagerPanel />);
    expect(screen.getByLabelText(/Posisi asal/i)).toBeTruthy();
    expect(screen.getByLabelText(/Posisi tujuan/i)).toBeTruthy();
    expect(screen.getByLabelText(/Jenis syarat/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Tambah tahapan/i })).toBeTruthy();
  });

  it('menyediakan tombol hapus per tahapan', async () => {
    render(<CareerLadderManagerPanel />);
    await waitFor(() => expect(screen.getByText(/Sertifikasi manajemen proyek/)).toBeTruthy());
    expect(screen.getByRole('button', { name: /Hapus tahapan/i })).toBeTruthy();
  });
});
