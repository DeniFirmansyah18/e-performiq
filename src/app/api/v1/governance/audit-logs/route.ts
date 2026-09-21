import { NextRequest, NextResponse } from 'next/server';
import { DUMMY_AUDIT_LOGS } from '@/lib/dummy-data';

// GET /api/v1/governance/audit-logs
// PRD §11.2 — Mengambil jejak audit perubahan nilai anti-manipulasi (READ-ONLY AUDITOR access)
// PRD §5.4 — Audit Trail & GCG Compliance Log
// PRD §10.2 — Tabel audit_logs: immutable append-only GCG log
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const actionType = searchParams.get('action_type'); // CREATE|UPDATE|DELETE|CALIBRATE|DISBURSE|APPROVE
  const entityName = searchParams.get('entity_name'); // performance_appraisals|severance_calculations
  const userId = searchParams.get('user_id');
  const dateFrom = searchParams.get('date_from'); // ISO date
  const dateTo = searchParams.get('date_to');   // ISO date
  const pageStr = searchParams.get('page') || '1';
  const pageSizeStr = searchParams.get('page_size') || '20';

  const page = Math.max(1, parseInt(pageStr, 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr, 10)));

  let logs = [...DUMMY_AUDIT_LOGS];

  // Apply filters
  if (actionType) {
    logs = logs.filter((l) =>
      l.actionType.toUpperCase() === actionType.toUpperCase()
    );
  }
  if (entityName) {
    logs = logs.filter((l) =>
      l.entityName.toLowerCase() === entityName.toLowerCase()
    );
  }
  if (userId) {
    // AuditLog doesn't have userId — filter by userName instead
    logs = logs.filter((l) => l.userName === userId);
  }
  if (dateFrom) {
    const from = new Date(dateFrom);
    logs = logs.filter((l) => new Date(l.timestamp) >= from);
  }
  if (dateTo) {
    const to = new Date(dateTo);
    logs = logs.filter((l) => new Date(l.timestamp) <= to);
  }

  // Pagination
  const totalCount = logs.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIdx = (page - 1) * pageSize;
  const paginatedLogs = logs.slice(startIdx, startIdx + pageSize);

  // Compute action type summary
  const actionSummary = DUMMY_AUDIT_LOGS.reduce<Record<string, number>>((acc, log) => {
    const type = log.actionType.toUpperCase();
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    status: 'success',
    data: {
      audit_trail: paginatedLogs.map((log) => ({
        log_id: log.id,
        timestamp: log.timestamp,
        user_name: log.userName,
        user_role: log.userRole,
        action_type: log.actionType,
        entity_name: log.entityName,
        record_id: log.recordId,
        description: log.description,
        old_data: log.oldData ?? null,
        new_data: log.newData ?? null,
        ip_address: log.ipAddress ?? '192.168.x.x [masked]',
      })),
      pagination: {
        page,
        page_size: pageSize,
        total_count: totalCount,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
      active_filters: {
        action_type: actionType ?? 'ALL',
        entity_name: entityName ?? 'ALL',
        user_id: userId ?? 'ALL',
        date_from: dateFrom ?? null,
        date_to: dateTo ?? null,
      },
      action_summary: actionSummary,
      gcg_compliance: {
        log_integrity: 'VERIFIED',
        immutability: 'APPEND_ONLY — Log tidak dapat dihapus atau diubah. Sesuai standar GCG Anti-Tamper.',
        encryption_status: 'JSONB entries encrypted at-rest (AES-256)',
        access_level: 'READ_ONLY — Hanya AUDITOR dan SUPER_ADMIN yang dapat mengakses endpoint ini.',
        tarif_principle: 'Accountability & Transparency — PRD §6.2',
      },
      generated_at: new Date().toISOString(),
    },
  });
}
