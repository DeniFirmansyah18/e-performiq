'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Wallet, Plus, Sparkles, CheckCircle2, Download, RefreshCw } from 'lucide-react';

interface PayrollRun {
  id: string;
  periodCode: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  isThrMonth: boolean;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
}
interface PayrollItem {
  id: string;
  employeeCode: string;
  fullName: string;
  department: string;
  baseSalary: number;
  fixedAllowance: number;
  overtimePay: number;
  bonus: number;
  thr: number;
  bpjsKesehatan: number;
  bpjsJht: number;
  bpjsJp: number;
  pph21: number;
  gross: number;
  totalDeductions: number;
  net: number;
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600', PROCESSING: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-indigo-50 text-indigo-700', PAID: 'bg-emerald-50 text-emerald-700',
};
const idr = (n: number) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

/** Panel Payroll HR (WS-10): buat run, lihat rincian, AI advisory, setujui, ekspor CSV. */
export default function PayrollPanel() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [activeRun, setActiveRun] = useState<string | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [thr, setThr] = useState(false);

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/payroll/runs');
      const j = await res.json().catch(() => ({}));
      setRuns(j?.data?.runs ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  const openRun = async (id: string) => {
    setActiveRun(id); setItems([]); setInsight(null);
    const res = await fetch(`/api/v1/payroll/runs?runId=${id}`);
    const j = await res.json().catch(() => ({}));
    setItems(j?.data?.items ?? []);
  };

  const generate = async () => {
    setBusy(true); setErr(null); setMsg(null);
    const [y, m] = period.split('-').map(Number);
    const start = `${period}-01`;
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // akhir bulan
    const res = await fetch('/api/v1/payroll/runs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodCode: period, periodStart: start, periodEnd: end, isThrMonth: thr }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setMsg(`Run payroll ${period} dibuat (${j.data.items} karyawan).`); await loadRuns(); await openRun(j.data.runId); }
    else setErr(j?.detail || 'Gagal membuat run payroll.');
    setBusy(false);
  };

  const advisory = async () => {
    if (!activeRun) return;
    setBusy(true); setInsight(null);
    const res = await fetch(`/api/v1/payroll/runs/${activeRun}/advisory`, { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    setInsight(res.ok ? j?.data?.insight : (j?.detail || 'Gagal memuat analisis.'));
    setBusy(false);
  };

  const act = async (action: 'approve' | 'pay') => {
    if (!activeRun) return;
    setBusy(true); setMsg(null); setErr(null);
    const res = await fetch(`/api/v1/payroll/runs/${activeRun}/action`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setMsg(action === 'approve' ? 'Payroll disetujui.' : 'Ditandai dibayar.'); await loadRuns(); await openRun(activeRun); }
    else setErr(j?.detail || 'Aksi gagal.');
    setBusy(false);
  };

  if (loading) return <div className="stitch-card-white p-6 text-xs text-[#64748b]">Memuat payroll…</div>;

  return (
    <div className="stitch-card-white p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
        <div className="flex items-center gap-2.5">
          <Wallet className="h-4 w-4 text-[#007a5a]" />
          <h2 className="text-base font-extrabold text-[#0f172a]">Payroll</h2>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" />
          <label className="flex items-center gap-1 text-[11px] text-[#334155]">
            <input type="checkbox" checked={thr} onChange={(e) => setThr(e.target.checked)} className="accent-[#007a5a]" /> THR
          </label>
          <button disabled={busy} onClick={generate}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0f172a] text-white text-[11px] font-semibold hover:bg-[#1e293b] disabled:opacity-50">
            <Plus className="h-3 w-3" /> Buat Run
          </button>
        </div>
      </div>

      {msg && <p className="text-[11px] font-semibold text-[#047857]">{msg}</p>}
      {err && <p className="text-[11px] font-semibold text-rose-600">{err}</p>}

      <div className="space-y-2">
        {runs.length === 0 ? (
          <p className="text-xs text-[#64748b]">Belum ada run payroll. Pilih periode lalu klik &quot;Buat Run&quot;.</p>
        ) : runs.map((r) => (
          <button key={r.id} onClick={() => openRun(r.id)}
            className={`w-full text-left p-3 rounded-xl border transition-colors ${activeRun === r.id ? 'border-[#007a5a] bg-[#f0fdf9]' : 'border-[#e2e8f0] hover:border-[#94a3b8]'}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0f172a]">{r.periodCode}{r.isThrMonth ? ' · THR' : ''}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_COLOR[r.status] ?? 'bg-slate-100 text-slate-600'}`}>{r.status}</span>
            </div>
            <div className="flex gap-3 mt-1 text-[10px] text-[#64748b]">
              <span>Bruto {idr(r.totalGross)}</span>
              <span>Potongan {idr(r.totalDeductions)}</span>
              <span className="font-semibold text-[#0f172a]">Net {idr(r.totalNet)}</span>
            </div>
          </button>
        ))}
      </div>

      {activeRun && (
        <div className="space-y-3 border-t border-[#f1f5f9] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={busy} onClick={advisory}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 disabled:opacity-50">
              <Sparkles className="h-3 w-3" /> Analisis AI
            </button>
            <button disabled={busy} onClick={() => act('approve')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#007a5a] text-white text-[11px] font-semibold hover:bg-[#006347] disabled:opacity-50">
              <CheckCircle2 className="h-3 w-3" /> Setujui
            </button>
            <button disabled={busy} onClick={() => act('pay')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-[#334155] text-[11px] font-semibold hover:bg-slate-200 disabled:opacity-50">
              <RefreshCw className="h-3 w-3" /> Tandai Dibayar
            </button>
            <a href={`/api/v1/payroll/runs/${activeRun}/export`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-[#334155] text-[11px] font-semibold hover:bg-slate-200">
              <Download className="h-3 w-3" /> Ekspor CSV
            </a>
          </div>

          {insight && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-[11px] text-[#334155] whitespace-pre-wrap">{insight}</div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-[#64748b] border-b border-[#e2e8f0]">
                  <th className="py-2">Karyawan</th>
                  <th className="py-2 text-right">Pokok</th>
                  <th className="py-2 text-right">Lembur</th>
                  <th className="py-2 text-right">THR</th>
                  <th className="py-2 text-right">BPJS</th>
                  <th className="py-2 text-right">PPh21</th>
                  <th className="py-2 text-right">Bruto</th>
                  <th className="py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-[#f1f5f9]">
                    <td className="py-2">
                      <p className="font-semibold text-[#0f172a]">{it.fullName}</p>
                      <span className="text-[9px] text-[#64748b]">{it.employeeCode} · {it.department}</span>
                    </td>
                    <td className="py-2 text-right">{idr(it.baseSalary)}</td>
                    <td className="py-2 text-right">{idr(it.overtimePay)}</td>
                    <td className="py-2 text-right">{idr(it.thr)}</td>
                    <td className="py-2 text-right">{idr(it.bpjsKesehatan + it.bpjsJht + it.bpjsJp)}</td>
                    <td className="py-2 text-right">{idr(it.pph21)}</td>
                    <td className="py-2 text-right font-semibold">{idr(it.gross)}</td>
                    <td className="py-2 text-right font-bold text-[#007a5a]">{idr(it.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
