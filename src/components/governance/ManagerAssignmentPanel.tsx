'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Check } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import { useAuth } from '@/lib/context/AuthContext';

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
  const { activeRole } = useAuth();
  const canWrite = activeRole === 'HR_MANAGER' || activeRole === 'SUPER_ADMIN';
  const [rows, setRows] = useState<DirRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      // Direktori (employment:read) agar atasan langsung & BOD dapat memantau;
      // penyimpanan penugasan tetap terbatas pada HR lewat PATCH di bawah.
      const res = await fetch('/api/v1/hr/employee-directory');
      if (!res.ok) { setErr('Anda tidak berwenang melihat data karyawan.'); return; }
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
            <p className="text-[11px] text-[#64748b]">
              {canWrite
                ? 'Tetapkan approver / atasan langsung tiap karyawan (dipakai untuk persetujuan timesheet, finalisasi KPI, dll.).'
                : 'Pantau atasan langsung tiap karyawan. Penetapan hanya dapat dilakukan HR.'}
            </p>
          </div>
        </div>
      </div>

      {err && <p className="text-[11px] font-semibold text-rose-600 mb-2">{err}</p>}
      {msg && <p className="text-[11px] font-semibold text-[#137333] mb-2">{msg}</p>}

      {loading ? (
        <p className="text-xs text-[#64748b]">Memuat…</p>
      ) : (
        <DataTable
          rows={filtered}
          rowKey={(r) => r.employeeId}
          searchPlaceholder="Cari nama / NIP / unit…"
          initialSearch={search}
          itemLabel="karyawan"
          emptyMessage="Belum ada data karyawan."
          columns={[
            { key: 'nip', header: 'NIP', value: (r) => r.employeeCode, render: (r) => <span className="font-mono text-[#334155]">{r.employeeCode ?? '—'}</span> },
            { key: 'nama', header: 'Nama', value: (r) => r.fullName, render: (r) => <span className="font-semibold text-[#0f172a]">{r.fullName}</span> },
            { key: 'unit', header: 'Unit', value: (r) => r.department, render: (r) => <span className="text-[#64748b]">{r.department ?? '—'}</span> },
            {
              key: 'atasan',
              header: 'Atasan Langsung',
              value: (r) => rows.find((c) => c.employeeId === r.managerId)?.fullName ?? '',
              render: (r) => (
                <div className="flex items-center">
                  <select
                    value={r.managerId ?? ''}
                    disabled={!canWrite || busyId === r.employeeId}
                    onChange={(e) => assign(r.employeeId, e.target.value || null)}
                    aria-label={`Atasan langsung ${r.fullName}`}
                    className="rounded-lg border border-[#e2e8f0] px-2 py-1 text-xs bg-white disabled:opacity-60 disabled:bg-[#f8fafc] min-w-[190px]"
                  >
                    <option value="">— Belum ditetapkan —</option>
                    {rows
                      .filter((c) => c.employeeId !== r.employeeId)
                      .map((c) => (
                        <option key={c.employeeId} value={c.employeeId}>{c.fullName}</option>
                      ))}
                  </select>
                  {busyId === r.employeeId && <Check className="inline h-3 w-3 ml-2 text-[#137333]" />}
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
