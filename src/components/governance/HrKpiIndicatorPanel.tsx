'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import KpiIndicatorPanel, { type RosterMember } from './KpiIndicatorPanel';

const DEFAULT_PERIOD_ID = 'd0000000-0000-4000-8000-000000000001';

/**
 * Pembungkus `KpiIndicatorPanel` untuk HR: mengambil roster lintas divisi dari
 * `/performance/team-roster` (cakupan `resolveVisibleEmployeeIds` untuk HR
 * adalah seluruh karyawan aktif) sehingga HR tidak perlu memilih orang per orang.
 */
export default function HrKpiIndicatorPanel({ periodId = DEFAULT_PERIOD_ID }: { periodId?: string }) {
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/performance/team-roster?period_id=${periodId}`);
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.detail ?? 'Gagal memuat roster karyawan');
        const rows: Array<Record<string, any>> = json?.data?.members ?? [];
        if (!active) return;
        setMembers(
          rows.map((r) => ({
            employeeId: String(r.employeeId),
            fullName: String(r.fullName ?? '—'),
            employeeCode: r.employeeCode ?? undefined,
            position: r.position ?? undefined,
            department: r.department ?? undefined,
          }))
        );
      } catch (err) {
        if (active) setError((err as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [periodId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-[#64748b] py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat roster karyawan…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 rounded-lg bg-[#fce8e6] border border-[#f5c6c2] text-xs font-semibold text-[#c5221f] flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  return <KpiIndicatorPanel members={members} periodId={periodId} />;
}
