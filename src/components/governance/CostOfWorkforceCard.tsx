'use client';

import React from 'react';
import { DollarSign, TrendingUp, AlertCircle, ArrowUpRight } from 'lucide-react';

interface CostOfWorkforceCardProps {
  totalPayrollIDR?: number;
  totalOutputIDR?: number;
}

export default function CostOfWorkforceCard({
  totalPayrollIDR = 485_000_000,
  totalOutputIDR = 1_420_000_000,
}: CostOfWorkforceCardProps) {
  const tcowRatio = (totalPayrollIDR / totalOutputIDR) * 100;
  const roiMultiplier = totalOutputIDR / totalPayrollIDR;

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
          ROI: {roiMultiplier.toFixed(1)}x Output
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Total Pengeluaran SDM (TCOW)</span>
          <p className="text-sm font-bold font-mono text-slate-800">{formatIDR(totalPayrollIDR)}</p>
          <span className="text-[10px] text-slate-400">Gaji, Lembur &amp; Klaim</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Realisasi Output Korporat</span>
          <p className="text-sm font-bold font-mono text-emerald-700">{formatIDR(totalOutputIDR)}</p>
          <span className="text-[10px] text-emerald-600 font-medium">Target VMAI Terpenuhi</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Rasio Efisiensi Biaya</span>
          <p className="text-sm font-bold font-mono text-slate-800">{tcowRatio.toFixed(1)}%</p>
          <span className="text-[10px] text-slate-500">Benchmark Sehat &le; 35%</span>
        </div>
      </div>
    </div>
  );
}
