'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { GitBranch, Plus, Trash2 } from 'lucide-react';

interface Step {
  id: string;
  fromPositionId: string;
  fromPositionTitle: string;
  toPositionId: string;
  toPositionTitle: string;
  stepOrder: number;
  stepName: string;
  requirementType: string;
  requirementRef: string | null;
  thresholdValue: number | null;
  isMandatory: boolean;
}

interface PositionOption {
  id: string;
  positionTitle: string;
}

const REQUIREMENT_LABEL: Record<string, string> = {
  GPA: 'Ambang GPA',
  COMPETENCY: 'Level kompetensi',
  CERTIFICATION: 'Sertifikasi',
  TRAINING_HOURS: 'Jam pelatihan',
  MOODLE_COURSE: 'Kursus Moodle',
  TENURE: 'Masa kerja (bulan)',
};

export default function CareerLadderManagerPanel() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState({
    fromPositionId: '',
    toPositionId: '',
    stepOrder: '1',
    stepName: '',
    requirementType: 'CERTIFICATION',
    requirementRef: '',
    thresholdValue: '1',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        fetch('/api/v1/hr/career-ladder').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/v1/recruitment/positions').then((r) => (r.ok ? r.json() : null)),
      ]);
      setSteps(s?.data?.items ?? []);
      setPositions(p?.data?.positions ?? p?.data?.items ?? []);
    } catch {
      /* biarkan kosong */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/v1/hr/career-ladder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPositionId: form.fromPositionId,
          toPositionId: form.toPositionId,
          stepOrder: Number(form.stepOrder),
          stepName: form.stepName,
          requirementType: form.requirementType,
          requirementRef: form.requirementRef || undefined,
          thresholdValue: form.thresholdValue ? Number(form.thresholdValue) : undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice(json?.detail ?? 'Gagal menambah tahapan.'); return; }
      setNotice('Tahapan ditambahkan.');
      setForm((f) => ({ ...f, stepName: '', requirementRef: '' }));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/hr/career-ladder/${id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice(json?.detail ?? 'Gagal menghapus tahapan.'); return; }
      setNotice('Tahapan dihapus.');
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
            <GitBranch className="h-4 w-4 text-[#0284c7]" aria-hidden="true" />
            <span>Konfigurasi Jenjang Karir</span>
          </h3>
          <p className="text-[11px] text-[#64748b]">
            Tahapan yang harus dipenuhi karyawan untuk naik dari satu posisi ke posisi berikutnya.
          </p>
        </div>
        <span className="text-[10px] font-bold text-[#0284c7] bg-[#e0f2fe] px-2 py-1 rounded-lg">
          {steps.length} tahapan
        </span>
      </div>

      {notice && (
        <p className="text-[11px] text-[#0f172a] bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      <div className="rounded-xl border border-[#e2e8f0] p-3 space-y-2">
        <p className="text-[11px] font-bold text-[#0f172a] flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Tambah Tahapan
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] text-[#475569]">
            Posisi asal
            <select
              value={form.fromPositionId}
              onChange={(e) => setForm((f) => ({ ...f, fromPositionId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            >
              <option value="">Pilih posisi…</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.positionTitle}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-[#475569]">
            Posisi tujuan
            <select
              value={form.toPositionId}
              onChange={(e) => setForm((f) => ({ ...f, toPositionId: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            >
              <option value="">Pilih posisi…</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.positionTitle}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-[#475569] sm:col-span-2">
            Nama tahapan
            <input
              value={form.stepName}
              onChange={(e) => setForm((f) => ({ ...f, stepName: e.target.value }))}
              placeholder="Sertifikasi manajemen proyek"
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-[11px] text-[#475569]">
            Jenis syarat
            <select
              value={form.requirementType}
              onChange={(e) => setForm((f) => ({ ...f, requirementType: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            >
              {Object.entries(REQUIREMENT_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-[#475569]">
            Urutan
            <input
              type="number"
              min={1}
              value={form.stepOrder}
              onChange={(e) => setForm((f) => ({ ...f, stepOrder: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-[11px] text-[#475569]">
            Rujukan (opsional)
            <input
              value={form.requirementRef}
              onChange={(e) => setForm((f) => ({ ...f, requirementRef: e.target.value }))}
              placeholder="PMP"
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-[11px] text-[#475569]">
            Ambang
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.thresholdValue}
              onChange={(e) => setForm((f) => ({ ...f, thresholdValue: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={add}
          className="rounded-lg bg-[#007a5a] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2 disabled:opacity-50"
        >
          Tambah tahapan
        </button>
      </div>

      {loading && <p className="text-[11px] text-[#64748b]">Memuat konfigurasi…</p>}

      <ul className="divide-y divide-[#e2e8f0]">
        {steps.map((s) => (
          <li key={s.id} className="py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#0f172a]">{s.stepName}</span>
              <span className="rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] font-bold text-[#475569]">
                langkah {s.stepOrder}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(s.id)}
                aria-label={`Hapus tahapan ${s.stepName}`}
                className="ml-auto rounded-lg border border-[#b91c1c] p-1 text-[#b91c1c] hover:bg-[#fef2f2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b91c1c] focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-0.5 text-[11px] text-[#475569]">
              {s.fromPositionTitle} ke {s.toPositionTitle}
            </p>
            <p className="text-[10px] text-[#64748b]">
              {REQUIREMENT_LABEL[s.requirementType] ?? s.requirementType}
              {s.requirementRef ? ` · ${s.requirementRef}` : ''}
              {s.thresholdValue !== null ? ` · ambang ${s.thresholdValue}` : ''}
            </p>
          </li>
        ))}
        {!loading && steps.length === 0 && (
          <li className="py-3 text-[11px] text-[#64748b]">
            Belum ada tahapan. Tambahkan di atas agar karyawan melihat jenjang karirnya.
          </li>
        )}
      </ul>
    </div>
  );
}
