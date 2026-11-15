'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, Lightbulb } from 'lucide-react';

/**
 * "Cara Mencapai Visi & Misi" (#4) — fitur bantu yang diisi / digenerate.
 *
 * BOD menekan "Susun KPI (AI)" untuk memanggil POST
 * /api/v1/performance/kpi-cascade/corporate/generate. Hasilnya usulan KPI
 * korporat ber-ai dari visi & misi; BOD meninjau lalu SIMPAN ke KPI Command.
 * Bila AI tak tersedia, endpoint memakai fallback deterministic — beda dari
 * narasi karangan, angka/usulannya tetap nyata dari konteks perusahaan.
 */
export default function BoardVisionRoadmap() {
  const [busy, setBusy] = useState(false);
  const [usulan, setUsulan] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    setUsulan(null);
    try {
      const res = await fetch('/api/v1/performance/kpi-cascade/corporate/generate', {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.detail ?? json?.message ?? 'Gagal menyusun usulan KPI.');
        return;
      }
      const isi = json?.data?.items ?? json?.data?.usulan ?? json?.data;
      setUsulan(Array.isArray(isi) ? isi : isi && Array.isArray(isi.items) ? isi.items : []);
      setMsg('Usulan KPI dari visi & misi berhasil disusun. Tinjau lalu simpan di tab KPI.');
    } catch {
      setErr('Gagal menyusun usulan KPI.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#d1fae5] bg-[#f0fdf4] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[#007a5a]" />
          <div>
            <h3 className="text-sm font-extrabold text-[#0f172a]">Cara Mencapai Visi &amp; Misi</h3>
            <p className="text-[11px] text-[#64748b]">
              Susun sasaran KPI korporat dari visi &amp; misi (AI), turunkan berjenjang ke divisi,
              manajer, hingga posisi.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#007a5a] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}{' '}
          {busy ? 'Menyusun...' : 'Susun KPI dari Visi & Misi (AI)'}
        </button>
      </div>

      {err && <p className="text-[11px] text-[#b91c1c] bg-[#fef2f2] px-2 py-1 rounded-md">{err}</p>}
      {msg && <p className="text-[11px] text-[#137333] bg-[#e6f4ea] px-2 py-1 rounded-md">{msg}</p>}

      {usulan && (
        <div className="space-y-1">
          {usulan.map((k: any, i: number) => (
            <div key={k?.kpiCode ?? i} className="flex items-start gap-2 text-[11px] text-[#334155] bg-white border border-[#e2e8f0] rounded-lg px-2 py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#007a5a] mt-0.5 shrink-0" />
              <span>
                <span className="font-mono text-[10px] text-[#64748b] mr-1.5">{k?.kpiCode ?? ''}</span>
                {k?.kpiName ?? k?.name ?? k?.usulan ?? '(tanpa nama)'}
                {typeof k?.target_value === 'number' && (
                  <span className="text-[10px] text-[#64748b] ml-2">target {k.target_value}</span>
                )}
              </span>
            </div>
          ))}
          {usulan.length === 0 && (
            <p className="text-[11px] text-[#64748b]">Belum ada usulan yang dapat ditampilkan.</p>
          )}
        </div>
      )}
    </div>
  );
}
