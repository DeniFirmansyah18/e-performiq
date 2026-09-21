import { NextRequest, NextResponse } from 'next/server';
import { DUMMY_KNOWLEDGE_HANDOVERS } from '@/lib/dummy-data';

interface Params {
  params: { id: string };
}

// PUT /api/v1/offboarding/handover/:id/verify
// PRD §11.2 — Memverifikasi serah terima dokumen/aset LWD
// PRD §3.3 PST-01 — Knowledge Handover & Asset Clearance (target 100% tuntas sebelum LWD)
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = params;
    const body = await req.json();
    const {
      verified_by_employee_id,
      verification_notes,
    } = body;

    if (!id) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/missing-parameter',
          title: 'Missing Parameter',
          status: 400,
          detail: 'ID serah terima (handover item ID) wajib disertakan di URL path.',
          instance: `/api/v1/offboarding/handover/${id}/verify`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!verified_by_employee_id) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/missing-verifier',
          title: 'Verifier Required',
          status: 422,
          detail: 'ID peverifikasi (verified_by_employee_id) wajib disertakan.',
          instance: `/api/v1/offboarding/handover/${id}/verify`,
          timestamp: new Date().toISOString(),
        },
        { status: 422 }
      );
    }

    // Lookup handover item
    const handoverItem = DUMMY_KNOWLEDGE_HANDOVERS.find((h) => h.id === id);

    if (!handoverItem) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/record-not-found',
          title: 'Handover Item Not Found',
          status: 404,
          detail: `Item serah terima dengan ID '${id}' tidak ditemukan.`,
          instance: `/api/v1/offboarding/handover/${id}/verify`,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check if already verified
    if (handoverItem.isVerified) {
      return NextResponse.json(
        {
          type: 'https://api.e-performiq.com/errors/already-verified',
          title: 'Item Already Verified',
          status: 409,
          detail: `Item serah terima '${handoverItem.itemName}' sudah diverifikasi sebelumnya.`,
          instance: `/api/v1/offboarding/handover/${id}/verify`,
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }

    // Simulate all items for this offboarding request
    const allSiblingItems = DUMMY_KNOWLEDGE_HANDOVERS.filter(
      (h) => h.offboardingRequestId === handoverItem.offboardingRequestId
    );

    const verifiedCount = allSiblingItems.filter((h) => h.isVerified).length + 1; // +1 for current
    const totalItems = allSiblingItems.length;
    const clearancePct = Number(((verifiedCount / totalItems) * 100).toFixed(1));
    const allCleared = verifiedCount >= totalItems;

    const verifiedAt = new Date().toISOString();

    return NextResponse.json({
      status: 'success',
      data: {
        handover_item_id: id,
        offboarding_request_id: handoverItem.offboardingRequestId,
        handover_item_name: handoverItem.itemName,
        category: handoverItem.category,
        is_verified: true,
        verified_by_employee_id,
        verification_notes: verification_notes ?? 'Serah terima diverifikasi oleh penerima tugas.',
        verified_at: verifiedAt,
        // PST-01 progress tracking
        clearance_progress: {
          verified_items: verifiedCount,
          total_items: totalItems,
          clearance_completion_pct: clearancePct,
          benchmark_target_pct: 100.0,
          all_cleared: allCleared,
        },
        // PRD §8: Can print clearance letter only when all items verified
        can_print_clearance_letter: allCleared,
        can_calculate_severance: allCleared,
        pst_01_status: allCleared
          ? 'COMPLETED — Semua item serah terima telah diverifikasi. Proses pencetakan surat bebas kewajiban dan kalkulasi pesangon dapat dilanjutkan.'
          : `IN_PROGRESS — ${verifiedCount}/${totalItems} item telah diverifikasi (${clearancePct}%). Selesaikan semua item sebelum LWD untuk memenuhi PST-01.`,
        audit_note: `Item '${handoverItem.itemName}' diverifikasi pada ${verifiedAt} oleh employee ID ${verified_by_employee_id}.`,
      },
    });
  } catch {
    return NextResponse.json(
      {
        type: 'https://api.e-performiq.com/errors/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Gagal memverifikasi item serah terima. Silakan coba kembali.',
        instance: '/api/v1/offboarding/handover',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
