'use client';

import React, { useState, useEffect } from 'react';
import { NineBoxQuadrant } from '@/types';
import { Users, X, ArrowUpRight, Sparkles, CheckCircle2 } from 'lucide-react';

interface QuadrantInfo {
  code: NineBoxQuadrant;
  name: string;
  action: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

interface Props {
  employees?: any[];
}

export default function NineBoxGrid({ employees: propEmployees }: Props) {
  const [employees, setEmployees] = useState<any[]>(propEmployees || []);
  const [selectedQuadrant, setSelectedQuadrant] = useState<QuadrantInfo | null>(null);

  useEffect(() => {
    if (propEmployees) {
      setEmployees(propEmployees);
      return;
    }
    async function load() {
      try {
        const res = await fetch('/api/v1/analytics/nine-box-distribution');
        if (res.ok) {
          const json = await res.json();
          const emps: any[] = [];
          (json.data?.talent_quadrants || []).forEach((q: any) => {
            (q.employees || []).forEach((e: any) => {
              emps.push({
                id: e.employee_id,
                fullName: e.full_name,
                employeeCode: e.employee_code,
                department: e.department,
                position: e.position,
                gpa: e.composite_gpa,
                rating: e.performance_rating,
                nineBoxQuadrant: q.quadrant,
              });
            });
          });
          setEmployees(emps);
        }
      } catch {
        // fallback
      }
    }
    load();
  }, [propEmployees]);

  const quadrantDefs: Record<NineBoxQuadrant, QuadrantInfo> = {
    FUTURE_LEADER: {
      code: 'FUTURE_LEADER',
      name: 'Future Leader (Star)',
      action: 'Fast-track promosi & program suksesi kepemimpinan C-Level',
      badgeBg: 'bg-emerald-950/40 hover:bg-emerald-900/40',
      badgeBorder: 'border-emerald-500/40',
      badgeText: 'text-emerald-400',
    },
    GROWTH_STAR: {
      code: 'GROWTH_STAR',
      name: 'Growth Star',
      action: 'Perluasan tanggung jawab & mentoring strategis',
      badgeBg: 'bg-blue-950/40 hover:bg-blue-900/40',
      badgeBorder: 'border-blue-500/40',
      badgeText: 'text-blue-400',
    },
    ENIGMA: {
      code: 'ENIGMA',
      name: 'Enigma (High Potential)',
      action: 'Eksplorasi penempatan peran baru atau evaluasi hambatan teknis',
      badgeBg: 'bg-indigo-950/40 hover:bg-indigo-900/40',
      badgeBorder: 'border-indigo-500/40',
      badgeText: 'text-indigo-400',
    },
    HIGH_IMPACT: {
      code: 'HIGH_IMPACT',
      name: 'High Impact Specialist',
      action: 'Pertahankan retensi, insentif performa, & program subject-matter expert',
      badgeBg: 'bg-teal-950/40 hover:bg-teal-900/40',
      badgeBorder: 'border-teal-500/40',
      badgeText: 'text-teal-400',
    },
    CORE_PLAYER: {
      code: 'CORE_PLAYER',
      name: 'Core Player',
      action: 'Pelatihan pengembangan hard skill & motivasi kontribusi',
      badgeBg: 'bg-slate-900/80 hover:bg-slate-800/80',
      badgeBorder: 'border-slate-700/60',
      badgeText: 'text-slate-300',
    },
    DILEMMA: {
      code: 'DILEMMA',
      name: 'Dilemma / Inconsistent',
      action: 'Coaching intensif performa bulanan dengan batas waktu evaluasi',
      badgeBg: 'bg-amber-950/40 hover:bg-amber-900/40',
      badgeBorder: 'border-amber-500/40',
      badgeText: 'text-amber-400',
    },
    TRUSTED_PRO: {
      code: 'TRUSTED_PRO',
      name: 'Trusted Professional',
      action: 'Andalan operasional, beri peran mentor bagi staf baru',
      badgeBg: 'bg-cyan-950/40 hover:bg-cyan-900/40',
      badgeBorder: 'border-cyan-500/40',
      badgeText: 'text-cyan-400',
    },
    EFFECTIVE_PRO: {
      code: 'EFFECTIVE_PRO',
      name: 'Effective Contributor',
      action: 'Review target kerja & simplifikasi hambatan birokrasi tugas',
      badgeBg: 'bg-slate-900/60 hover:bg-slate-800/60',
      badgeBorder: 'border-slate-800',
      badgeText: 'text-slate-400',
    },
    UNDERPERFORMER: {
      code: 'UNDERPERFORMER',
      name: 'Risk / Underperformer',
      action: 'Performance Improvement Plan (PIP 60 hari) atau rotasi departemen',
      badgeBg: 'bg-rose-950/40 hover:bg-rose-900/40',
      badgeBorder: 'border-rose-500/40',
      badgeText: 'text-rose-400',
    },
  };

  // 3x3 Grid Layout Matrix: [Row High Pot, Row Med Pot, Row Low Pot]
  const matrix: NineBoxQuadrant[][] = [
    ['ENIGMA', 'GROWTH_STAR', 'FUTURE_LEADER'],
    ['DILEMMA', 'CORE_PLAYER', 'HIGH_IMPACT'],
    ['UNDERPERFORMER', 'EFFECTIVE_PRO', 'TRUSTED_PRO'],
  ];

  // Helper to get employees in a quadrant
  const getEmployeesInQuad = (code: NineBoxQuadrant) => {
    return employees.filter((e) => e.nineBoxQuadrant === code);
  };

  return (
    <div className="w-full">
      {/* 9-Box Grid Container */}
      <div className="relative border border-slate-800 rounded-2xl p-4 bg-slate-950/60">
        
        {/* Y Axis Label (Potential) */}
        <div className="flex items-center justify-between mb-3 text-xs text-slate-400 font-semibold px-2">
          <span>Potensi Karyawan (Sumbu Y)</span>
          <span>Kinerja / KPI (Sumbu X) &rarr;</span>
        </div>

        {/* 3x3 Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {matrix.map((row, rIdx) =>
            row.map((quadCode, cIdx) => {
              const info = quadrantDefs[quadCode];
              const quadEmps = getEmployeesInQuad(quadCode);
              return (
                <button
                  key={quadCode}
                  onClick={() => setSelectedQuadrant(info)}
                  className={`flex flex-col justify-between p-3 rounded-xl border text-left transition-all group ${info.badgeBg} ${info.badgeBorder} shadow-sm`}
                >
                  <div className="flex items-start justify-between w-full">
                    <span className={`text-xs font-bold ${info.badgeText} group-hover:underline flex items-center gap-1`}>
                      {info.name}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-slate-900/80 border border-slate-700 text-slate-200">
                      <Users className="h-3 w-3 text-slate-400" />
                      {quadEmps.length}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {info.action}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-800/60 w-full text-[10px] text-slate-400">
                    <span>Lihat Daftar &rarr;</span>
                    {quadEmps.length > 0 && (
                      <div className="flex -space-x-1.5">
                        {quadEmps.slice(0, 3).map((e) => (
                          <img
                            key={e.id}
                            src={e.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                            alt={e.fullName}
                            className="h-4 w-4 rounded-full border border-slate-900 object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Matrix Axes Indicators */}
        <div className="grid grid-cols-3 gap-2.5 mt-2 text-center text-[10px] font-semibold text-slate-400">
          <div>Rendah (&lt; 75%)</div>
          <div>Menengah (75 - 89.9%)</div>
          <div className="text-emerald-400">Tinggi (&ge; 90%)</div>
        </div>
      </div>

      {/* Detail Modal for Selected Quadrant */}
      {selectedQuadrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-base font-bold ${selectedQuadrant.badgeText}`}>
                    {selectedQuadrant.name}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                    {getEmployeesInQuad(selectedQuadrant.code).length} Karyawan
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Rekomendasi Strategis: {selectedQuadrant.action}
                </p>
              </div>
              <button
                onClick={() => setSelectedQuadrant(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Employee Roster in this quadrant */}
            <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
              {getEmployeesInQuad(selectedQuadrant.code).length > 0 ? (
                getEmployeesInQuad(selectedQuadrant.code).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={e.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt={e.fullName}
                        className="h-9 w-9 rounded-full object-cover border border-slate-700"
                      />
                      <div>
                        <p className="text-xs font-bold text-white">{e.fullName}</p>
                        <p className="text-[11px] text-slate-400">{e.position}</p>
                        <span className="text-[10px] text-slate-400 font-mono">{e.employeeCode}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 text-xs font-bold rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono">
                        GPA {e.gpa?.toFixed(2) || '3.50'}
                      </span>
                      <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">Rating {e.rating || 'A'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  Tidak ada karyawan yang berada di kuadran ini pada periode aktif.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedQuadrant(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
