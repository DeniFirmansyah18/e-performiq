'use client';

import React, { useState } from 'react';
import { calculateSeverance, SeveranceInput } from '@/lib/engines/severance-engine';
import { X, Scale, Banknote, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SeveranceCalculatorModal({ isOpen, onClose }: Props) {
  const [serviceYears, setServiceYears] = useState<number>(8);
  const [baseSalary, setBaseSalary] = useState<number>(35000000);
  const [reasonType, setReasonType] = useState<SeveranceInput['reasonType']>('PENSION');
  const [dplkTopup, setDplkTopup] = useState<number>(150000000);

  if (!isOpen) return null;

  const result = calculateSeverance({
    serviceYears,
    baseSalary,
    reasonType,
    dplkTopup,
  });

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Kalkulator Hak Pesangon & Pensiun (PP 35/2021)
              </h3>
              <p className="text-xs text-slate-400">
                Formula Legal: UP + UPMK + UPH (15%) + Hak DPLK / JHT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Input Parameters */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Masa Kerja (Tahun)
            </label>
            <input
              type="number"
              min="0"
              max="40"
              value={serviceYears}
              onChange={(e) => setServiceYears(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Upah Pokok + Tunj. Tetap (IDR)
            </label>
            <input
              type="number"
              step="500000"
              value={baseSalary}
              onChange={(e) => setBaseSalary(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Alasan Berakhirnya Hubungan Kerja
            </label>
            <select
              value={reasonType}
              onChange={(e) => setReasonType(e.target.value as any)}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="PENSION">Mencapai Usia Pensiun Normal (1.75x UP + 1.0x UPMK)</option>
              <option value="RESIGNATION">Pengunduran Diri Sukarela / Resign (UPH + DPLK)</option>
              <option value="EFFICIENCY">Efisiensi Korporasi / Merger (1.0x UP + 1.0x UPMK)</option>
              <option value="CONTRACT_END">Berakhirnya PKWT / Kontrak Kerja</option>
            </select>
          </div>
        </div>

        {/* Calculated Breakdown Display */}
        <div className="rounded-xl bg-slate-950/80 border border-emerald-500/30 p-4 space-y-2.5">
          <div className="flex justify-between text-xs py-1 border-b border-slate-850">
            <span className="text-slate-400">1. Uang Pesangon (UP) [{result.upMultiplier}x Gaji]</span>
            <span className="font-mono text-slate-200 font-semibold">{formatIDR(result.severancePay)}</span>
          </div>

          <div className="flex justify-between text-xs py-1 border-b border-slate-850">
            <span className="text-slate-400">2. Uang Penghargaan Masa Kerja (UPMK) [{result.upmkMultiplier}x Gaji]</span>
            <span className="font-mono text-slate-200 font-semibold">{formatIDR(result.serviceAppreciationPay)}</span>
          </div>

          <div className="flex justify-between text-xs py-1 border-b border-slate-850">
            <span className="text-slate-400">3. Uang Penggantian Hak (UPH) [15% x (UP + UPMK)]</span>
            <span className="font-mono text-slate-200 font-semibold">{formatIDR(result.compensationPay)}</span>
          </div>

          <div className="flex justify-between text-xs py-1 border-b border-slate-850">
            <span className="text-slate-400">4. Tabungan DPLK / JHT BPJS Ketenagakerjaan</span>
            <span className="font-mono text-slate-200 font-semibold">{formatIDR(result.dplkTopup)}</span>
          </div>

          <div className="flex justify-between items-center text-sm pt-2">
            <span className="font-bold text-white">Total Hak Diterima (Disbursement)</span>
            <span className="text-base font-extrabold text-emerald-400 font-mono">
              {formatIDR(result.totalDisbursement)}
            </span>
          </div>
        </div>

        {/* Regulatory Note */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-emerald-300">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Kalkulasi tunduk pada <strong>PP No. 35 Tahun 2021 Pasal 40 & 50</strong> dengan SLA pencairan maksimal 7 hari kerja sejak LWD.
          </span>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
