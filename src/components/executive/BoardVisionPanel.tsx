'use client';
import React, { useEffect, useState } from 'react';
import { Compass, Target } from 'lucide-react';
import BoardAiInsight from './BoardAiInsight';

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
  return json;
}

const STATUS_LABEL: Record<string, string> = {
  ACHIEVED: 'Tercapai',
  BELOW_TARGET: 'Di bawah target',
  NO_DATA: 'Belum ada KPI',
};

export default function BoardVisionPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchJson('/api/v1/analytics/vision-achievement')
      .then((json) => {
        if (active && json?.status === 'success') setData(json.data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat capaian visi-misi...</div>;
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
        Gagal memuat capaian visi-misi: {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Compass className="w-6 h-6 text-emerald-700 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Visi</p>
              <p className="text-sm font-semibold text-slate-800">
                {data?.vision ?? 'Visi perusahaan belum ditetapkan.'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Misi</p>
              <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-0.5">
                {(data?.missions ?? []).map((m: string, i: number) => (
                  <li key={i}>{m}</li>
                ))}
                {(data?.missions ?? []).length === 0 && (
                  <li className="list-none text-slate-500">Misi belum ditetapkan.</li>
                )}
              </ul>
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] font-semibold text-slate-500">Capaian Keseluruhan</p>
            <p className="text-3xl font-extrabold text-emerald-700">
              {data?.overallAchievementPercentage ?? 0}%
            </p>
            <p className="text-[10px] text-slate-500">
              {data?.sampleSize ?? 0} KPI individual
              {data?.periodCode ? ` · periode ${data.periodCode}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(data?.pillars ?? []).map((p: any) => (
          <div key={p.pillarId} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="text-xs font-semibold text-slate-800">{p.pillarName}</p>
                <p className="text-[10px] text-slate-500">
                  {p.perspective} &bull; bobot {p.strategicWeight}%
                </p>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                  p.status === 'ACHIEVED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : p.status === 'BELOW_TARGET'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${Math.min(100, p.achievementPercentage)}%` }}
              />
            </div>
            <p className="text-[11px] font-semibold text-slate-700 mt-1">
              {p.achievementPercentage}% &bull; {p.kpiCount} KPI
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-indigo-600" /> Sasaran RJMP (diturunkan dari roll-up pilar)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3">Kode</th>
                <th className="p-3">Sasaran</th>
                <th className="p-3">Tahun</th>
                <th className="p-3">Target</th>
                <th className="p-3">Capaian Turunan</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.rjmp ?? []).map((r: any) => (
                <tr key={r.corporateKpiId} className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-[11px] text-slate-500">{r.kpiCode}</td>
                  <td className="p-3">{r.kpiName}</td>
                  <td className="p-3">{r.periodYear}</td>
                  <td className="p-3">
                    {r.targetValue} {r.unit}
                  </td>
                  <td className="p-3 font-semibold text-slate-800">
                    {r.derivedAchievementPercentage}%
                  </td>
                  <td className="p-3">{STATUS_LABEL[r.status] ?? r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <BoardAiInsight />
    </div>
  );
}
