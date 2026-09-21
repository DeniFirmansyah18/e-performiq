import { NextRequest, NextResponse } from 'next/server';
import { calculateSeverance } from '@/lib/engines/severance-engine';
import { DUMMY_OFFBOARDING as DUMMY_OFFBOARDING_REQUESTS, DUMMY_KNOWLEDGE_HANDOVERS } from '@/lib/dummy-data';

// POST /api/v1/offboarding/calculate-severance
// PRD §11.2 — Menghitung hak pesangon/DPLK berdasar PP 35/2021
// PRD §5.3 — Pension & Severance Handover Estimator
// PRD §8 Acceptance Criteria: Pesangon tidak dapat dicetak jika clearance belum 100%
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      offboarding_request_id,
      employee_id,
      service_years,
      base_salary_idr,
      reason_for_leaving,
      dplk_account_balance,
      include_dplk_topup,
    } = body;

    // Validate required fields
    if (!employee_id || !service_years || !base_salary_idr || !reason_for_leaving) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/validation-failed',
          title: 'Validation Error',
          status: 422,
          detail: 'Kolom employee_id, service_years, base_salary_idr, dan reason_for_leaving wajib diisi.',
          instance: '/api/v1/offboarding/calculate-severance',
          timestamp: new Date().toISOString(),
        },
        { status: 422 }
      );
    }

    // PRD §8 Acceptance Criteria: Check clearance completion status
    if (offboarding_request_id) {
      const offboardingReq = DUMMY_OFFBOARDING_REQUESTS.find((r) => r.id === offboarding_request_id);
      if (offboardingReq) {
        const handoverItems = DUMMY_KNOWLEDGE_HANDOVERS.filter(
          (h) => h.offboardingRequestId === offboarding_request_id
        );
        const unverifiedItems = handoverItems.filter((h) => !h.isVerified);
        if (unverifiedItems.length > 0) {
          return NextResponse.json(
            {
              type: 'https://api.e-performiq.com/errors/clearance-incomplete',
              title: 'Clearance Not Completed (PRD §8)',
              status: 422,
              detail: `Kalkulasi dan pencetakan pesangon tidak dapat dilakukan. Masih terdapat ${unverifiedItems.length} item serah terima yang belum diverifikasi. Selesaikan seluruh Knowledge Handover & Asset Clearance sebelum LWD (PST-01 Target: 100%).`,
              instance: '/api/v1/offboarding/calculate-severance',
              timestamp: new Date().toISOString(),
              pending_items: unverifiedItems.map((i) => ({
                item_id: i.id,
                item_name: i.itemName,
                category: i.category,
              })),
              gcg_rule: 'PRD §8 — Nol deviasi otorisasi sebelum clearance selesai',
            },
            { status: 422 }
          );
        }
      }
    }

    // Use the severance engine (PP 35/2021)
    const reasonMap: Record<string, 'RESIGNATION' | 'PENSION' | 'EFFICIENCY' | 'CONTRACT_END'> = {
      'RESIGNATION': 'RESIGNATION',
      'VOLUNTARY_RESIGN': 'RESIGNATION',
      'PENSIUN': 'PENSION',
      'PENSION': 'PENSION',
      'PHK_EFISIENSI': 'EFFICIENCY',
      'EFFICIENCY': 'EFFICIENCY',
      'CONTRACT_END': 'CONTRACT_END',
      'KONTRAK_SELESAI': 'CONTRACT_END',
    };
    const reasonType = reasonMap[reason_for_leaving.toUpperCase()] ?? 'RESIGNATION';

    const severanceResult = calculateSeverance({
      serviceYears: Number(service_years),
      baseSalary: Number(base_salary_idr),
      reasonType,
      dplkTopup: dplk_account_balance ?? 0,
    });

    const calculationId = `sev-calc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return NextResponse.json({
      status: 'success',
      data: {
        calculation_id: calculationId,
        offboarding_request_id: offboarding_request_id ?? null,
        employee_id,
        regulatory_basis: 'PP No. 35 Tahun 2021 (Turunan UU Cipta Kerja No. 6/2023)',
        input_parameters: {
          service_years: Number(service_years),
          base_salary_idr: Number(base_salary_idr),
          reason_for_leaving,
        },
        calculation_breakdown: {
          severance_pay_up: {
            amount_idr: severanceResult.severancePay,
            formula: 'PP 35/2021 Pasal 40-43: Uang Pesangon (UP) berdasar masa kerja',
            months_multiplier: severanceResult.upMultiplier,
          },
          service_appreciation_upmk: {
            amount_idr: severanceResult.serviceAppreciationPay,
            formula: 'PP 35/2021 Pasal 40-43: Uang Penghargaan Masa Kerja (UPMK)',
            months_multiplier: severanceResult.upmkMultiplier,
          },
          compensation_uph: {
            amount_idr: severanceResult.compensationPay,
            formula: 'PP 35/2021: Uang Penggantian Hak (UPH) = 15% × (UP + UPMK)',
            rate_pct: 15,
          },
          dplk_program: {
            topup_amount: severanceResult.dplkTopup,
            employer_topup: include_dplk_topup ? (severanceResult.dplkTopup * 0.5) : 0,
            is_included: include_dplk_topup ?? true,
          },
        },
        total_gross_disbursement_idr: severanceResult.totalDisbursement,
        sla_disbursement: {
          target_days_from_lwd: 7,
          target_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
          pst_04_target: 'Dibayarkan ≤ 7 hari kerja dari LWD (PST-04)',
        },
        payment_channel: 'Bank Transfer Host-to-Host (H2H) — MANDIRI / BCA',
        is_paid: false,
        payment_reference_no: null,
        gcg_clearance_verified: !!offboarding_request_id,
        calculated_at: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      {
        type: 'https://api.e-performiq.com/errors/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Gagal menghitung pesangon. Silakan coba kembali.',
        instance: '/api/v1/offboarding/calculate-severance',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
