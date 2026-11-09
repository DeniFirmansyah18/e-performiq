'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NineBoxQuadrant } from '@/types';
import { Users, X, ArrowUpRight, CheckCircle2 } from 'lucide-react';

import { nineBoxCopy } from '@/lib/employee/nineBoxLabels';

/** Warna per kotak; dipisah dari teks agar teks punya satu sumber (nineBoxLabels). */
const QUADRANT_COLORS: Record<NineBoxQuadrant, { bg: string; border: string; text: string }> = {
  FUTURE_LEADER: { bg: 'bg-[#e6f4ea] hover:bg-[#d7ecdf]', border: 'border-[#b7e1cd]', text: 'text-[#137333]' },
  GROWTH_STAR: { bg: 'bg-[#e0f2fe] hover:bg-[#cfe8f9]', border: 'border-[#bfe3f7]', text: 'text-[#0369a1]' },
  ENIGMA: { bg: 'bg-[#e8eafd] hover:bg-[#dcdffb]', border: 'border-[#c7cbf5]', text: 'text-[#4338ca]' },
  HIGH_IMPACT: { bg: 'bg-[#e0f2f1] hover:bg-[#cdeae8]', border: 'border-[#bfe5e2]', text: 'text-[#0f766e]' },
  CORE_PLAYER: { bg: 'bg-[#f1f5f9] hover:bg-[#e8eef5]', border: 'border-[#e2e8f0]', text: 'text-[#334155]' },
  DILEMMA: { bg: 'bg-[#fef3e2] hover:bg-[#fdeacd]', border: 'border-[#fadfb8]', text: 'text-[#b45309]' },
  TRUSTED_PRO: { bg: 'bg-[#e0f5f7] hover:bg-[#cfedf1]', border: 'border-[#bce4ea]', text: 'text-[#0e7490]' },
  EFFECTIVE_PRO: { bg: 'bg-[#f8fafc] hover:bg-[#f1f5f9]', border: 'border-[#e2e8f0]', text: 'text-[#475569]' },
  UNDERPERFORMER: { bg: 'bg-[#fce8e6] hover:bg-[#fadbd8]', border: 'border-[#f5c6c0]', text: 'text-[#c5221f]' },
};

interface Props {
  employees?: any[];
}

export default function NineBoxGrid({ employees: propEmployees }: Props) {
  const [employees, setEmployees] = useState<any[]>(propEmployees || []);
  const [selectedQuadrant, setSelectedQuadrant] = useState<NineBoxQuadrant | null>(null);

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
      <div className="relative border border-[#e2e8f0] rounded-2xl p-4 bg-white">
        
        {/* Y Axis Label (Potential) */}
        <div className="flex items-center justify-between mb-3 text-xs text-[#64748b] font-semibold px-2">
          <span>Potensi Karyawan (Sumbu Y)</span>
          <span>Kinerja / KPI (Sumbu X) &rarr;</span>
        </div>

        {/* 3x3 Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {matrix.map((row, rIdx) =>
            row.map((quadCode, cIdx) => {
              const info = nineBoxCopy(quadCode);
              const color = QUADRANT_COLORS[quadCode];
              const quadEmps = getEmployeesInQuad(quadCode);
              return (
                <button
                  key={quadCode}
                  onClick={() => setSelectedQuadrant(quadCode)}
                  className={`flex flex-col justify-between p-3 rounded-xl border text-left transition-all group ${color.bg} ${color.border} shadow-sm`}
                >
                  <div className="flex items-start justify-between w-full">
                    <span className={`text-xs font-bold ${color.text} group-hover:underline flex items-center gap-1`}>
                      {info.name}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-white border border-[#e2e8f0] text-[#0f172a]">
                      <Users className="h-3 w-3 text-[#64748b]" />
                      {quadEmps.length}
                    </span>
                  </div>

                  <p className="text-[10px] text-[#475569] mt-2 line-clamp-2 leading-relaxed">
                    {info.short}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-[#e2e8f0] w-full text-[10px] text-[#64748b]">
                    <span>Lihat Daftar &rarr;</span>
                    {quadEmps.length > 0 && (
                      <div className="flex -space-x-1.5">
                        {quadEmps.slice(0, 3).map((e) => (
                          <img
                            key={e.id}
                            src={e.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                            alt={e.fullName}
                            className="h-4 w-4 rounded-full border border-white object-cover"
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
        <div className="grid grid-cols-3 gap-2.5 mt-2 text-center text-[10px] font-semibold text-[#64748b]">
          <div>Rendah (&lt; 75%)</div>
          <div>Menengah (75 - 89.9%)</div>
          <div className="text-[#137333]">Tinggi (&ge; 90%)</div>
        </div>
      </div>

      {/* Detail Modal for Selected Quadrant */}
      {selectedQuadrant && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-base font-bold ${QUADRANT_COLORS[selectedQuadrant].text}`}>
                    {nineBoxCopy(selectedQuadrant).name}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#f1f5f9] border border-[#e2e8f0] text-[#475569]">
                    {getEmployeesInQuad(selectedQuadrant).length} Karyawan
                  </span>
                </div>
                <p className="text-xs text-[#64748b] mt-1">
                  Rekomendasi Strategis: {nineBoxCopy(selectedQuadrant).firstStep}
                </p>
              </div>
              <button
                onClick={() => setSelectedQuadrant(null)}
                className="p-1 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Employee Roster in this quadrant */}
            <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
              {getEmployeesInQuad(selectedQuadrant).length > 0 ? (
                getEmployeesInQuad(selectedQuadrant).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={e.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt={e.fullName}
                        className="h-9 w-9 rounded-full object-cover border border-[#e2e8f0]"
                      />
                      <div>
                        <p className="text-xs font-bold text-[#0f172a]">{e.fullName}</p>
                        <p className="text-[11px] text-[#64748b]">{e.position}</p>
                        <span className="text-[10px] text-[#64748b] font-mono">{e.employeeCode}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 text-xs font-bold rounded-md bg-[#e0f2fe] border border-[#bfe3f7] text-[#0369a1] font-mono">
                        GPA {e.gpa?.toFixed(2) || '3.50'}
                      </span>
                      <p className="text-[10px] text-[#137333] font-semibold mt-0.5">Rating {e.rating || 'A'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-[#64748b]">
                  Tidak ada karyawan yang berada di kuadran ini pada periode aktif.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedQuadrant(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#f1f5f9] text-[#334155] hover:bg-[#e2e8f0] transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
