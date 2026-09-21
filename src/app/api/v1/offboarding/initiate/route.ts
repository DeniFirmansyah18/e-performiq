import { NextRequest, NextResponse } from 'next/server';
import { DUMMY_OFFBOARDING as DUMMY_OFFBOARDING_REQUESTS } from '@/lib/dummy-data';

// POST /api/v1/offboarding/initiate
// PRD §11.2 — Memulai proses resign/pensiun dan aktivasi checklist
// PRD §5.3 — Digital Clearance Workflow: Knowledge Transfer Checklist
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      employee_id,
      reason_for_leaving,
      resignation_notice_date,
      last_working_day,
      is_regrettable_attrition,
    } = body;

    // Validate required fields
    if (!employee_id || !reason_for_leaving || !resignation_notice_date || !last_working_day) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/validation-failed',
          title: 'Validation Error',
          status: 422,
          detail: 'Kolom employee_id, reason_for_leaving, resignation_notice_date, dan last_working_day wajib diisi.',
          instance: '/api/v1/offboarding/initiate',
          timestamp: new Date().toISOString(),
        },
        { status: 422 }
      );
    }

    // Validate date ordering
    const noticeDate = new Date(resignation_notice_date);
    const lwdDate = new Date(last_working_day);
    if (lwdDate <= noticeDate) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/invalid-date-range',
          title: 'Invalid Date Range',
          status: 422,
          detail: 'Tanggal last_working_day harus setelah resignation_notice_date.',
          instance: '/api/v1/offboarding/initiate',
          timestamp: new Date().toISOString(),
        },
        { status: 422 }
      );
    }

    // Check for existing active offboarding request
    const existingRequest = DUMMY_OFFBOARDING_REQUESTS.find(
      (r) => r.employeeId === employee_id && r.status !== 'COMPLETED'
    );
    if (existingRequest) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/duplicate-offboarding',
          title: 'Active Offboarding Request Exists',
          status: 409,
          detail: `Karyawan '${employee_id}' sudah memiliki proses offboarding aktif (ID: ${existingRequest.id}, Status: ${existingRequest.status}). Selesaikan proses yang ada terlebih dahulu.`,
          instance: '/api/v1/offboarding/initiate',
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }

    const offboardingId = `offboard-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const noticePeriodDays = Math.ceil((lwdDate.getTime() - noticeDate.getTime()) / (1000 * 60 * 60 * 24));

    // Auto-generate clearance checklist per PRD §5.3
    const clearanceChecklist = [
      {
        item_id: `chk-${offboardingId}-01`,
        category: 'DOCUMENTATION',
        item_name: 'Serah Terima Dokumen Proyek & SOP Operasional',
        handover_to: 'PEOPLE_MANAGER',
        is_verified: false,
        deadline: last_working_day,
      },
      {
        item_id: `chk-${offboardingId}-02`,
        category: 'SOURCE_CODE',
        item_name: 'Transfer Repositori Kode & Akses GitHub Enterprise',
        handover_to: 'TECH_LEAD',
        is_verified: false,
        deadline: last_working_day,
      },
      {
        item_id: `chk-${offboardingId}-03`,
        category: 'ACCESS_KEY',
        item_name: 'Revoke Akses VPN, Cloud AWS, & Sistem Internal',
        handover_to: 'IT_SECURITY',
        is_verified: false,
        deadline: last_working_day,
      },
      {
        item_id: `chk-${offboardingId}-04`,
        category: 'PHYSICAL_ASSET',
        item_name: 'Pengembalian Laptop, Badge, & Perangkat Perusahaan',
        handover_to: 'IT_ASSET_MANAGEMENT',
        is_verified: false,
        deadline: last_working_day,
      },
      {
        item_id: `chk-${offboardingId}-05`,
        category: 'DOCUMENTATION',
        item_name: 'Audit Keuangan Operasional & Reimbursement Settlement',
        handover_to: 'FINANCE',
        is_verified: false,
        deadline: last_working_day,
      },
    ];

    return NextResponse.json(
      {
        status: 'success',
        message: 'Proses offboarding berhasil diinisiasi. Checklist serah terima otomatis dibuat.',
        data: {
          offboarding_id: offboardingId,
          employee_id,
          reason_for_leaving,
          resignation_notice_date,
          last_working_day,
          notice_period_days: noticePeriodDays,
          is_regrettable_attrition: is_regrettable_attrition ?? false,
          status: 'INITIATED',
          clearance_status: 'CLEARANCE_IN_PROGRESS',
          clearance_completion_pct: 0,
          // PRD §8 Acceptance Criteria: clearance tidak bisa dicetak sampai semua item verified
          can_print_clearance_letter: false,
          can_calculate_severance: false,
          block_reason: 'PST-01: Surat bebas kewajiban tidak dapat dicetak. Pastikan seluruh 5 item checklist berstatus Completed sebelum LWD.',
          clearance_checklist: clearanceChecklist,
          next_steps: [
            'Verifikasi setiap item checklist via PUT /api/v1/offboarding/handover/:id/verify',
            'Hitung pesangon via POST /api/v1/offboarding/calculate-severance setelah clearance selesai',
            'Jadwalkan Exit Interview via POST /api/v1/offboarding/exit-interview',
          ],
          created_at: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        type: 'https://api.e-performiq.com/errors/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Gagal menginisiasi proses offboarding. Silakan coba kembali.',
        instance: '/api/v1/offboarding/initiate',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
