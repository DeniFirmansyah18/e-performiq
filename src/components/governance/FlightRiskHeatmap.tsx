'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, RefreshCw } from 'lucide-react';

type Band = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

interface RiskFactor {
  code: string;
  label: string;
  points: number;
  maxPoints: number;
}

interface RiskItem {
  employeeId: string;
  fullName: string;
  departmentName: string;
  attritionScore: number;
  attritionBand: Band;
  burnoutScore: number;
  burnoutBand: Band;
  factors: RiskFactor[];
  snapshotDate: string;
}

const BAND_STYLE: Record<Band, string> = {
  CRITICAL: 'bg-rose-100 text-rose-700 border-rose-300',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-300',
  MODERATE: 'bg-amber-100 text-amber-700 border-amber-300',
  LOW: 'bg-emerald-100 text-emerald-700 border-emerald-300',
};

const BAND_BAR: Record<Band, string> = {
  CRITICAL: 'bg-rose-500',
  HIGH: 'bg-orange-500',
  MODERATE: 'bg-amber-400',
  LOW: 'bg-emerald-500',
};

const BAND_ORDER: Band[] = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];

const isBand = (value: unknown): value is Band =>
  value === 'LOW' || value === 'MODERATE' || value === 'HIGH' || value === 'CRITICAL';

const atLeast = (band: Band, floor: Band) =>
  BAND_ORDER.indexOf(band) >= BAND_ORDER.indexOf(floor);

/** Faktor dengan poin terbesar lebih dulu — penyebab utama tampil paling atas. */
function topFactors(factors: RiskFactor[], limit = 3): RiskFactor[] {
  return factors
    .filter((f) => f && f.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

function normalize(payload: any): RiskItem[] {
  const raw = payload?.data?.items ?? payload?.items ?? [];
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any) => ({
    employeeId: String(r.employeeId ?? ''),
    fullName: String(r.fullName ?? '—'),
    departmentName: String(r.departmentName ?? ''),
    attritionScore: Number(r.attritionScore ?? 0),
    attritionBand: isBand(r.attritionBand) ? r.attritionBand : 'LOW',
    burnoutScore: Number(r.burnoutScore ?? 0),
    burnoutBand: isBand(r.burnoutBand) ? r.burnoutBand : 'LOW',
    factors: Array.isArray(r.factors) ? (r.factors as RiskFactor[]) : [],
    snapshotDate: String(r.snapshotDate ?? ''),
  }));
}

export default function FlightRiskHeatmap() {
  const [items, setItems] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/analytics/flight-risk?limit=25', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok || json.status === 'error') {
        throw new Error(json.detail ?? json.message ?? `Gagal memuat data risiko (HTTP ${res.status}).`);
      }
      setItems(normalize(json));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data risiko.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const recompute = async () => {
    setRecomputing(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/analytics/flight-risk/recompute', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || json.status === 'error') {
        throw new Error(json.detail ?? json.message ?? 'Perhitungan ulang gagal.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Perhitungan ulang gagal.');
    } finally {
      setRecomputing(false);
    }
  };

  const criticalCount = items.filter(
    (i) => atLeast(i.attritionBand, 'HIGH') || atLeast(i.burnoutBand, 'HIGH'),
  ).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Peringatan Dini Attrition &amp; Burnout
            </h3>
            <p className="text-[11px] text-slate-500">
              Dihitung dari absensi, lembur, DPI harian, penilaian 360, dan masa kontrak
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              criticalCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {criticalCount > 0
              ? `${criticalCount} karyawan berisiko tinggi`
              : 'Tidak ada karyawan berisiko tinggi'}
          </span>
          <button
            type="button"
            onClick={recompute}
            disabled={recomputing || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${recomputing ? 'animate-spin' : ''}`} />
            {recomputing ? 'Menghitung…' : 'Hitung ulang'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-2.5" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
          <p className="text-[11px] text-slate-500">Memuat data risiko…</p>
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

      {!loading && !error && items.length === 0 && (
        <p className="text-xs text-slate-600">
          Belum ada snapshot risiko. Tekan &ldquo;Hitung ulang&rdquo; untuk menghitung dari data terkini.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-2.5">
          {items.map((item) => {
            const drivers = topFactors(item.factors);
            return (
              <div
                key={item.employeeId}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800">{item.fullName}</span>
                    {item.departmentName && (
                      <span className="text-[10px] text-slate-500 font-medium">
                        ({item.departmentName})
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">snapshot {item.snapshotDate}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <ScoreBar label="Attrition" score={item.attritionScore} band={item.attritionBand} />
                  <ScoreBar label="Burnout" score={item.burnoutScore} band={item.burnoutBand} />
                </div>

                {drivers.length > 0 && (
                  <ul className="text-[11px] text-slate-600 space-y-0.5">
                    {drivers.map((f) => (
                      <li key={f.code}>
                        • {f.label} ({f.points}/{f.maxPoints})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, score, band }: { label: string; score: number; band: Band }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-semibold text-slate-600 uppercase tracking-wide">{label}</span>
        <span className="flex items-center gap-1.5">
          <span className="font-mono font-bold text-slate-800">{score}</span>
          <span className={`px-1.5 py-0.5 rounded-full border font-bold ${BAND_STYLE[band]}`}>
            {band}
          </span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full ${BAND_BAR[band]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
