'use client';
import React, { useEffect, useState } from 'react';
import { UserPlus, Activity, LogOut, RefreshCw } from 'lucide-react';

type Phase = 'pre' | 'during' | 'post';

interface LifecycleSummary {
  mpp_fulfillment_percentage?: number;
  average_quality_of_hire?: number;
  probation_conversion_percentage?: number;
  [key: string]: unknown;
}

interface Counted {
  label: string;
  value: number | string;
  hint?: string;
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.detail ?? json?.message ?? 'Gagal memuat data');
  return json;
}

function StatGrid({ items }: { items: Counted[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-400">Belum ada data untuk fase ini.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.label} className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="text-[11px] font-semibold text-slate-500">{item.label}</div>
          <div className="text-xl font-bold text-slate-800 mt-0.5">{item.value}</div>
          {item.hint && <div className="text-[10px] text-slate-400 mt-1">{item.hint}</div>}
        </div>
      ))}
    </div>
  );
}

export default function HrLifecycleControlPanel() {
  const [phase, setPhase] = useState<Phase>('pre');
  const [summary, setSummary] = useState<LifecycleSummary | null>(null);
  const [offboardings, setOffboardings] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetchJson('/api/v1/analytics/lifecycle-summary'),
      fetchJson('/api/v1/offboarding/initiate'),
      fetchJson('/api/v1/activity-feed/company?limit=20'),
    ])
      .then((results) => {
        if (!active) return;
        const [sum, off, act] = results;
        if (sum.status === 'fulfilled' && sum.value?.status === 'success') {
          setSummary(sum.value.data);
        }
        if (off.status === 'fulfilled' && off.value?.status === 'success') {
          setOffboardings(off.value.data ?? []);
        }
        if (act.status === 'fulfilled' && act.value?.status === 'success') {
          setActivity(act.value.data?.items ?? act.value.data ?? []);
        }
        // Galat agregat dilaporkan jujur, bukan disembunyikan.
        const failures = results.filter((r) => r.status === 'rejected');
        if (failures.length === results.length) {
          setError('Seluruh sumber data lifecycle gagal dimuat.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 animate-pulse">Memuat kontrol siklus hidup...</div>;
  }

  const preItems: Counted[] = [
    {
      label: 'Pemenuhan MPP',
      value: `${summary?.mpp_fulfillment_percentage ?? 0}%`,
      hint: 'Realisasi perekrutan terhadap kuota manpower plan',
    },
    {
      label: 'Rata-rata Quality of Hire',
      value: summary?.average_quality_of_hire ?? 0,
      hint: 'Dari hasil asesmen rekrutmen',
    },
    {
      label: 'Konversi Probation',
      value: `${summary?.probation_conversion_percentage ?? 0}%`,
      hint: 'Karyawan yang lulus masa percobaan',
    },
  ];

  const duringItems: Counted[] = [
    {
      label: 'Aktivitas Tercatat',
      value: activity.length,
      hint: 'Presensi, KPI, lembur, izin, mutasi (20 terakhir)',
    },
    {
      label: 'Offboarding Aktif',
      value: offboardings.length,
      hint: 'Proses clearance berjalan',
    },
  ];

  const postItems: Counted[] = offboardings.slice(0, 6).map((off: any) => ({
    label: off.employeeName ?? 'Karyawan',
    value: `${off.handoverProgress ?? 0}%`,
    hint: `LWD ${off.lastWorkingDay ?? '-'} &bull; ${off.department ?? '-'}`,
  }));

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          {error}
        </div>
      )}

      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 w-full sm:w-auto sm:inline-flex">
        {([
          { key: 'pre', label: 'Pra-Kerja', icon: <UserPlus className="w-3.5 h-3.5" /> },
          { key: 'during', label: 'Saat-Kerja', icon: <Activity className="w-3.5 h-3.5" /> },
          { key: 'post', label: 'Pasca-Kerja', icon: <LogOut className="w-3.5 h-3.5" /> },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPhase(tab.key)}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              phase === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {phase === 'pre' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500">
            Kontrol sebelum bekerja: pemenuhan MPP, mutu rekrutmen, dan kelulusan probation.
          </p>
          <StatGrid items={preItems} />
        </div>
      )}

      {phase === 'during' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500">
            Kontrol saat bekerja: aktivitas kepegawaian terbaru lintas modul.
          </p>
          <StatGrid items={duringItems} />
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-3 border-b border-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Log Aktivitas Terbaru
            </div>
            {activity.length === 0 ? (
              <p className="p-4 text-xs text-slate-400">Belum ada aktivitas tercatat.</p>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {activity.map((item: any, idx: number) => (
                  <li key={item.id ?? idx} className="p-3 text-[11px] text-slate-600 flex items-start gap-2">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                    <span>
                      <span className="font-semibold text-slate-800">
                        {item.employeeName ?? 'Karyawan'}
                      </span>{' '}
                      <span className="text-slate-500">[{item.eventType ?? 'AKTIVITAS'}]</span>{' '}
                      {item.summary ?? ''}
                      {item.occurredAt && (
                        <span className="text-slate-400">
                          {' '}
                          &bull; {String(item.occurredAt).slice(0, 10)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {phase === 'post' && (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500">
            Kontrol setelah bekerja: progres clearance dan serah terima aset/pengetahuan.
          </p>
          {postItems.length === 0 ? (
            <p className="text-xs text-slate-400">Tidak ada proses offboarding aktif.</p>
          ) : (
            <StatGrid items={postItems} />
          )}
        </div>
      )}
    </div>
  );
}