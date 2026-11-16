'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, Plus, RefreshCw, Layers } from 'lucide-react';

type Tingkat = 'DEPARTEMEN' | 'MANAJER' | 'POSISI';

interface Usulan {
  kpiTitle: string;
  targetValue: number;
  unitOfMeasure: string;
  weightPct: number;
  rationale: string;
}

interface Konfig {
  judul: string;
  ket: string;
  parentUrl: string;
  parentNama: (p: any) => string;
  parentInfo: (p: any) => string;
  generateUrl: string;
  saveUrl: string;
  bodyInduk: string;
  bodyPemilik: string;
  targetNama: (t: any) => string;
  pakaiSatuan: boolean;
}

const KONFIG: Record<Tingkat, Konfig> = {
  DEPARTEMEN: {
    judul: 'KPI Direktur → Divisi',
    ket: 'Bagi KPI korporat dari BOD menjadi KPI tiap departemen.',
    parentUrl: '/api/v1/performance/kpi-cascade/corporate',
    parentNama: (p) => p.kpiName,
    parentInfo: (p) => `${p.kpiCode} · target ${p.targetValue} ${p.unitOfMeasure ?? ''}`,
    generateUrl: '/api/v1/performance/kpi-cascade/division/generate',
    saveUrl: '/api/v1/performance/kpi-cascade/division',
    bodyInduk: 'corporate_kpi_id',
    bodyPemilik: 'department_id',
    targetNama: (t) => t.nama,
    pakaiSatuan: false,
  },
  MANAJER: {
    judul: 'KPI Divisi → People Manager',
    ket: 'Tugaskan KPI divisi kepada People Manager departemen terkait.',
    parentUrl: '/api/v1/performance/kpi-cascade/division',
    parentNama: (p) => p.kpiTitle,
    parentInfo: (p) => `${p.departmentName ?? '-'} · target ${p.targetValue} · bobot ${p.weightPct}%`,
    generateUrl: '/api/v1/performance/kpi-cascade/manager/generate',
    saveUrl: '/api/v1/performance/kpi-cascade/manager',
    bodyInduk: 'division_kpi_id',
    bodyPemilik: 'employee_id',
    targetNama: (t) => `${t.nama}${t.departemen ? ` (${t.departemen})` : ''}`,
    pakaiSatuan: true,
  },
  POSISI: {
    judul: 'KPI Manajer → Posisi Pegawai',
    ket: 'Bagi KPI People Manager menjadi KPI posisi untuk pegawai yang dipimpin.',
    parentUrl: '/api/v1/performance/kpi-cascade/manager',
    parentNama: (p) => p.kpiTitle,
    parentInfo: (p) => `${p.employeeName ?? '-'} · target ${p.targetValue} ${p.unitOfMeasure ?? ''}`,
    generateUrl: '/api/v1/performance/kpi-cascade/position/generate',
    saveUrl: '/api/v1/performance/kpi-cascade/position',
    bodyInduk: 'manager_kpi_id',
    bodyPemilik: 'position_id',
    targetNama: (t) => `${t.nama}${t.departemen ? ` · ${t.departemen}` : ''}`,
    pakaiSatuan: true,
  },
};

export default function KpiTurunanPanel({ tingkat }: { tingkat: Tingkat }) {
  const K = KONFIG[tingkat];
  const [induk, setInduk] = useState<any[]>([]);
  const [pemilik, setPemilik] = useState<any[]>([]);
  const [idInduk, setIdInduk] = useState('');
  const [idPemilik, setIdPemilik] = useState('');
  const [usulan, setUsulan] = useState<Usulan[] | null>(null);
  const [sumber, setSumber] = useState<string | null>(null);
  const [catatan, setCatatan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, 'ok' | 'skip'>>({});
  const [manual, setManual] = useState({ judul: '', target: '', bobot: '' });

  const muat = useCallback(async () => {
    setErr(null);
    try {
      const [rInduk, rPemilik] = await Promise.all([
        fetch(K.parentUrl),
        fetch(`/api/v1/performance/kpi-cascade/targets?tingkat=${tingkat}`),
      ]);
      const jInduk = await rInduk.json().catch(() => ({}));
      const jPemilik = await rPemilik.json().catch(() => ({}));
      if (!rInduk.ok) { setErr(jInduk?.detail ?? 'Gagal memuat KPI induk.'); return; }
      if (!rPemilik.ok) { setErr(jPemilik?.detail ?? 'Gagal memuat pilihan pemilik.'); return; }
      setInduk(Array.isArray(jInduk?.data?.items) ? jInduk.data.items : []);
      setPemilik(Array.isArray(jPemilik?.data?.items) ? jPemilik.data.items : []);
    } catch {
      setErr('Gagal memuat data KPI.');
    }
  }, [K.parentUrl, tingkat]);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function susun() {
    if (!idInduk || !idPemilik) { setErr('Pilih KPI induk dan pemilik terlebih dahulu.'); return; }
    setBusy(true); setErr(null); setMsg(null); setUsulan(null); setSumber(null); setCatatan(null); setStatus({});
    try {
      const res = await fetch(K.generateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [K.bodyInduk]: idInduk, [K.bodyPemilik]: idPemilik }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.detail ?? json?.message ?? 'Gagal menyusun usulan.'); return; }
      const d = json?.data ?? {};
      setUsulan(Array.isArray(d?.usulan) ? d.usulan : []);
      setSumber(d?.sumber ?? null);
      setCatatan(d?.catatan ?? null);
    } catch {
      setErr('Gagal menyusun usulan.');
    } finally {
      setBusy(false);
    }
  }

  async function simpan(item: { judul: string; target: number; satuan: string; bobot: number }, key: string) {
    setErr(null); setMsg(null);
    try {
      const body: Record<string, unknown> = {
        [K.bodyInduk]: idInduk,
        [K.bodyPemilik]: idPemilik,
        kpi_title: item.judul,
        target_value: item.target,
        weight_pct: item.bobot,
      };
      if (K.pakaiSatuan) body.unit_of_measure = item.satuan || '%';
      const res = await fetch(K.saveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.detail ?? json?.message ?? 'Gagal menyimpan KPI.'); return; }
      setStatus((s) => ({ ...s, [key]: 'ok' }));
      setMsg('KPI berhasil diturunkan dan ditugaskan.');
      await muat();
    } catch {
      setErr('Gagal menyimpan KPI.');
    }
  }

  async function simpanManual() {
    const target = Number(manual.target);
    const bobot = Number(manual.bobot);
    if (manual.judul.trim().length < 5) { setErr('Judul KPI minimal 5 karakter.'); return; }
    if (!Number.isFinite(target) || target <= 0) { setErr('Target harus angka lebih dari 0.'); return; }
    if (!Number.isFinite(bobot) || bobot <= 0 || bobot > 100) { setErr('Bobot 1-100.'); return; }
    await simpan({ judul: manual.judul.trim(), target, satuan: '%', bobot }, 'manual');
    setManual({ judul: '', target: '', bobot: '' });
  }

  return (
    <div className="stitch-card-white p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#f1f5f9] pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#007a5a]" />
          <div>
            <h2 className="text-sm font-extrabold text-[#0f172a]">{K.judul}</h2>
            <p className="text-[11px] text-[#64748b]">{K.ket}</p>
          </div>
        </div>
        <button type="button" onClick={() => void muat()} className="p-1.5 rounded-lg border border-[#e2e8f0] text-[#64748b]" title="Muat ulang">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {err && <p className="text-[11px] text-[#b91c1c] bg-[#fef2f2] px-3 py-2 rounded-lg">{err}</p>}
      {msg && <p className="text-[11px] text-[#137333] bg-[#e6f4ea] px-3 py-2 rounded-lg">{msg}</p>}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-[#475569]">
          KPI Induk
          <select value={idInduk} onChange={(e) => setIdInduk(e.target.value)} className="mt-0.5 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-[11px]">
            <option value="">— pilih KPI induk —</option>
            {induk.map((p) => (
              <option key={p.id} value={p.id}>{K.parentNama(p)}</option>
            ))}
          </select>
          {idInduk && <span className="text-[10px] text-[#94a3b8]">{(induk.find((x) => x.id === idInduk) && K.parentInfo(induk.find((x) => x.id === idInduk))) ?? ''}</span>}
        </label>
        <label className="text-[11px] text-[#475569]">
          Ditugaskan kepada
          <select value={idPemilik} onChange={(e) => setIdPemilik(e.target.value)} className="mt-0.5 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-[11px]">
            <option value="">— pilih tujuan —</option>
            {pemilik.map((t) => (
              <option key={t.id} value={t.id}>{K.targetNama(t)}</option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={() => void susun()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#007a5a] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        {busy ? 'Menyusun...' : 'Susun KPI (AI)'}
      </button>

      {sumber && (
        <p className="text-[10px] text-[#64748b]">
          Sumber usulan: <span className="font-bold text-[#007a5a]">{sumber === 'AI' ? 'AI (model)' : 'Penurunan deterministik'}</span>
          {catatan ? ` — ${catatan}` : ''}
        </p>
      )}

      {usulan && usulan.length > 0 && (
        <ul className="space-y-1.5">
          {usulan.map((u, i) => {
            const key = `ai-${i}`;
            const st = status[key];
            return (
              <li key={key} className="rounded-lg border border-[#e2e8f0] px-2.5 py-2 space-y-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#0f172a]">{u.kpiTitle}</p>
                    <p className="text-[10px] text-[#64748b]">Target {u.targetValue} {u.unitOfMeasure} · bobot {u.weightPct}%</p>
                    {u.rationale ? <p className="text-[10px] italic text-[#475569]">{u.rationale}</p> : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {st === 'ok' ? (
                      <span className="text-[10px] font-bold text-[#137333] bg-[#e6f4ea] px-2 py-1 rounded">Sudah ditugaskan</span>
                    ) : (
                      <>
                        <button type="button" onClick={() => void simpan({ judul: u.kpiTitle, target: u.targetValue, satuan: u.unitOfMeasure, bobot: u.weightPct }, key)} className="inline-flex items-center gap-1 rounded-lg bg-[#007a5a] px-2.5 py-1 text-[10px] font-semibold text-white">
                          <CheckCircle2 className="h-3 w-3" /> Setujui
                        </button>
                        <button type="button" onClick={() => setStatus((s) => ({ ...s, [key]: 'skip' }))} className="rounded-lg border border-[#cbd5e1] px-2.5 py-1 text-[10px] font-semibold text-[#64748b]">Tidak</button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-2.5 space-y-2">
        <p className="text-[10px] font-bold text-[#475569]">Tambah manual (tanpa AI)</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input value={manual.judul} onChange={(e) => setManual((m) => ({ ...m, judul: e.target.value }))} placeholder="Judul KPI" className="rounded-lg border border-[#cbd5e1] px-2 py-1 text-[11px]" />
          <input value={manual.target} onChange={(e) => setManual((m) => ({ ...m, target: e.target.value }))} placeholder="Target (angka)" className="rounded-lg border border-[#cbd5e1] px-2 py-1 text-[11px]" />
          <input value={manual.bobot} onChange={(e) => setManual((m) => ({ ...m, bobot: e.target.value }))} placeholder="Bobot %" className="rounded-lg border border-[#cbd5e1] px-2 py-1 text-[11px]" />
        </div>
        <button type="button" onClick={() => void simpanManual()} className="inline-flex items-center gap-1 rounded-lg border border-[#007a5a] px-2.5 py-1 text-[10px] font-semibold text-[#007a5a]">
          <Plus className="h-3 w-3" /> Simpan manual
        </button>
      </div>
    </div>
  );
}
