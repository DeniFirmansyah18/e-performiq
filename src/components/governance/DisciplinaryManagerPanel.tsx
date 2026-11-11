'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus, Gavel } from 'lucide-react';
import ListPager from '@/components/ui/ListPager';
import { useAuth } from '@/lib/context/AuthContext';

interface Action {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  actionType: 'TEGURAN' | 'SP1' | 'SP2' | 'SP3';
  reason: string;
  effectiveDate: string;
  expiryDate: string | null;
  appealStatus: 'NONE' | 'UNDER_APPEAL' | 'APPEAL_ACCEPTED' | 'APPEAL_REJECTED';
  appealDeadline: string;
  appealReason: string | null;
  issuedByName: string | null;
}

interface EmployeeOption {
  employeeId: string;
  employeeCode: string;
  fullName: string;
}

const APPEAL_LABEL: Record<Action['appealStatus'], string> = {
  NONE: 'Belum diajukan',
  UNDER_APPEAL: 'Menunggu keputusan',
  APPEAL_ACCEPTED: 'Keberatan diterima',
  APPEAL_REJECTED: 'Keberatan ditolak',
};

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export default function DisciplinaryManagerPanel() {
  const [actions, setActions] = useState<Action[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { activeRole } = useAuth();
  const canWrite = activeRole === 'HR_MANAGER' || activeRole === 'SUPER_ADMIN';

  const [form, setForm] = useState({
    employeeId: '',
    actionType: 'SP1' as Action['actionType'],
    reason: '',
    effectiveDate: today(),
    expiryDate: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, e] = await Promise.all([
        fetch('/api/v1/hr/disciplinary-actions').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/v1/hr/employee-directory').then((r) => (r.ok ? r.json() : null)),
      ]);
      setActions(a?.data?.items ?? []);
      setEmployees(e?.data?.employees ?? []);
    } catch {
      /* biarkan kosong */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const issue = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/v1/hr/disciplinary-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: form.employeeId,
          actionType: form.actionType,
          reason: form.reason,
          effectiveDate: form.effectiveDate,
          expiryDate: form.expiryDate || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice(json?.detail ?? 'Gagal menerbitkan sanksi.'); return; }
      setNotice('Sanksi diterbitkan.');
      setForm((f) => ({ ...f, reason: '', expiryDate: '' }));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const decideAppeal = async (id: string, decision: 'APPEAL_ACCEPTED' | 'APPEAL_REJECTED') => {
    const note = window.prompt('Catatan keputusan (wajib, minimal 5 karakter):') ?? '';
    if (note.trim().length < 5) { setNotice('Catatan keputusan minimal 5 karakter.'); return; }

    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/hr/disciplinary-actions/${id}/appeal`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice(json?.detail ?? 'Gagal menyimpan keputusan.'); return; }
      setNotice(decision === 'APPEAL_ACCEPTED' ? 'Keberatan diterima.' : 'Keberatan ditolak.');
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl border border-[#e2e8f0] bg-white space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#b45309]" aria-hidden="true" />
            <span>Sanksi & Keberatan</span>
          </h3>
          <p className="text-[11px] text-[#64748b]">
            Terbitkan sanksi dan putuskan keberatan karyawan dalam 5 hari kerja.
          </p>
        </div>
        <span className="text-[10px] font-bold text-[#b45309] bg-[#fef3c7] px-2 py-1 rounded-lg">
          {actions.filter((a) => a.appealStatus === 'UNDER_APPEAL').length} keberatan menunggu
        </span>
      </div>

      {notice && (
        <p className="text-[11px] text-[#0f172a] bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      {/* Form penerbitan */}
      {canWrite && (
      <div className="rounded-xl border border-[#e2e8f0] p-3 space-y-2">
        <p className="text-[11px] font-bold text-[#0f172a] flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Terbitkan Sanksi
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] text-[#475569]">
            Karyawan
            <select
              value={form.employeeId}
              onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            >
              <option value="">Pilih karyawan…</option>
              {employees.map((e) => (
                <option key={e.employeeId} value={e.employeeId}>
                  {e.fullName} — {e.employeeCode}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-[#475569]">
            Jenis sanksi
            <select
              value={form.actionType}
              onChange={(e) => setForm((f) => ({ ...f, actionType: e.target.value as Action['actionType'] }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            >
              <option value="TEGURAN">Teguran</option>
              <option value="SP1">SP1</option>
              <option value="SP2">SP2</option>
              <option value="SP3">SP3</option>
            </select>
          </label>
          <label className="text-[11px] text-[#475569] sm:col-span-2">
            Alasan
            <textarea
              value={form.reason}
              rows={2}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-[11px] text-[#475569]">
            Tanggal efektif
            <input
              type="date"
              value={form.effectiveDate}
              onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-[11px] text-[#475569]">
            Berlaku sampai (opsional)
            <input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={issue}
          className="rounded-lg bg-[#b45309] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#92400e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b45309] focus-visible:ring-offset-2 disabled:opacity-50"
        >
          Terbitkan sanksi
        </button>
      </div>
      )}

      {loading && <p className="text-[11px] text-[#64748b]">Memuat sanksi…</p>}

      {!loading && (
        <ListPager
          items={actions}
          itemKey={(a) => a.id}
          itemLabel="sanksi"
          emptyMessage="Belum ada sanksi tercatat."
          searchPlaceholder="Cari nama, jenis sanksi, atau alasan..."
          searchText={(a) => `${a.employeeName} ${a.employeeCode} ${a.actionType} ${APPEAL_LABEL[a.appealStatus]} ${a.reason} ${a.appealReason ?? ''}`}
          maxHeight="460px"
          renderItem={(a) => (
            <div className="rounded-lg border border-[#e2e8f0] px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[#0f172a]">{a.actionType}</span>
                <span className="text-[10px] text-[#94a3b8]">{String(a.effectiveDate).slice(0, 10)}</span>
                <span className="rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] font-bold text-[#475569]">
                  {APPEAL_LABEL[a.appealStatus]}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#475569]">
                {a.employeeName} · {a.employeeCode} · {a.reason}
              </p>
              {a.appealReason && (
                <p className="mt-0.5 text-[10px] text-[#64748b]">Keberatan: {a.appealReason}</p>
              )}

              {a.appealStatus === 'UNDER_APPEAL' && canWrite && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => decideAppeal(a.id, 'APPEAL_ACCEPTED')}
                    aria-label={`Terima keberatan ${a.employeeName}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#007a5a] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    <Gavel className="h-3 w-3" aria-hidden="true" /> Terima keberatan
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => decideAppeal(a.id, 'APPEAL_REJECTED')}
                    aria-label={`Tolak keberatan ${a.employeeName}`}
                    className="rounded-lg border border-[#b91c1c] px-2.5 py-1 text-[10px] font-semibold text-[#b91c1c] hover:bg-[#fef2f2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b91c1c] focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    Tolak keberatan
                  </button>
                </div>
              )}
            </div>
          )}
        />
      )}
    </div>
  );
}
