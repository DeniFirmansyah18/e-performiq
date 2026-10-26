'use client';
import React from 'react';

export type BoardTab = 'overview' | 'activity' | 'vision' | 'position-fit' | 'cost';

export const BOARD_TABS: Array<{ key: BoardTab; label: string }> = [
  { key: 'overview', label: 'Ringkasan VMAI & BSC' },
  { key: 'activity', label: 'Aktivitas Semua Profil' },
  { key: 'vision', label: 'Visi-Misi & Analisis AI' },
  { key: 'position-fit', label: 'Kesesuaian Posisi & RJMP' },
  { key: 'cost', label: 'Payroll, BPJS & Biaya' },
];

export default function BoardTabNav({
  active,
  onChange,
}: {
  active: BoardTab;
  onChange: (tab: BoardTab) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
      {BOARD_TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
            active === tab.key
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
