'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Sparkles, Inbox } from 'lucide-react';

interface Mpp {
  id: string;
  departmentName: string | null;
  positionTitle: string | null;
  fiscalYear: number;
  approvedQuota: number;
  allocatedBudget: number;
  managerName: string | null;
  status: string;
  decisionNote: string | null;
}

const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

/**
 * Panel keputusan MPP untuk BOD.
 *
 * Menampilkan pengajuan yang menunggu, beserta rekomendasi AI sebagai bahan
 * pertimbangan. Keputusan di sini langsung mengubah status MPP yang dilihat HR.
 */
export default function MppApprovalPanel() {
  const [daftar, setDaftar] = useState<Mpp[]>([]);
  const [loading, setLoading] = useState(true);
  const [pesan, setPesan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catatan, setCatatan] = useState<Record<string, string>>({});
  const [proses, setProses] = useState<string | null>(null);
  const [aiHasil, setAiHasil] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const muat = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/recruitment/manpower-plans/approval?mode=menunggu');
      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.detail ?? 'Gagal memuat pengajuan MPP.'); return; }
      setDaftar(json?.data ?? []);
    } catch {
      setError('Gagal menghubungi server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void muat(); }, [muat]);

  const putuskan = async (id: string, keputusan: 'APPROVED' | 'REJECTED') => {
    setProses(id); setPesan(null); setError(null);
    try {
      const res = await fetch(`/api/v1/recruitment/manpower-plans/approval/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keputusan, catatan: catatan[id] ?? '' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { setError(json?.detail ?? 'Keputusan gagal disimpan.'); return; }
      setPesan(json?.message ?? 'Keputusan tersimpan.');
      await muat();
    } catch {
      setError('Gagal menghubungi server.');
    } finally {
      setProses(null);
    }
  };

  const mintaRekomendasi = async () => {
    setAiLoading(true); setAiHasil(null);
    try {
      const res = await fetch('/api/v1/ai/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'hr', menu: 'Persetujuan MPP (BOD)' }),
      });
      const json = await res.json().catch(() => null);
      setAiHasil(json?.data?.insight ?? 'Tidak ada keluaran dari model.');
    } catch {
      setAiHasil('Gagal menghubungi layanan AI.');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return <p className="flex items-center gap-2 text-xs text-[#64748b]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat pengajuan…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold text-[#0f172a]">Pengajuan MPP menunggu keputusan</p>
        <button
          type="button" onClick={mintaRekomendasi} disabled={aiLoading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#007a5a] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#00684a] disabled:opacity-50"
        >
          {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {aiLoading ? 'Menganalisis…' : 'Rekomendasi AI'}
        </button>
      </div>

      {pesan && <p role="status" className="text-[11px] font-semibold text-[#137333] bg-[#e6f4ea] border border-[#b7e1cd] rounded-lg px-3 py-2">{pesan}</p>}
      {error && <p role="alert" className="text-[11px] font-semibold text-[#c5221f] bg-[#fce8e6] border border-[#f5c6c0] rounded-lg px-3 py-2">{error}</p>}

      {aiHasil && (
        <div className="rounded-xl border border-[#c7e7d3] bg-[#f6fdf9] p-3">
          <p className="text-[11px] font-bold text-[#0f172a] mb-1.5">Rekomendasi AI — Persetujuan MPP (BOD)</p>
          <p className="text-[11px] text-[#334155] leading-relaxed whitespace-pre-wrap">{aiHasil}</p>
        </div>
      )}

      {daftar.length === 0 ? (
        <p className="flex items-center gap-2 text-[11px] text-[#64748b] bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded-lg p-3">
          <Inbox className="h-3.5 w-3.5" /> Tidak ada pengajuan MPP yang menunggu keputusan.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {daftar.map((m) => (
            <li key={m.id} className="rounded-xl border border-[#e2e8f0] bg-white p-3.5 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[#0f172a]">
                    {m.departmentName ?? '—'} — {m.positionTitle ?? '—'}
                  </p>
                  <p className="text-[11px] text-[#64748b]">
                    Tahun {m.fiscalYear} · Kuota {m.approvedQuota} orang · Anggaran {rupiah(m.allocatedBudget)}
                  </p>
                  <p className="text-[11px] text-[#64748b]">
                    Atasan langsung: <span className="font-semibold text-[#334155]">{m.managerName ?? 'belum dipilih'}</span>
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-[#92400e]">Menunggu keputusan</span>
              </div>

              <input
                value={catatan[m.id] ?? ''}
                onChange={(e) => setCatatan((c) => ({ ...c, [m.id]: e.target.value }))}
                placeholder="Catatan (wajib bila menolak)"
                aria-label={`Catatan keputusan ${m.departmentName ?? ''}`}
                className="w-full h-8 px-2.5 rounded-lg border border-[#cbd5e1] text-[11px]"
              />

              <div className="flex gap-2">
                <button
                  type="button" disabled={proses === m.id} onClick={() => putuskan(m.id, 'APPROVED')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#007a5a] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#00684a] disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Setujui
                </button>
                <button
                  type="button" disabled={proses === m.id} onClick={() => putuskan(m.id, 'REJECTED')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#f5c6c0] bg-white px-3 py-1.5 text-[11px] font-bold text-[#c5221f] hover:bg-[#fce8e6] disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" /> Tolak
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
