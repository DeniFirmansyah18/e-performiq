'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Plus, ShieldCheck } from 'lucide-react';

/**
 * Panel kewajiban pasca-kerja (BPJS, 1721-A1, DPLK, penutupan berkas).
 * Kewajiban dibuat otomatis dari template standar lalu ditandai selesai.
 */
export default function PostEmploymentCompliancePanel() {
  const [data, setData] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/post-employment/obligations');
      const json = await res.json();
      if (res.ok) setData(json?.data ?? null);
    } catch {
      // abaikan
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void (async () => {
      try {
        const res = await fetch('/api/v1/hr/employee-directory');
        if (res.ok) {
          const json = await res.json();
          const list = json?.data?.items ?? json?.data ?? [];
          setEmployees(Array.isArray(list) ? list : []);
        }
      } catch {
        // abaikan
      }
    })();
  }, [load]);

  const generate = async () => {
    if (!employeeId) return;
    setBusy('generate');
    setNotice(null);
    try {
      const res = await fetch('/api/v1/post-employment/obligations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId }),
      });
      const json = await res.json();
      if (res.ok) {
        setNotice(json?.message ?? 'Kewajiban pasca-kerja dibuat.');
        void load();
      } else {
        setNotice(json?.detail || json?.error?.message || json?.message || 'Gagal membuat kewajiban.');
      }
    } catch (err: any) {
      setNotice(err.message);
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (id: string, isCompleted: boolean) => {
    setBusy(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/post-employment/obligations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: isCompleted }),
      });
      const json = await res.json();
      setNotice(res.ok ? json?.message ?? 'Status kewajiban diperbarui.' : json?.detail || json?.message || 'Gagal memperbarui.');
      if (res.ok) void load();
    } catch (err: any) {
      setNotice(err.message);
    } finally {
      setBusy(null);
    }
  };

  const rows: any[] = data?.obligations ?? [];
  const summary = data?.summary;
  const statusTone: Record<string, string> = {
    DONE: 'text-[#007a5a]',
    OVERDUE: 'text-[#b91c1c]',
    DUE_SOON: 'text-[#b45309]',
    OPEN: 'text-[#64748b]',
  };

  return (
    <div className="p-5 rounded-2xl border border-[#e2e8f0] bg-white space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#007a5a]" />
            <span>Kepatuhan Pasca-Kerja</span>
          </h3>
          <p className="text-[11px] text-[#64748b]">
            Kewajiban administrasi setelah karyawan keluar: penonaktifan BPJS, 1721-A1, DPLK, dan penutupan berkas.
          </p>
        </div>
        {summary && (
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-bold text-[#007a5a] bg-[#e6f4f0] px-2 py-1 rounded-lg">
              {summary.completionPercentage}% selesai
            </span>
            <span className="text-[10px] font-bold text-[#b91c1c] bg-[#fef2f2] px-2 py-1 rounded-lg">
              {summary.overdue} terlambat
            </span>
            <span className="text-[10px] font-bold text-[#b45309] bg-[#fef3c7] px-2 py-1 rounded-lg">
              {summary.dueSoon} segera jatuh tempo
            </span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 flex flex-wrap items-end gap-2">
        <label className="text-[11px] font-semibold text-[#0f172a] flex-1 min-w-[200px]">
          Buat kewajiban untuk karyawan
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="mt-1 w-full text-[11px] px-2 py-1.5 border border-[#e2e8f0] rounded-lg"
          >
            <option value="">— Pilih karyawan —</option>
            {employees.map((emp) => {
              const id = emp.employeeId ?? emp.id;
              return (
                <option key={id} value={id}>
                  {emp.fullName ?? emp.full_name ?? emp.name}
                  {emp.employeeCode ? ` (${emp.employeeCode})` : ''}
                </option>
              );
            })}
          </select>
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={busy === 'generate' || !employeeId}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00674c] text-white text-[11px] font-bold disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> {busy === 'generate' ? 'Membuat...' : 'Buat kewajiban'}
        </button>
      </div>

      {notice && (
        <p className="text-[11px] text-[#0f172a] bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="text-[11px] text-[#64748b]">Memuat daftar kewajiban...</p>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-[#64748b] p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center gap-2">
          <ClipboardList className="h-3.5 w-3.5" /> Belum ada kewajiban pasca-kerja tercatat.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((o) => (
            <div
              key={o.id}
              className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2"
            >
              <div className="text-[11px]">
                <p className="font-bold text-[#0f172a]">
                  {o.title} &middot; {o.employeeName}
                </p>
                <p className="text-[#64748b]">
                  Jatuh tempo {o.dueDate} &middot;{' '}
                  <span className={`font-semibold ${statusTone[o.status] ?? ''}`}>{o.statusLabel}</span>
                  {o.daysRemaining >= 0 && !o.isCompleted ? ` · sisa ${o.daysRemaining} hari` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(o.id, !o.isCompleted)}
                disabled={busy === o.id}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border disabled:opacity-50 ${
                  o.isCompleted
                    ? 'bg-white border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9]'
                    : 'bg-[#007a5a] border-[#007a5a] text-white hover:bg-[#00674c]'
                }`}
              >
                {o.isCompleted ? 'Batalkan' : 'Tandai selesai'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
