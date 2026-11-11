'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Check, Inbox, X } from 'lucide-react';
import ListPager from '@/components/ui/ListPager';

// Panel persetujuan cuti (HR/atasan). Fase POST-employment: pengajuan cuti
// diteruskan ke antrean approval lewat GET ?scope=pending, keputusan via PATCH.
export default function LeaveApprovalPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/governance/leaves?scope=pending');
      if (res.ok) {
        const json = await res.json();
        setItems(json?.data?.items ?? []);
      }
    } catch {
      // antrean kosong
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    setBusyId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/governance/leaves/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const json = await res.json();
      if (res.ok) {
        setNotice(json?.message || (decision === 'APPROVED' ? 'Cuti disetujui.' : 'Cuti ditolak.'));
        void load();
      } else {
        setNotice(json?.detail || json?.error?.message || 'Gagal memproses keputusan.');
      }
    } catch (err: any) {
      setNotice(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-5 rounded-2xl border border-[#e2e8f0] bg-white space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#0284c7]" />
            <span>Persetujuan Cuti & Izin</span>
          </h3>
          <p className="text-[11px] text-[#64748b]">Antrean permohonan cuti karyawan yang menunggu keputusan.</p>
        </div>
        <span className="text-[10px] font-bold text-[#0284c7] bg-[#e0f2fe] px-2 py-1 rounded-lg">
          {items.length} menunggu
        </span>
      </div>

      {notice && (
        <p className="text-[11px] text-[#0f172a] bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg px-3 py-2">{notice}</p>
      )}

      {loading ? (
        <p className="text-[11px] text-[#64748b]">Memuat antrean...</p>
      ) : (
        <ListPager
          items={items}
          itemKey={(l) => l.id}
          itemLabel="permohonan"
          emptyMessage="Tidak ada permohonan cuti yang menunggu persetujuan."
          searchPlaceholder="Cari nama pegawai atau jenis cuti..."
          searchText={(l) => `${l.employeeName ?? l.employeeId} ${l.leaveType} ${l.reason ?? ''}`}
          maxHeight="440px"
          renderItem={(l) => (
            <div className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between gap-3">
              <div className="text-[11px]">
                <p className="font-bold text-[#0f172a]">
                  {l.employeeName || l.employeeId} · {l.leaveType} · {l.totalDays} hari
                </p>
                <p className="text-[#64748b]">{l.startDate} s/d {l.endDate} — {l.reason}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => decide(l.id, 'APPROVED')}
                  disabled={busyId === l.id}
                  className="px-3 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00674c] text-white text-[11px] font-bold flex items-center gap-1 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> Setujui
                </button>
                <button
                  onClick={() => decide(l.id, 'REJECTED')}
                  disabled={busyId === l.id}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#b91c1c] text-[11px] font-bold flex items-center gap-1 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" /> Tolak
                </button>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
