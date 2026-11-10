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

/** Kamus penerjemahan 9-box ke istilah bahasa Indonesia yang ramah bagi pimpinan/CEO awam */
const QUADRANT_DISPLAY: Record<string, { label: string; action: string; tag: string }> = {
  FUTURE_LEADER: {
    label: 'Calon Pemimpin Masa Depan (Bintang Utama)',
    action: 'Disiapkan untuk jalur promosi kepemimpinan & bimbingan direksi',
    tag: 'Siap Promosi',
  },
  GROWTH_STAR: {
    label: 'Bintang Berkembang (Potensi Tinggi)',
    action: 'Diberikan penugasan strategis & rotasi pengalaman baru',
    tag: 'Pengembangan Cepat',
  },
  ENIGMA: {
    label: 'Potensi Bagus (Kinerja Perlu Penyesuaian)',
    action: 'Cari hambatan kerja & sesuaikan peran yang lebih cocok',
    tag: 'Perlu Arahan',
  },
  HIGH_IMPACT: {
    label: 'Ahli Berkinerja Tinggi (Spesialis Handal)',
    action: 'Berikan apresiasi & insentif retensi jangka panjang',
    tag: 'Spesialis Utama',
  },
  CORE_PLAYER: {
    label: 'Pekerja Inti (Konsisten & Berkelanjutan)',
    action: 'Beri pengakuan operasional & jaga stabilitas kerja',
    tag: 'Tulang Punggung',
  },
  DILEMMA: {
    label: 'Perlu Peningkatan Keterampilan',
    action: 'Ikutkan pelatihan keterampilan dasar & pantau 60 hari',
    tag: 'Pelatihan Tambahan',
  },
  TRUSTED_PRO: {
    label: 'Tenaga Profesional Terpercaya',
    action: 'Jadikan panutan & pembimbing rekan kerja lainnya',
    tag: 'Mentor Lapangan',
  },
  EFFECTIVE_PRO: {
    label: 'Pekerja Efektif (Standar Terpenuhi)',
    action: 'Pertahankan standar kerja & kepatuhan prosedur harian',
    tag: 'Kinerja Stabil',
  },
  UNDERPERFORMER: {
    label: 'Kinerja di Bawah Target Standar',
    action: 'Konseling empat mata & program pembinaan terarah',
    tag: 'Perhatian Khusus',
  },
};

const RATING_LABEL: Record<string, string> = {
  OUTSTANDING: 'Sangat Memuaskan',
  EXCEEDS_EXPECTATIONS: 'Melampaui Target',
  MEETS_EXPECTATIONS: 'Sesuai Target',
  BELOW_EXPECTATIONS: 'Di Bawah Target',
  NEEDS_IMPROVEMENT: 'Perlu Perbaikan',
};

const PERSPECTIVE_LABEL: Record<string, string> = {
  FINANCIAL: 'Perspektif Keuangan',
  CUSTOMER: 'Perspektif Pelanggan & Mitra',
  INTERNAL_PROCESS: 'Perspektif Proses Operasional',
  LEARNING_GROWTH: 'Perspektif Pengembangan SDM',
};

/**
 * Drill-down eksekutif: penelusuran nama pegawai berdasarkan kelompok bakat kinerja
 * dan alur penurunan target perusahaan ke level divisi.
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
          throw new Error(nbJson?.detail ?? treeJson?.detail ?? 'Gagal memuat data rincian');
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
        <Loader2 className="h-4 w-4 animate-spin text-[#007a5a]" />
        Memuat daftar rincian karyawan &amp; alur target perusahaan…
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
      {/* Tab Menu Pilihan Tampilan */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setView('nine-box')}
          title="Melihat pembagian pegawai berdasarkan hasil kerja dan potensi pengembangannya"
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            view === 'nine-box'
              ? 'bg-[#007a5a] text-white shadow-2xs'
              : 'bg-white border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc]'
          }`}
        >
          👥 Peta Bakat Pegawai (9 Kategori)
        </button>
        <button
          onClick={() => setView('cascade')}
          title="Melihat bagaimana target besar perusahaan diturunkan ke masing-masing divisi"
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            view === 'cascade'
              ? 'bg-[#007a5a] text-white shadow-2xs'
              : 'bg-white border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc]'
          }`}
        >
          🎯 Alur Target Kerja (Perusahaan → Divisi)
        </button>
      </div>

      {view === 'nine-box' && (
        <div className="space-y-3">
          {/* 3 Kartu Ringkasan Kategori Utama */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-xl bg-[#e6f4ea] border border-[#b7e1cd]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#137333]">Bakat Terbaik (Calon Pemimpin)</p>
              <p className="text-xl font-black text-[#007a5a] font-mono mt-0.5">
                {nineBox?.talent_summary.top_talent_count ?? 0} Orang
              </p>
              <p className="text-[10px] text-[#137333] mt-1">Berkinerja unggul &amp; berpotensi tinggi</p>
            </div>
            <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#334155]">Pekerja Utama (Andalan Harian)</p>
              <p className="text-xl font-black text-[#0f172a] font-mono mt-0.5">
                {nineBox?.talent_summary.solid_core_count ?? 0} Orang
              </p>
              <p className="text-[10px] text-[#64748b] mt-1">Bekerja stabil penopang operasional</p>
            </div>
            <div className="p-3 rounded-xl bg-[#fef7e0] border border-[#fde293]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#a16207]">Perlu Bimbingan &amp; Pelatihan</p>
              <p className="text-xl font-black text-[#a16207] font-mono mt-0.5">
                {nineBox?.talent_summary.critical_development_count ?? 0} Orang
              </p>
              <p className="text-[10px] text-[#854d0e] mt-1">Memerlukan pendampingan kinerja</p>
            </div>
          </div>

          {nineBox && nineBox.total_appraised_employees === 0 ? (
            <p className="text-xs text-[#64748b] py-4 text-center">
              Belum ada karyawan yang dievaluasi pada periode {nineBox.period_code}. Jalankan
              penghitungan nilai kinerja di cockpit manajer terlebih dahulu.
            </p>
          ) : (
            <div className="divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-xl overflow-hidden bg-white shadow-2xs">
              {quadrants.map((q) => {
                const open = openQuadrant === q.quadrant;
                const info = QUADRANT_DISPLAY[q.quadrant] || {
                  label: q.label,
                  action: q.strategic_action,
                  tag: 'Evaluasi',
                };
                return (
                  <div key={q.quadrant} className="transition-colors">
                    <button
                      onClick={() => setOpenQuadrant(open ? null : q.quadrant)}
                      className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-[#f8fafc] text-left cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-[#0f172a] truncate">{info.label}</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {info.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748b] truncate mt-0.5">{info.action}</p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-xs font-semibold text-[#64748b]">{q.percentage}%</span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f1f5f9] text-xs font-bold text-[#334155] border border-slate-200">
                          <Users className="h-3.5 w-3.5 text-[#007a5a]" />
                          {q.count} Orang
                        </span>
                      </div>
                    </button>
                    {open && q.employees.length > 0 && (
                      <ul className="px-3.5 pb-3 space-y-1.5 bg-[#f8fafc]/50">
                        {q.employees.map((e) => (
                          <li
                            key={e.employee_id}
                            className="flex items-center justify-between gap-2 text-xs bg-white border border-[#e2e8f0] rounded-lg px-3 py-1.5 shadow-2xs"
                          >
                            <span className="font-semibold text-[#0f172a] truncate">
                              {e.full_name}{' '}
                              <span className="font-normal text-[#64748b]">
                                · {e.position ?? '—'}
                              </span>
                            </span>
                            <span className="text-[11px] text-[#007a5a] font-semibold shrink-0">
                              {e.composite_gpa != null ? `Nilai Kinerja: ${Number(e.composite_gpa).toFixed(2)} / 4.00` : 'Nilai: —'}
                              {e.performance_rating ? ` · ${RATING_LABEL[e.performance_rating] ?? e.performance_rating}` : ''}
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
          {/* Tujuan Utama Perusahaan (Visi) */}
          <div className="p-3.5 rounded-xl bg-[#e6f4ea] border border-[#b7e1cd]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#137333]">
              Tujuan Utama Perusahaan (Visi)
            </p>
            <p className="text-xs text-[#0f172a] font-medium mt-0.5 leading-relaxed">
              {cascade?.level_0_vision.description ?? '—'}
            </p>
          </div>

          {pillars.length === 0 ? (
            <p className="text-xs text-[#64748b] py-4 text-center">
              Belum ada target pilar strategis yang diturunkan ke divisi.
            </p>
          ) : (
            pillars.map((p) => {
              const open = openPillar === p.pillar_id;
              const kpiCount = p.level_3_corporate_kpis.length;
              return (
                <div key={p.pillar_id} className="border border-[#e2e8f0] rounded-xl overflow-hidden shadow-2xs bg-white">
                  <button
                    onClick={() => setOpenPillar(open ? null : p.pillar_id)}
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-[#f8fafc] hover:bg-[#f1f5f9] text-left cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#0f172a] truncate">{p.pillar_name}</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">
                        {PERSPECTIVE_LABEL[p.perspective] ?? p.perspective} · Porsi Beban: {p.strategic_weight_pct}%
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-[#cbd5e1] text-xs font-bold text-[#334155] shrink-0">
                      <Target className="h-3.5 w-3.5 text-[#007a5a]" />
                      {kpiCount} Sasaran Utama
                    </span>
                  </button>
                  {open && (
                    <div className="divide-y divide-[#f1f5f9] bg-white">
                      {p.level_3_corporate_kpis.map((c) => (
                        <div key={c.kpi_id} className="px-3.5 py-2.5">
                          <p className="text-xs font-bold text-[#0f172a]">
                            {c.kpi_code ? `[${c.kpi_code}] ` : ''}
                            {c.kpi_name}
                          </p>
                          <p className="text-[11px] text-[#64748b] mt-0.5">
                            Target Korporat: <strong className="text-[#0f172a]">{c.target_value} {c.unit}</strong> · Diturunkan ke {c.level_4_division_kpis.length} Unit Kerja
                          </p>
                          {c.level_4_division_kpis.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {c.level_4_division_kpis.map((d) => (
                                <li
                                  key={d.division_kpi_id}
                                  className="text-xs text-[#334155] flex items-center justify-between gap-2 bg-[#f8fafc] border border-slate-100 rounded-lg px-2.5 py-1.5"
                                >
                                  <span className="truncate font-medium">{d.kpi_title}</span>
                                  <span className="text-[11px] font-semibold text-[#64748b] shrink-0">
                                    Beban Divisi: {d.weight_pct}% · Dikerjakan {d.individual_kpis_count} Pegawai
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

      {/* Footer Catatan Transparansi Data */}
      <p className="text-[11px] text-[#94a3b8] flex items-center gap-1.5 pt-2">
        <RefreshCw className="h-3 w-3" />
        Data resmi dari evaluasi kinerja pegawai &amp; rencana kerja perusahaan · Periode {periodCode}
      </p>
    </div>
  );
}
