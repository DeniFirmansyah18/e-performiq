'use client';

import React, { useEffect, useState } from 'react';
import { TrendingDown } from 'lucide-react';

/**
 * Panel analitik keluar: alasan dominan, sebaran per unit, tren bulanan,
 * dan biaya pesangon yang benar-benar sudah dibayar.
 */
function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function ExitAnalyticsPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/v1/post-employment/exit-analytics');
        const json = await res.json();
        if (res.ok) setData(json?.data ?? null);
        else setError(json?.detail || json?.message || 'Gagal memuat analitik keluar.');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cards = data
    ? [
        { label: 'Total keluar', value: String(data.totalExits), tone: 'text-[#0f172a] bg-[#f1f5f9]' },
        {
          label: 'Keluar 12 bulan terakhir',
          value: String(data.exitsLast12Months),
          tone: 'text-[#0284c7] bg-[#e0f2fe]',
        },
        {
          label: 'Atrisi bernilai tinggi',
          value: `${data.regrettableExits} (${data.regrettablePercentage}%)`,
          tone: 'text-[#b45309] bg-[#fef3c7]',
        },
        {
          label: 'Masa kerja rata-rata',
          value: `${data.averageTenureMonths} bulan`,
          tone: 'text-[#007a5a] bg-[#e6f4f0]',
        },
      ]
    : [];

  return (
    <div className="p-5 rounded-2xl border border-[#e2e8f0] bg-white space-y-4">
      <div>
        <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-[#007a5a]" />
          <span>Analitik Keluar &amp; Biaya</span>
        </h3>
        <p className="text-[11px] text-[#64748b]">
          Pola pengunduran diri, unit dengan atrisi tertinggi, dan nilai pesangon yang sudah dibayar.
        </p>
      </div>

      {loading ? (
        <p className="text-[11px] text-[#64748b]">Memuat analitik...</p>
      ) : error ? (
        <p className="text-[11px] text-[#b91c1c] p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca]">{error}</p>
      ) : !data || data.totalExits === 0 ? (
        <p className="text-[11px] text-[#64748b] p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
          Belum ada data karyawan keluar untuk dianalisis.
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className={`rounded-xl p-3 ${c.tone}`}>
                <p className="text-[10px] font-semibold opacity-80">{c.label}</p>
                <p className="text-sm font-extrabold mt-0.5">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
              <p className="text-[11px] font-bold text-[#0f172a] mb-2">Alasan keluar</p>
              <div className="space-y-1.5">
                {(data.exitReasons ?? []).map((r: any) => (
                  <div key={r.reason} className="flex items-center justify-between text-[11px]">
                    <span className="text-[#334155]">{r.reason}</span>
                    <span className="font-bold text-[#0f172a]">
                      {r.total} ({r.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
              <p className="text-[11px] font-bold text-[#0f172a] mb-2">Unit kerja dengan atrisi tertinggi</p>
              <div className="space-y-1.5">
                {(data.byDepartment ?? []).slice(0, 6).map((d: any) => (
                  <div key={d.department} className="flex items-center justify-between text-[11px]">
                    <span className="text-[#334155]">{d.department}</span>
                    <span className="font-bold text-[#0f172a]">{d.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
            <p className="text-[11px] font-bold text-[#0f172a] mb-2">Biaya keluar</p>
            <div className="grid gap-2 sm:grid-cols-3 text-[11px]">
              <div>
                <p className="text-[#64748b]">Total pesangon dibayar</p>
                <p className="font-bold text-[#0f172a]">{formatRupiah(data.totalExitCost)}</p>
              </div>
              <div>
                <p className="text-[#64748b]">Rata-rata per kasus</p>
                <p className="font-bold text-[#0f172a]">{formatRupiah(data.averageExitCost)}</p>
              </div>
              <div>
                <p className="text-[#64748b]">Potensi penghematan bulanan</p>
                <p className="font-bold text-[#007a5a]">{formatRupiah(data.potentialMonthlySaving)}</p>
              </div>
            </div>
          </div>

          {data.averageExitRating != null && (
            <p className="text-[11px] text-[#64748b]">
              Rata-rata penilaian wawancara keluar: <span className="font-bold text-[#0f172a]">{data.averageExitRating}/5</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
