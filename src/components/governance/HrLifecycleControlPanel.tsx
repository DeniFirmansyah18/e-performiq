'use client';
import React, { useEffect, useState } from 'react';
import { UserPlus, Activity, LogOut } from 'lucide-react';
import { PHASE_LABEL, type WorkPhase } from '@/lib/employee/phase';

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
    return <p className="text-xs text-[#94a3b8]">Belum ada data untuk fase ini.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item, idx) => (
        <div key={`${item.label}-${idx}`} className="p-4 rounded-xl border border-[#e2e8f0] bg-white">
          <div className="text-[11px] font-semibold text-[#64748b]">{item.label}</div>
          <div className="text-xl font-black text-[#0f172a] mt-0.5">{item.value}</div>
          {item.hint && <div className="text-[10px] text-[#94a3b8] mt-1">{item.hint}</div>}
        </div>
      ))}
    </div>
  );
}

export default function HrLifecycleControlPanel({
  phase: controlledPhase,
  showPhaseSwitch = false,
}: {
  phase?: WorkPhase;
  showPhaseSwitch?: boolean;
} = {}) {
  const [localPhase, setLocalPhase] = useState<WorkPhase>('PRE');
  const phase = controlledPhase ?? localPhase;
  const setPhase = setLocalPhase;
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
    return <div className="p-6 text-sm text-[#64748b] animate-pulse">Memuat kontrol siklus hidup...</div>;
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
    // Pakai karakter literal: nilai ini dirender sebagai teks, bukan HTML.
    hint: `LWD ${off.lastWorkingDay ?? '-'} • ${off.department ?? '-'}`,
  }));

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-[#fce8e6] border border-[#f5c6c0] text-xs text-[#c5221f]">
          {error}
        </div>
      )}

      {showPhaseSwitch && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-[#334155]">
            Pilih tahap perjalanan karyawan:
          </p>
          {/* Tiga kartu tahap: lebih besar, jelas, dan menyebutkan isinya. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {([
              {
                key: 'PRE',
                label: PHASE_LABEL.PRE,
                icon: <UserPlus className="w-4 h-4" />,
                isi: 'Rekrutmen & masa percobaan',
              },
              {
                key: 'DURING',
                label: PHASE_LABEL.DURING,
                icon: <Activity className="w-4 h-4" />,
                isi: 'Aktivitas kerja berjalan',
              },
              {
                key: 'POST',
                label: PHASE_LABEL.POST,
                icon: <LogOut className="w-4 h-4" />,
                isi: 'Serah terima & pesangon',
              },
            ] as const).map((tab, idx, arr) => {
              const aktif = phase === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setPhase(tab.key)}
                  aria-pressed={aktif}
                  className={`relative text-left rounded-xl border p-3 transition-all ${
                    aktif
                      ? 'bg-[#007a5a] border-[#007a5a] text-white shadow-sm'
                      : 'bg-white border-[#e2e8f0] text-[#334155] hover:border-[#94a3b8] hover:bg-[#f8fafc]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                        aktif ? 'bg-white/20 text-white' : 'bg-[#f1f5f9] text-[#64748b]'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    {tab.icon}
                    <span className="text-xs font-extrabold">{tab.label}</span>
                  </div>
                  <p className={`mt-1 text-[10px] leading-snug ${aktif ? 'text-white/80' : 'text-[#64748b]'}`}>
                    {tab.isi}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-[#64748b]">
            Tahap {['Pra-Kerja', 'Saat Kerja', 'Pasca-Kerja'][['PRE', 'DURING', 'POST'].indexOf(phase)]} dari 3
          </p>
        </div>
      )}

      {phase === 'PRE' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-[#eff6ff] border border-[#bfdbfe] p-3">
            <p className="text-xs font-bold text-[#1e3a8a] mb-1">Tahap 1 — Sebelum Kerja</p>
            <p className="text-[11px] text-[#334155] leading-relaxed">
              Karyawan baru sedang direkrut atau menjalani masa percobaan. Di sini Anda melihat
              seberapa penuh formasi sudah terisi dan berapa yang lulus masa percobaan.
            </p>
          </div>
          <StatGrid items={preItems} />
        </div>
      )}

      {phase === 'DURING' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] p-3">
            <p className="text-xs font-bold text-[#166534] mb-1">Tahap 2 — Saat Kerja</p>
            <p className="text-[11px] text-[#334155] leading-relaxed">
              Karyawan sedang bekerja. Angka di bawah menunjukkan aktivitas kepegawaian yang terjadi.
              Rincian aktivitas lengkap ada di tab Ringkasan &amp; Analitik.
            </p>
          </div>
          <StatGrid items={duringItems} />
        </div>
      )}

      {phase === 'POST' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-[#fef2f2] border border-[#fecaca] p-3">
            <p className="text-xs font-bold text-[#991b1b] mb-1">Tahap 3 — Setelah Kerja</p>
            <p className="text-[11px] text-[#334155] leading-relaxed">
              Karyawan sedang keluar. Angka menunjukkan seberapa jauh proses serah terima aset dan
              penyelesaian hak sudah berjalan.
            </p>
          </div>
          {postItems.length === 0 ? (
            <p className="text-xs text-[#94a3b8] p-3 rounded-xl bg-[#f8fafc] border border-dashed border-[#cbd5e1]">
              Tidak ada proses pemberhentian yang sedang berjalan.
            </p>
          ) : (
            <StatGrid items={postItems} />
          )}
        </div>
      )}
    </div>
  );
}