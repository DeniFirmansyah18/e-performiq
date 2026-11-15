'use client';

import React, { useState } from 'react';
import { Compass, Save, Loader2, PencilLine } from 'lucide-react';

/**
 * Form Visi & Misi untuk BOD (#4 "Arah Strategi & Saran AI").
 *
 * BOD menetapkan / mengubah Visi & Misi perusahaan; disimpan lewat
 * POST /api/v1/analytics/vision-mission (permission analytics:manage).
 * Setelah simpan, induk memuat ulang angka capaian.
 */
export default function BoardVisionEditor({
  vision,
  mission,
  onSaved,
}: {
  vision: string | null;
  mission: string | null;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(vision ?? '');
  const [m, setM] = useState(mission ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function simpan() {
    setErr(null);
    setOkMsg(null);
    setBusy(true);
    try {
      const res = await fetch('/api/v1/analytics/vision-mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vision: v, mission: m }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.detail ?? json?.message ?? 'Gagal menyimpan visi & misi.');
        return;
      }
      setOkMsg('Visi & Misi berhasil disimpan.');
      setOpen(false);
      onSaved();
    } catch {
      setErr('Gagal menyimpan visi & misi.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setV(vision ?? '');
          setM(mission ?? '');
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#334155] hover:bg-[#f8fafc]"
      >
        <PencilLine className="h-3.5 w-3.5 text-[#64748b]" /> Atur Visi & Misi
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[#d1fae5] bg-[#f0fdf4] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Compass className="h-4 w-4 text-[#007a5a]" />
        <h3 className="text-sm font-extrabold text-[#0f172a]">Tetapkan Visi &amp; Misi Perusahaan</h3>
      </div>
      <label className="block text-[11px] text-[#475569]">
        Visi
        <textarea
          value={v}
          onChange={(e) => setV(e.target.value)}
          rows={2}
          maxLength={1000}
          className="mt-0.5 w-full rounded-lg border border-[#cbd5e1] bg-white px-2 py-1.5 text-xs text-[#0f172a]"
        />
      </label>
      <label className="block text-[11px] text-[#475569]">
        Misi (pisahkan tiap pernyataan dengan tanda | atau baris baru)
        <textarea
          value={m}
          onChange={(e) => setM(e.target.value)}
          rows={3}
          maxLength={3000}
          className="mt-0.5 w-full rounded-lg border border-[#cbd5e1] bg-white px-2 py-1.5 text-xs text-[#0f172a]"
        />
      </label>
      {err && <p className="text-[11px] text-[#b91c1c] bg-[#fef2f2] px-2 py-1 rounded-md">{err}</p>}
      {okMsg && <p className="text-[11px] text-[#137333] bg-[#e6f4ea] px-2 py-1 rounded-md">{okMsg}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void simpan()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#007a5a] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Simpan
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#334155]"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
