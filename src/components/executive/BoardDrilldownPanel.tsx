'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Target, Users } from 'lucide-react';

interface QuadrantEmployee {
  employee_id: string;
  full_name: string;
  employee_code: string | null;
  department: string | null;
  position: string | null;
  composite_gpa: number | null;
  performance_rating: string | null;
}

interface Quadrant {
  quadrant: string;
  label: string;
  strategic_action: string;
  count: number;
  percentage: number;
  employees: QuadrantEmployee[];
}

interface NineBoxData {
  period_code: string;
  total_appraised_employees: number;
  talent_quadrants: Quadrant[];
  talent_summary: {
    top_talent_count: number;
    critical_development_count: number;
    solid_core_count: number;
  };
}

interface DivisionKpi {
  division_kpi_id: string;
  kpi_title: string;
  weight_pct: number;
  target_value: number;
  individual_kpis_count: number;
}

interface CorporateKpi {
  kpi_id: string;
  kpi_code: string | null;
  kpi_name: string;
  target_value: number;
  unit: string;
  level_4_division_kpis: DivisionKpi[];
}

interface Pillar {
  pillar_id: string;
  perspective: string;
  pillar_name: string;
  description: string | null;
  strategic_weight_pct: number;
  level_3_corporate_kpis: CorporateKpi[];
}

interface CascadeData {
  level_0_vision: { label: string; description: string };
  level_1_mission: string[];
  level_2_strategic_pillars: Pillar[];
}

/**
 * Drill-down eksekutif: distribusi 9-box (siapa berada di kuadran mana) dan
 * pohon cascading visi → pilar → KPI korporasi → KPI divisi. Dipakai Direktur
 * untuk menelusuri angka VMAI sampai ke pemilik KPI, bukan hanya melihat indeks.
 */
export default function BoardDrilldownPanel({ periodCode = '2026-Q3' }: { periodCode?: string }) {
  const [view, setView] = useState<'nine-box' | 'cascade'>('nine-box');
  const [nineBox, setNineBox] = useState<NineBoxData | null>(null);
  const [cascade, setCascade] = useState<CascadeData | null>(null);
  const [openQuadrant, setOpenQuadrant] = useState<string | null>(null);
  const [openPillar, setOpenPillar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [nbRes, treeRes] = await Promise.all([
          fetch(`/api/v1/analytics/nine-box-distribution?period_code=${periodCode}`),
          fetch(`/api/v1/performance/cascading-tree`),
        ]);
        const nbJson = await nbRes.json().catch(() => null);
        const treeJson = await treeRes.json().catch(() => null);
        if (!active) return;
        if (nbRes.ok) setNineBox(nbJson?.data ?? null);
        if (treeRes.ok) setCascade(treeJson?.data ?? null);
        if (!nbRes.ok && !treeRes.ok) {
          throw new Error(nbJson?.detail ?? treeJson?.detail ?? 'Gagal memuat data drill-down');
        }
      } catch (err) {
        if (active) setError((err as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [periodCode]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-[#64748b] py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat drill-down talenta & cascading KPI…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 rounded-lg bg-[#fce8e6] border border-[#f5c6c2] text-xs font-semibold text-[#c5221f] flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        {error}
      </div>
    );
  }

  const quadrants = nineBox?.talent_quadrants ?? [];
  const pillars = cascade?.level_2_strategic_pillars ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView('nine-box')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
            view === 'nine-box'
              ? 'bg-[#007a5a] text-white'
              : 'bg-white border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc]'
          }`}
        >
          Distribusi 9-Box
        </button>
        <button
          onClick={() => setView('cascade')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
            view === 'cascade'
              ? 'bg-[#007a5a] text-white'
              : 'bg-white border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc]'
          }`}
        >
          Cascading Visi → KPI
        </button>
      </div>

      {view === 'nine-box' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-lg bg-[#e6f4ea] border border-[#b7e1cd]">
              <p className="text-[10px] font-bold uppercase text-[#137333]">Top Talent</p>
              <p className="text-lg font-black text-[#007a5a] font-mono">
                {nineBox?.talent_summary.top_talent_count ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
              <p className="text-[10px] font-bold uppercase text-[#64748b]">Solid Core</p>
              <p className="text-lg font-black text-[#0f172a] font-mono">
                {nineBox?.talent_summary.solid_core_count ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-lg bg-[#fef7e0] border border-[#fde293]">
              <p className="text-[10px] font-bold uppercase text-[#a16207]">Perlu Pembinaan</p>
              <p className="text-lg font-black text-[#a16207] font-mono">
                {nineBox?.talent_summary.critical_development_count ?? 0}
              </p>
            </div>
          </div>

          {nineBox && nineBox.total_appraised_employees === 0 ? (
            <p className="text-xs text-[#64748b] py-4 text-center">
              Belum ada karyawan yang dievaluasi pada periode {nineBox.period_code}. Jalankan
              penghitungan nilai kinerja di cockpit manajer terlebih dahulu.
            </p>
          ) : (
            <div className="divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-lg overflow-hidden">
              {quadrants.map((q) => {
                const open = openQuadrant === q.quadrant;
                return (
                  <div key={q.quadrant}>
                    <button
                      onClick={() => setOpenQuadrant(open ? null : q.quadrant)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-[#f8fafc] text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-[#0f172a] truncate">{q.label}</p>
                        <p className="text-[10px] text-[#64748b] truncate">{q.strategic_action}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-[#64748b]">{q.percentage}%</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f1f5f9] text-[11px] font-bold text-[#334155]">
                          <Users className="h-3 w-3" />
                          {q.count}
                        </span>
                      </div>
                    </button>
                    {open && q.employees.length > 0 && (
                      <ul className="px-3 pb-2 space-y-1">
                        {q.employees.map((e) => (
                          <li
                            key={e.employee_id}
                            className="flex items-center justify-between gap-2 text-[10px] bg-[#f8fafc] rounded px-2 py-1"
                          >
                            <span className="font-semibold text-[#0f172a] truncate">
                              {e.full_name}{' '}
                              <span className="font-normal text-[#64748b]">
                                · {e.position ?? '—'}
                              </span>
                            </span>
                            <span className="font-mono text-[#007a5a] shrink-0">
                              {e.composite_gpa != null ? Number(e.composite_gpa).toFixed(2) : '—'}
                              {e.performance_rating ? ` · ${e.performance_rating}` : ''}
                            </span>
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
      )}

      {view === 'cascade' && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-[#e6f4ea] border border-[#b7e1cd]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#137333]">
              {cascade?.level_0_vision.label ?? 'Visi Perusahaan'}
            </p>
            <p className="text-xs text-[#0f172a] mt-0.5">
              {cascade?.level_0_vision.description ?? '—'}
            </p>
          </div>

          {pillars.length === 0 ? (
            <p className="text-xs text-[#64748b] py-4 text-center">
              Belum ada pilar strategis yang terhubung ke KPI korporasi.
            </p>
          ) : (
            pillars.map((p) => {
              const open = openPillar === p.pillar_id;
              const kpiCount = p.level_3_corporate_kpis.length;
              return (
                <div key={p.pillar_id} className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setOpenPillar(open ? null : p.pillar_id)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-[#f8fafc] hover:bg-[#f1f5f9] text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-[#0f172a] truncate">{p.pillar_name}</p>
                      <p className="text-[10px] text-[#64748b]">
                        {p.perspective} · bobot {p.strategic_weight_pct}%
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#e2e8f0] text-[11px] font-bold text-[#334155] shrink-0">
                      <Target className="h-3 w-3" />
                      {kpiCount}
                    </span>
                  </button>
                  {open && (
                    <div className="divide-y divide-[#f1f5f9]">
                      {p.level_3_corporate_kpis.map((c) => (
                        <div key={c.kpi_id} className="px-3 py-2">
                          <p className="text-[11px] font-semibold text-[#0f172a]">
                            {c.kpi_code ? `[${c.kpi_code}] ` : ''}
                            {c.kpi_name}
                          </p>
                          <p className="text-[10px] text-[#64748b]">
                            Target {c.target_value} {c.unit} · {c.level_4_division_kpis.length} KPI
                            divisi
                          </p>
                          {c.level_4_division_kpis.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {c.level_4_division_kpis.map((d) => (
                                <li
                                  key={d.division_kpi_id}
                                  className="text-[10px] text-[#334155] flex items-center justify-between gap-2 bg-[#f8fafc] rounded px-2 py-0.5"
                                >
                                  <span className="truncate">{d.kpi_title}</span>
                                  <span className="font-mono text-[#64748b] shrink-0">
                                    {d.weight_pct}% · {d.individual_kpis_count} ind.
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      <p className="text-[10px] text-[#94a3b8] flex items-center gap-1">
        <RefreshCw className="h-3 w-3" />
        Sumber: <code>performance_appraisals</code> &amp; <code>strategic_pillars</code> · periode{' '}
        {periodCode}
      </p>
    </div>
  );
}
