'use client';

import { useEffect, useState } from 'react';

type Period = 'daily' | 'monthly' | 'yearly';

interface Recap {
  periodMonth: string;
  daysGreen: number;
  daysYellow: number;
  daysRed: number;
  daysNoData: number;
  avgDpi: number | null;
  entryAdherence: number | null;
}

const LABEL: Record<Period, string> = { daily: 'Harian', monthly: 'Bulanan', yearly: 'Tahunan' };

export default function PerformanceRecapTabs() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [recap, setRecap] = useState<Recap | null>(null);

  useEffect(() => {
    let active = true;
    setRecap(null);
    fetch(`/api/v1/me/performance-recap?period=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (active) setRecap(j?.data ?? null); })
      .catch(() => { /* biarkan kosong */ });
    return () => { active = false; };
  }, [period]);

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-[#0f172a]">Rekap Kinerja</h2>
        <div role="tablist" aria-label="Periode rekap" className="flex gap-1">
          {(Object.keys(LABEL) as Period[]).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] ${
                period === p ? 'bg-[#007a5a] text-white' : 'bg-[#f1f5f9] text-[#475569]'
              }`}
            >
              {LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {!recap ? (
        <p className="mt-2 text-xs text-[#64748b]">Memuat rekap…</p>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div><dt className="text-[#64748b]">Rata-rata DPI</dt><dd className="text-base font-extrabold text-[#0f172a]">{recap.avgDpi ?? '—'}</dd></div>
          <div><dt className="text-[#64748b]">Hari Hijau</dt><dd className="text-base font-extrabold text-[#0f172a]">{recap.daysGreen}</dd></div>
          <div><dt className="text-[#64748b]">Hari Kuning</dt><dd className="text-base font-extrabold text-[#0f172a]">{recap.daysYellow}</dd></div>
          <div><dt className="text-[#64748b]">Hari Merah</dt><dd className="text-base font-extrabold text-[#0f172a]">{recap.daysRed}</dd></div>
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-[#64748b]">Kepatuhan pengisian</dt>
            <dd className="text-base font-extrabold text-[#0f172a]">
              {recap.entryAdherence === null ? '—' : `${Math.round(recap.entryAdherence * 100)}%`}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
