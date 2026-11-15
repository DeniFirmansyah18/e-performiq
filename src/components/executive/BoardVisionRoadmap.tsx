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
  const [sumber, setSumber] = useState<string | null>(null);
  const [catatan, setCatatan] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // Status simpan per KPI: 'pending' | 'ok' | 'skip'
  const [simpan, setSimpan] = useState<Record<string, 'pending' | 'ok' | 'skip'>>({});

  async function setujui(k: any, idx: number) {
    const key = k?.kpiName ?? idx;
    setSimpan((s) => ({ ...s, [key]: 'pending' }));
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch('/api/v1/performance/kpi-cascade/corporate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pillar_id: k.pillarId,
          period_year: new Date().getFullYear(),
          kpi_name: k.kpiName,
          target_value: k.targetValue,
          unit_of_measure: k.unitOfMeasure,
          kpi_code: `BOD-${new Date().getFullYear()}-${String(idx + 1).padStart(2, '0')}`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.detail ?? json?.message ?? `Gagal menyimpan ${k.kpiName}.`);
        setSimpan((s) => ({ ...s, [key]: 'pending' }));
        return;
      }
      setSimpan((s) => ({ ...s, [key]: 'ok' }));
    } catch {
      setErr(`Gagal menyimpan ${k.kpiName}.`);
      setSimpan((s) => ({ ...s, [key]: 'pending' }));
    }
  }

  function tolak(k: any, idx: number) {
    const key = k?.kpiName ?? idx;
    setSimpan((s) => ({ ...s, [key]: 'skip' }));
  }

  async function generate() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    setUsulan(null);
    setSumber(null);
    setCatatan(null);
    try {
      const res = await fetch('/api/v1/performance/kpi-cascade/corporate/generate', {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.detail ?? json?.message ?? 'Gagal menyusun usulan KPI.');
        return;
      }
      // Respons endpoint: { kpis: [...], sumber: 'AI'|'FALLBACK', catatan: string|null }
      const data = json?.data ?? {};
      const daftar = Array.isArray(data?.kpis) ? data.kpis : [];
      setUsulan(daftar);
      setSumber(data?.sumber ?? null);
      setCatatan(data?.catatan ?? null);
      setMsg(
        daftar.length > 0
          ? 'Usulan KPI dari visi & misi berhasil disusun. Tinjau lalu simpan di KPI Command.'
          : data?.catatan ?? 'Belum ada usulan yang dapat disusun.'
      );
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
      {sumber && (
        <p className="text-[10px] text-[#64748b]">
          Sumber usulan:{' '}
          <span className="font-bold text-[#007a5a]">{sumber === 'AI' ? 'AI (model)' : 'Fallback pilar strategis'}</span>
          {catatan ? ` — ${catatan}` : ''}
        </p>
      )}

      {usulan && (
        <div className="space-y-1.5">
          {usulan.map((k: any, i: number) => {
            const key = k?.kpiName ?? i;
            const st = simpan[key] ?? 'pending';
            return (
              <div key={key} className="flex flex-wrap items-start gap-2 text-[11px] text-[#334155] bg-white border border-[#e2e8f0] rounded-lg px-2.5 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#007a5a] mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-semibold text-[#0f172a]">
                    {k?.kpiName ?? '(tanpa nama)'}
                    <span className="text-[10px] font-normal text-[#64748b] ml-2">
                      {k?.pillarName ?? ''}{k?.perspective ? ` · ${k.perspective}` : ''}
                    </span>
                  </p>
                  <p className="text-[10px] text-[#64748b]">
                    Target {k?.targetValue ?? '-'} {k?.unitOfMeasure ?? ''} · bobot {k?.weightPct ?? 0}%
                  </p>
                  {k?.rationale ? <p className="text-[10px] text-[#475569] italic">{k.rationale}</p> : null}
                </div>
                <div className="flex items-center gap-1.5">
                  {st === 'ok' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#137333] bg-[#e6f4ea] px-2 py-1 rounded-md">
                      <CheckCircle2 className="h-3 w-3" /> Disetujui &amp; disimpan
                    </span>
                  )}
                  {st === 'skip' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#64748b] bg-[#f1f5f9] px-2 py-1 rounded-md">
                      Dilewati
                    </span>
                  )}
                  {st === 'pending' && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setujui(k, i)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#007a5a] px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Setujui
                      </button>
                      <button
                        type="button"
                        onClick={() => tolak(k, i)}
                        className="rounded-lg border border-[#cbd5e1] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#64748b]"
                      >
                        Tidak
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {usulan.length === 0 && (
            <p className="text-[11px] text-[#64748b]">
              Belum ada usulan yang dapat ditampilkan. Lengkapi visi &amp; misi serta pilar strategis terlebih dahulu.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
