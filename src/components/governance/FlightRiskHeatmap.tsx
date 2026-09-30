'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface FlightRiskTalent {
  name: string;
  department: string;
  riskScore: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  driver: string;
}

/**
 * Normalisasi respons GET /api/v1/governance/flight-risk.
 * Route mengembalikan { status: 'success', data: { items: [...] } } dengan
 * tiap item hasil buildRiskProfile + calculateFlightRisk.
 * Normalisasi dibuat toleran terhadap variasi nama field.
 */
function normalizeItems(payload: unknown): FlightRiskTalent[] {
  const raw = (payload as { items?: unknown } | null)?.items ?? payload;
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any) => {
    const level = String(r.riskLevel ?? r.level ?? 'LOW').toUpperCase();
    const drivers: string[] = Array.isArray(r.drivers)
      ? r.drivers
      : Array.isArray(r.warnings)
        ? r.warnings
        : [];
    return {
      name: String(r.fullName ?? r.name ?? r.full_name ?? '—'),
      department: String(r.department ?? r.departmentName ?? ''),
      riskScore: Number(r.riskScore ?? r.score ?? 0),
      level: (level === 'HIGH' || level === 'MEDIUM'
        ? level
        : 'LOW') as FlightRiskTalent['level'],
      driver: drivers.join('; ') || String(r.driver ?? ''),
    };
  });
}

export default function FlightRiskHeatmap() {
  const [talents, setTalents] = useState<FlightRiskTalent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/governance/flight-risk', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        throw new Error(
          json.detail ?? json.message ?? `Gagal memuat data risiko (HTTP ${res.status}).`
        );
      }
      setTalents(normalizeItems(json.data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data risiko.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const highCount = talents.filter((t) => t.level === 'HIGH').length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Peta Deteksi Dini Flight Risk &amp; Retensi Talenta
            </h3>
            <p className="text-[11px] text-slate-500">Kotak 4: Core HR &amp; Peringatan Dini Resign</p>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            highCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {highCount > 0
            ? `${highCount} Talenta Kritis Perlu Ditangani`
            : 'Tidak Ada Talenta Kritis'}
        </span>
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

      {!loading && !error && talents.length === 0 && (
        <p className="text-xs text-slate-500">Belum ada data risiko talenta.</p>
      )}

      {!loading && !error && talents.length > 0 && (
        <div className="space-y-2.5">
          {talents.map((t, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">{t.name}</span>
                  <span className="text-[10px] text-slate-500 font-medium">({t.department})</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">{t.driver}</p>
              </div>

              <div className="flex items-center gap-2.5 flex-shrink-0">
                <span className="font-mono text-xs font-bold text-slate-700">
                  Skor Risiko: {t.riskScore}%
                </span>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    t.level === 'HIGH'
                      ? 'bg-rose-100 text-rose-700 border-rose-300'
                      : t.level === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-700 border-amber-300'
                        : 'bg-emerald-100 text-emerald-700 border-emerald-300'
                  }`}
                >
                  {t.level} RISK
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
