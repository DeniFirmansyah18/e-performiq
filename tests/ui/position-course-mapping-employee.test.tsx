// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import PositionCourseMappingPanel from '@/components/governance/PositionCourseMappingPanel';

const okJson = (data: unknown, message = '') => ({ ok: true, json: async () => ({ status: 'success', data, message }) });

const positionCourses = {
  positions: [
    {
      positionId: 'a0000000-0000-4000-8000-000000000204',
      title: 'Senior Software Engineer',
      departmentName: 'Teknologi',
      mappedCount: 2,
      courses: [
        { courseId: 1, courseCode: 'ONB-102', title: 'Onboarding Senior Software Engineer', category: 'Onboarding', isMandatory: true, orderIndex: 0, defaultHours: 8 },
        { courseId: 2, courseCode: 'AKHLAK-CULTURE', title: 'Budaya AKHLAK', category: 'Culture', isMandatory: true, orderIndex: 1, defaultHours: 4 },
      ],
    },
  ],
  courses: [
    { courseId: 1, courseCode: 'ONB-102', title: 'Onboarding Senior Software Engineer', category: 'Onboarding', targetPhase: 'PRE', isMandatoryDefault: true, defaultHours: 8, moduleCount: 4 },
  ],
};

const employees = [
  { employeeId: 'b0000000-0000-4000-8000-000000000012', employeeCode: 'UJI-2026-0012', fullName: 'Dewi Lestari', department: 'Teknologi', position: 'Senior Software Engineer' },
  { employeeId: 'b0000000-0000-4000-8000-000000000004', employeeCode: 'EMP-2026-0004', fullName: 'Budi Pratama', department: 'Teknologi', position: 'Senior Software Engineer' },
];

const generateResponse = {
  courseId: 1,
  courseCode: 'ONB-102',
  title: 'Onboarding Senior Software Engineer',
  modules: [
    { title: 'Pengantar Kompetensi', contentType: 'VIDEO', contentUrl: 'https://www.open.edu/openlearn/x', orderIndex: 1 },
  ],
  oerCount: 1,
  positionCourses: [
    { courseId: 1, courseCode: 'ONB-102', title: 'Onboarding Senior Software Engineer', contentUrl: 'https://www.open.edu/openlearn/x' },
  ],
};

beforeEach(() => {
  let generateCalled = 0;
  let enrollCalled = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/learning/position-courses') && (!init || init.method === 'GET' || init.method === undefined)) {
      return okJson(positionCourses);
    }
    if (u.includes('/hr/employees')) return okJson({ employees });
    if (u.includes('/learning/position-courses/generate') && init?.method === 'POST') {
      generateCalled++;
      return okJson(generateResponse);
    }
    if (u.includes('/recruitment/onboarding/generate') && init?.method === 'POST') {
      enrollCalled++;
      return okJson({ programId: 'p1', planId: 'plan1', enrolled: 2, progressPct: 0, completedMandatory: 0, totalMandatory: 2 });
    }
    if (u.includes('/learning/courses/1')) return okJson({ modules: [] });
    return okJson({ items: [] });
  }));
  // State penghitung diakses lewat properti global untuk di-assert pada akhir test.
  (globalThis as any).__generateCalls = () => generateCalled;
  (globalThis as any).__enrollCalls = () => enrollCalled;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Pemetaan Kursus per Posisi — selector pegawai + generate AI (request 12)', () => {
  it('menampilkan picker Nama pegawai yang terisi dari daftar karyawan', async () => {
    render(<PositionCourseMappingPanel />);
    await waitFor(() => expect(screen.getByText('Pemetaan Kursus per Posisi')).toBeTruthy());

    // Picker pegawai muncul dengan opsi karyawan yang sesuai departemen.
    await waitFor(() => expect(screen.getByText('Dewi Lestari (UJI-2026-0012)')).toBeTruthy());
    expect(screen.getByText('Budi Pratama (EMP-2026-0004)')).toBeTruthy();
    expect(screen.getByText(/Nama pegawai/i)).toBeTruthy();
  });

  it('generate dengan AI + pegawai terpilih mendaftarkan karyawan ke onboarding', async () => {
    render(<PositionCourseMappingPanel />);
    await waitFor(() => expect(screen.getByText('Generate dengan AI')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Dewi Lestari (UJI-2026-0012)')).toBeTruthy());

    fireEvent.change(screen.getByText(/Nama pegawai/i).closest('label')!.querySelector('select')!, {
      target: { value: 'b0000000-0000-4000-8000-000000000012' },
    });
    fireEvent.click(screen.getByText('Generate dengan AI'));

    // Generate posisi dipanggil DAN enroll pegawai ke onboarding juga dipanggil.
    await waitFor(() => expect((globalThis as any).__generateCalls()).toBe(1));
    await waitFor(() => expect((globalThis as any).__enrollCalls()).toBe(1));
    await waitFor(() => expect(screen.getByText(/didaftarkan ke onboarding/i)).toBeTruthy());
  });

  it('generate tanpa pegawai tidak memanggil endpoint onboarding', async () => {
    render(<PositionCourseMappingPanel />);
    await waitFor(() => expect(screen.getByText('Generate dengan AI')).toBeTruthy());

    fireEvent.click(screen.getByText('Generate dengan AI'));

    await waitFor(() => expect((globalThis as any).__generateCalls()).toBe(1));
    expect((globalThis as any).__enrollCalls()).toBe(0);
  });
});
