'use client';

import DataTable from '@/components/ui/DataTable';
import React, { useEffect, useState } from 'react';
import { Compass, Target, ShieldAlert, ListChecks } from 'lucide-react';
import BoardAiInsight from './BoardAiInsight';

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
  // Envelope tak terduga (mis. 200 tapi bukan JSON sukses) juga kegagalan:
  // menampilkan 0 akan membuat BOD membaca angka yang tidak pernah diukur.
  if (json?.status !== 'success' || !json?.data) {
    throw new Error(json?.detail ?? json?.message ?? 'Respons data tidak dikenali');
  }
  return json;
}

const STATUS_LABEL: Record<string, string> = {
  ACHIEVED: 'Tercapai',
  BELOW_TARGET: 'Di bawah target',
  // "Belum dinilai" (bukan "gagal"): pilar tanpa KPI adalah lubang cascade,
  // bukan kinerja buruk — pembaca BOD harus bisa membedakan keduanya.
  NO_DATA: 'Belum dinilai',
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
                      <p className="text-[10px] font-semibold text-slate-500">
                        Capaian Resmi (seluruh pilar)
                      </p>
                      <p className="text-3xl font-extrabold text-emerald-700">
                        {data?.overallAchievementPercentage ?? 0}%
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {data?.sampleSize ?? 0} KPI individual
                        {data?.periodCode ? ` · periode ${data.periodCode}` : ''}
                      </p>
                      {/* Dua angka ini sengaja dipisah: satu capaian tidak boleh
                          memikul dua arti ("gagal" vs "belum diukur"). */}
                      <p className="text-[10px] text-slate-500 mt-1">
                        Cakupan pengukuran{' '}
                        <span className="font-semibold text-slate-700">
                          {data?.measurementCoveragePercentage ?? 0}%
                        </span>{' '}
                        bobot
                        {typeof data?.measuredWeight === 'number' && typeof data?.totalWeight === 'number'
                          ? ` (${data.measuredWeight}/${data.totalWeight})`
                          : ''}
                      </p>
                      {data?.measurementCoveragePercentage < 100 && (
                        <p className="text-[10px] text-slate-500">
                          Pada bagian terukur:{' '}
                          <span className="font-semibold text-slate-700">
                            {data?.measuredAchievementPercentage ?? 0}%
                          </span>{' '}
                          — bukan angka resmi
                        </p>
                      )}
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
                            className={`h-full rounded-full ${
                              p.measured === false ? 'bg-slate-300' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${p.measured === false ? 0 : Math.min(100, p.achievementPercentage)}%` }}
                          />
                        </div>
                        <p className="text-[11px] font-semibold text-slate-700 mt-1">
                          {p.measured === false ? (
                            <span className="text-slate-500">
                              Belum dinilai &bull; 0 dari {p.strategicWeight}% bobot terukur
                            </span>
                          ) : (
                            <>
                              {p.achievementPercentage}% &bull; {p.kpiCount} KPI
                            </>
                          )}
                        </p>
                      </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-indigo-600" /> Sasaran RJMP (diturunkan dari roll-up pilar)
        </div>
          <DataTable
            rows={(data?.rjmp ?? [])}
            rowKey={(r) => r.corporateKpiId}
            searchPlaceholder="Cari kode atau sasaran..."
            itemLabel="sasaran"
            emptyMessage="Belum ada sasaran korporat."
            columns={[
            { key: 'kode', header: 'Kode', value: (r: any) => r.kpiCode, render: (r: any) => <span className="font-mono text-[11px] text-slate-500">{r.kpiCode}</span> },
            { key: 'sasaran', header: 'Sasaran', value: (r: any) => r.kpiName, render: (r: any) => r.kpiName },
            { key: 'tahun', header: 'Tahun', value: (r: any) => r.periodYear, render: (r: any) => r.periodYear },
            { key: 'target', header: 'Target', value: (r: any) => `${r.targetValue} ${r.unit}`, render: (r: any) => `${r.targetValue} ${r.unit}` },
            { key: 'capaian', header: 'Capaian Turunan', value: (r: any) => r.derivedAchievementPercentage, render: (r: any) => <span className="font-semibold text-slate-800">{r.derivedAchievementPercentage}%</span> },
            { key: 'status', header: 'Status', value: (r: any) => STATUS_LABEL[r.status] ?? r.status, render: (r: any) => STATUS_LABEL[r.status] ?? r.status },
            ]}
          />
      </div>

            {(data?.analysis?.governanceFindings ?? []).length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
                <h3 className="text-xs font-bold text-red-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Temuan Tata Kelola
                </h3>
                <p className="text-[11px] text-red-700">
                  Pilar tanpa KPI dua periode berturut-turut wajib masuk risalah BOD dan
                  ditindaklanjuti sebagai perbaikan cascade, bukan penyesuaian rumus.
                </p>
                <ul className="space-y-1">
                  {(data.analysis.governanceFindings ?? []).map((f: any) => (
                    <li key={f.pillarId} className="text-[11px] text-red-800 flex gap-2">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                      <span>
                        <span className="font-semibold">{f.pillarName}</span> — tanpa KPI pada{' '}
                        {f.periods.join(' dan ')}.
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(data?.cascadeGaps ?? []).length > 0 && (
              <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
                <div className="p-3 border-b border-amber-100 text-xs font-semibold text-slate-700 flex items-center gap-2">
                  <ListChecks className="w-3.5 h-3.5 text-amber-600" />
                  Register Cascade — KPI Korporat tanpa KPI Individual
                </div>
                <div className="divide-y divide-slate-100">
                  {(data.cascadeGaps ?? []).map((g: any) => (
                    <div key={g.corporateKpiId} className="p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-800">
                            <span className="font-mono text-[11px] text-slate-500 mr-2">{g.kpiCode}</span>
                            {g.kpiName}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {g.pillarPerspective} &bull; {g.templateCount} template jabatan,{' '}
                            {g.coveredTemplateCount} sudah punya KPI cocok
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                          Belum diturunkan
                        </span>
                      </div>
                      {(g.positionsMissingKpi ?? []).length > 0 && (
                        <p className="text-[11px] text-slate-600">
                          <span className="font-semibold">Posisi yang perlu diberi KPI:</span>{' '}
                          {g.positionsMissingKpi.join('; ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <BoardAiInsight />
    </div>
  );
}
