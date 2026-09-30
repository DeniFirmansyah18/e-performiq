'use client';

import React, { useEffect, useState } from 'react';
import { DollarSign, AlertTriangle } from 'lucide-react';

interface WorkforceCost {
  /** Total Cost of Workforce (gaji + klaim), IDR */
  totalTCOW: number;
  /** Nilai output bisnis, IDR */
  totalOutput: number;
  /** Rasio efisiensi sebagai fraksi (mis. 0.34 = 34%) */
  tcowRatio: number;
  /** Kelipatan ROI output terhadap TCOW */
  roiMultiplier: number;
}

/**
 * Normalisasi respons GET /api/v1/finance/cost-of-workforce.
 * Route mengembalikan hasil calculateCostOfWorkforce:
 * { totalTCOW, tcowRatio, roiMultiplier } — totalOutput diturunkan dari
 * totalOutputValueIDR bila ada, atau totalTCOW * roiMultiplier.
 * Tidak ada lagi angka literal default.
 */
function normalizeCost(payload: unknown): WorkforceCost {
  const d = (payload ?? {}) as Record<string, unknown>;
  const totalTCOW = Number(d.totalTCOW ?? d.totalPayrollIDR ?? 0);
  const tcowRatio = Number(d.tcowRatio ?? 0);
  const roiMultiplier = Number(d.roiMultiplier ?? 0);
  const totalOutput = Number(
    d.totalOutputValueIDR ?? d.totalOutputIDR ?? totalTCOW * roiMultiplier
  );
  return { totalTCOW, totalOutput, tcowRatio, roiMultiplier };
}

export default function CostOfWorkforceCard() {
  const [cost, setCost] = useState<WorkforceCost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/finance/cost-of-workforce', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        throw new Error(
          json.detail ?? json.message ?? `Gagal memuat data biaya SDM (HTTP ${res.status}).`
        );
      }
      setCost(normalizeCost(json.data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data biaya SDM.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
            <DollarSign className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Analitik Biaya SDM vs Nilai Output Bisnis
            </h3>
            <p className="text-[11px] text-slate-500">Kotak 5: ISO 30414 Clause 4.6 (Total Cost of Workforce)</p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
          {loading ? '…' : `ROI: ${(cost?.roiMultiplier ?? 0).toFixed(1)}x Output`}
        </span>
      </div>

      {loading && (
        <div aria-live="polite">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-3">Memuat data biaya SDM…</p>
        </div>
      )}

      {!loading && error && (
        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error}
          </span>
          <button
            type="button"
            onClick={load}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700 flex-shrink-0"
          >
            Coba lagi
          </button>
        </div>
      )}

      {!loading && !error && cost && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">
              Total Pengeluaran SDM (TCOW)
            </span>
            <p className="text-sm font-bold font-mono text-slate-800">{formatIDR(cost.totalTCOW)}</p>
            <span className="text-[10px] text-slate-400">Gaji, Lembur &amp; Klaim</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">
              Realisasi Output Korporat
            </span>
            <p className="text-sm font-bold font-mono text-emerald-700">
              {formatIDR(cost.totalOutput)}
            </p>
            <span className="text-[10px] text-emerald-600 font-medium">Target VMAI Terpenuhi</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">
              Rasio Efisiensi Biaya
            </span>
            <p className="text-sm font-bold font-mono text-slate-800">
              {(cost.tcowRatio * 100).toFixed(1)}%
            </p>
            <span className="text-[10px] text-slate-500">Benchmark Sehat &le; 35%</span>
          </div>
        </div>
      )}
    </div>
  );
}
