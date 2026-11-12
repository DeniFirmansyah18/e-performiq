'use client';
import React from 'react';

export type BoardTab = 'overview' | 'vision' | 'cost' | 'position-fit' | 'activity' | 'mpp-approval';

export interface BoardTabItem {
  key: BoardTab;
  step: number;
  label: string;
  shortLabel: string;
  tooltip: string;
}

export const BOARD_TABS: BoardTabItem[] = [
  {
    key: 'overview',
    step: 1,
    label: '1. Kesehatan Perusahaan',
    shortLabel: 'Kesehatan Bisnis',
    tooltip: 'Langkah 1: Tinjau skor kesehatan korporasi, pencapaian target utama, dan ikhtisar 4 pilar bisnis',
  },
  {
    key: 'vision',
    step: 2,
    label: '2. Arah Strategi & Saran AI',
    shortLabel: 'Strategi & Visi',
    tooltip: 'Langkah 2: Periksa keselarasan operasional dengan visi-misi serta analisis rekomendasi kecerdasan buatan',
  },
  {
    key: 'cost',
    step: 3,
    label: '3. Biaya & Gaji Karyawan',
    shortLabel: 'Biaya & Gaji',
    tooltip: 'Langkah 3: Pantau total pengeluaran gaji bersih, biaya per karyawan, lembur, dan anggaran operasional',
  },
  {
    key: 'position-fit',
    step: 4,
    label: '4. Peta Talenta & Posisi Kunci',
    shortLabel: 'Talenta & Posisi',
    tooltip: 'Langkah 4: Evaluasi kesesuaian pejabat struktural, pemenuhan kompetensi, dan calon suksesor posisi kritis',
  },
  {
    key: 'activity',
    step: 5,
    label: '5. Aktivitas & Kepatuhan Tim',
    shortLabel: 'Aktivitas Kerja',
    tooltip: 'Langkah 5: Tinjau catatan rutinitas kerja harian, partisipasi karyawan aktif, dan integritas kepatuhan',
  },
  {
    key: 'mpp-approval',
    step: 6,
    label: '6. Persetujuan MPP',
    shortLabel: 'Persetujuan MPP',
    tooltip: 'Langkah 6: Putuskan pengajuan kebutuhan formasi (MPP) yang diajukan HRD, dengan bantuan rekomendasi AI',
  },
];

export default function BoardTabNav({
  active,
  onChange,
}: {
  active: BoardTab;
  onChange: (tab: BoardTab) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 overflow-x-auto">
      {BOARD_TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            title={tab.tooltip}
            className={`group relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              isActive
                ? 'bg-[#0f172a] text-white shadow-sm ring-2 ring-[#0f172a]/20'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-slate-200 shadow-2xs'
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black ${
                isActive ? 'bg-[#007a5a] text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
              }`}
            >
              {tab.step}
            </span>
            <span>{tab.label.replace(/^\d+\.\s*/, '')}</span>
          </button>
        );
      })}
    </div>
  );
}
