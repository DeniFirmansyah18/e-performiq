'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Check } from 'lucide-react';

interface DirRow {
  employeeId: string;
  employeeCode: string | null;
  fullName: string;
  department: string | null;
  position: string | null;
  managerId: string | null;
  managerName: string | null;
}

/** Panel HR: menetapkan atasan langsung (manager_id) tiap karyawan. */
export default function ManagerAssignmentPanel() {
  const [rows, setRows] = useState<DirRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/v1/hr/employees');
      if (!res.ok) { setErr('Anda tidak berwenang mengelola data karyawan.'); return; }
      const json = await res.json();
      setRows(json?.data?.employees ?? []);
    } catch {
      setErr('Gagal memuat data karyawan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.fullName.toLowerCase().includes(q) ||
      (r.employeeCode ?? '').toLowerCase().includes(q) ||
      (r.department ?? '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const assign = async (employeeId: string, managerId: string | null) => {
    setBusyId(employeeId); setErr(null); setMsg(null);
    try {
      const res = await fetch(`/api/v1/hr/employees/${employeeId}/manager`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: managerId }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg('Atasan langsung diperbarui.');
        setRows((prev) => prev.map((r) => r.employeeId === employeeId
          ? { ...r, managerId, managerName: rows.find((x) => x.employeeId === managerId)?.fullName ?? null }
          : r));
      } else {
        setErr(j?.detail || j?.message || 'Gagal memperbarui atasan.');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="stitch-card-white p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#e6f4ea] text-[#137333]"><Users className="h-4 w-4" /></div>
          <div>
            <h3 className="text-sm font-extrabold text-[#0f172a]">Penugasan Atasan Langsung</h3>
            <p className="text-[11px] text-[#64748b]">Tetapkan approver / atasan langsung tiap karyawan (dipakai untuk persetujuan timesheet, finalisasi KPI, dll.).</p>
          </div>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / NIP / unit…"
          className="rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-xs w-56" />
      </div>

      {err && <p className="text-[11px] font-semibold text-rose-600 mb-2">{err}</p>}
      {msg && <p className="text-[11px] font-semibold text-[#137333] mb-2">{msg}</p>}

      {loading ? (
        <p className="text-xs text-[#64748b]">Memuat…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-[#94a3b8] border-b border-[#e2e8f0]">
                <th className="py-2 pr-3">NIP</th>
                <th className="py-2 pr-3">Nama</th>
                <th className="py-2 pr-3">Unit</th>
                <th className="py-2 pr-3">Atasan Langsung</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.employeeId} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="py-2 pr-3 font-mono text-[#334155]">{r.employeeCode ?? '—'}</td>
                  <td className="py-2 pr-3 font-semibold text-[#0f172a]">{r.fullName}</td>
                  <td className="py-2 pr-3 text-[#64748b]">{r.department ?? '—'}</td>
                  <td className="py-2 pr-3">
                    <select
                      value={r.managerId ?? ''}
                      disabled={busyId === r.employeeId}
                      onChange={(e) => assign(r.employeeId, e.target.value || null)}
                      className="rounded-lg border border-[#e2e8f0] px-2 py-1 text-xs bg-white disabled:opacity-50 min-w-[190px]"
                    >
                      <option value="">— Belum ditetapkan —</option>
                      {rows
                        .filter((c) => c.employeeId !== r.employeeId)
                        .map((c) => (
                          <option key={c.employeeId} value={c.employeeId}>{c.fullName}</option>
                        ))}
                    </select>
                    {busyId === r.employeeId && <Check className="inline h-3 w-3 ml-2 text-[#137333]" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
