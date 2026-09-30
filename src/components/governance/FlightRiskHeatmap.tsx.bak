'use client';

import React from 'react';
import { ShieldAlert, AlertTriangle, UserCheck } from 'lucide-react';

interface FlightRiskTalent {
  name: string;
  department: string;
  riskScore: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  driver: string;
}

export default function FlightRiskHeatmap() {
  const talents: FlightRiskTalent[] = [
    {
      name: 'Dimas Prasetyo, S.Kom.',
      department: 'DevOps & SRE',
      riskScore: 78,
      level: 'HIGH',
      driver: 'Jam lembur > 14 jam/minggu & anomali absensi Bradford',
    },
    {
      name: 'Rian Hidayat, S.Kom.',
      department: 'Technology',
      riskScore: 62,
      level: 'HIGH',
      driver: 'Penurunan indeks kepuasan peer review 360 & masa PKWT < 45 hari',
    },
    {
      name: 'Anisa Wijaya, S.Ds.',
      department: 'Product Design',
      riskScore: 38,
      level: 'MEDIUM',
      driver: 'Kesenjangan kompetensi teknis belum terfasilitasi modul pelatihan',
    },
    {
      name: 'Budi Pratama',
      department: 'Core Engineering',
      riskScore: 12,
      level: 'LOW',
      driver: 'Retensi stabil, performa GPA tinggi (3.67), siap suksesi Box 9',
    },
  ];

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
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
          2 Talenta Kritis Perlu Ditangani
        </span>
      </div>

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
    </div>
  );
}
