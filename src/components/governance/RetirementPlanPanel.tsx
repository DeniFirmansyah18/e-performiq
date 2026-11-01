'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Save, UserCheck, Users } from 'lucide-react';

/**
 * Panel manajemen pensiun: proyeksi karyawan yang mendekati usia pensiun,
 * penetapan pengganti (kaderisasi), dan status alih pengetahuan.
 */
const READINESS_OPTIONS = [
  { value: 'READY_NOW', label: 'Siap sekarang' },
  { value: 'READY_1_YEAR', label: 'Siap dalam 1 tahun' },
  { value: 'READY_2_YEAR', label: 'Siap dalam 2 tahun' },
  { value: 'NOT_READY', label: 'Belum siap' },
];

const TRANSFER_OPTIONS = [
  { value: 'NOT_STARTED', label: 'Belum dimulai' },
  { value: 'IN_PROGRESS', label: 'Sedang berjalan' },
  { value: 'COMPLETED', label: 'Selesai' },
];

export default function RetirementPlanPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/post-employment/retirement');
      const json = await res.json();
      if (res.ok) setData(json?.data ?? null);
    } catch {
      // biarkan kosong
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (row: any) => {
    setEditing(row.employeeId);
    setNotice(null);
    setForm({
      planned_retirement_date: row.plannedRetirementDate ?? row.projectedRetirementDate ?? '',
      successor_employee_id: row.successorEmployeeId ?? '',
      successor_readiness: row.successorReadiness ?? 'READY_1_YEAR',
      knowledge_transfer_status: row.knowledgeTransferStatus ?? 'NOT_STARTED',
      notes: row.notes ?? '',
    });
  };

  const save = async (employeeId: string) => {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch('/api/v1/post-employment/retirement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          planned_retirement_date: form.planned_retirement_date,
          successor_employee_id: form.successor_employee_id || null,
          successor_readiness: form.successor_readiness,
          knowledge_transfer_status: form.knowledge_transfer_status,
          notes: form.notes || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setNotice(json?.message ?? 'Rencana pensiun disimpan.');
        setEditing(null);
        void load();
      } else {
        setNotice(json?.detail || json?.error?.message || json?.message || 'Gagal menyimpan rencana pensiun.');
      }
    } catch (err: any) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  };

  const summary = data?.summary;
  const candidates: any[] = data?.candidates ?? [];

  return (
    <div className="p-5 rounded-2xl border border-[#e2e8f0] bg-white space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[#007a5a]" />
            <span>Manajemen Pensiun &amp; Kaderisasi</span>
          </h3>
          <p className="text-[11px] text-[#64748b]">
            Proyeksi usia pensiun 58 tahun, penetapan pengganti, dan status alih pengetahuan.
          </p>
        </div>
        {summary && (
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-bold text-[#007a5a] bg-[#e6f4f0] px-2 py-1 rounded-lg">
              {summary.dueWithin12Months} pensiun &lt; 12 bulan
            </span>
            <span className="text-[10px] font-bold text-[#0284c7] bg-[#e0f2fe] px-2 py-1 rounded-lg">
              {summary.dueWithin5Years} pensiun &lt; 5 tahun
            </span>
            <span className="text-[10px] font-bold text-[#b45309] bg-[#fef3c7] px-2 py-1 rounded-lg">
              {summary.withoutSuccessor} tanpa pengganti
            </span>
          </div>
        )}
      </div>

      {notice && (
        <p className="text-[11px] text-[#0f172a] bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="text-[11px] text-[#64748b]">Memuat proyeksi pensiun...</p>
      ) : candidates.length === 0 ? (
        <p className="text-[11px] text-[#64748b] p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] flex items-center gap-2">
          <Users className="h-3.5 w-3.5" /> Belum ada karyawan yang mendekati usia pensiun.
        </p>
      ) : (
        <div className="space-y-2">
          {candidates.map((row) => (
            <div key={row.employeeId} className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
              <div className="p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px]">
                  <p className="font-bold text-[#0f172a]">
                    {row.fullName} &middot; {row.positionTitle || '-'}
                  </p>
                  <p className="text-[#64748b]">
                    Usia {row.age ?? '-'} tahun &middot; proyeksi pensiun {row.projectedRetirementDate ?? '-'}
                    {row.departmentName ? ` &middot; ${row.departmentName}` : ''}
                  </p>
                  {row.successorName && (
                    <p className="text-[#007a5a] mt-1 flex items-center gap-1">
                      <UserCheck className="h-3 w-3" /> Pengganti: {row.successorName}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => (editing === row.employeeId ? setEditing(null) : startEdit(row))}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#e2e8f0] hover:bg-[#f1f5f9] text-[#007a5a] text-[11px] font-bold"
                >
                  {editing === row.employeeId ? 'Tutup' : 'Atur rencana'}
                </button>
              </div>

              {editing === row.employeeId && (
                <div className="border-t border-[#e2e8f0] p-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-[11px] text-[#0f172a] font-semibold">
                    Tanggal pensiun
                    <input
                      type="date"
                      value={form.planned_retirement_date ?? ''}
                      onChange={(e) => setForm({ ...form, planned_retirement_date: e.target.value })}
                      className="mt-1 w-full text-[11px] px-2 py-1.5 border border-[#e2e8f0] rounded-lg"
                    />
                  </label>
                  <label className="text-[11px] text-[#0f172a] font-semibold">
                    Kesiapan pengganti
                    <select
                      value={form.successor_readiness ?? ''}
                      onChange={(e) => setForm({ ...form, successor_readiness: e.target.value })}
                      className="mt-1 w-full text-[11px] px-2 py-1.5 border border-[#e2e8f0] rounded-lg"
                    >
                      {READINESS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] text-[#0f172a] font-semibold">
                    Alih pengetahuan
                    <select
                      value={form.knowledge_transfer_status ?? ''}
                      onChange={(e) => setForm({ ...form, knowledge_transfer_status: e.target.value })}
                      className="mt-1 w-full text-[11px] px-2 py-1.5 border border-[#e2e8f0] rounded-lg"
                    >
                      {TRANSFER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] text-[#0f172a] font-semibold">
                    Catatan
                    <input
                      type="text"
                      value={form.notes ?? ''}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Catatan kaderisasi"
                      className="mt-1 w-full text-[11px] px-2 py-1.5 border border-[#e2e8f0] rounded-lg"
                    />
                  </label>
                  <div className="sm:col-span-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => save(row.employeeId)}
                      disabled={saving || !form.planned_retirement_date}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00674c] text-white text-[11px] font-bold disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saving ? 'Menyimpan...' : 'Simpan rencana'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
