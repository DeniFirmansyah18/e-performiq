'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react';

type Light = 'GREEN' | 'YELLOW' | 'RED' | 'NO_DATA';

interface Status {
  date: string;
  score: number | null;
  trafficLight: Light;
  filled: number;
  expected: number;
  demotionReason: string | null;
}

const PRESENTATION: Record<Light, { label: string; box: string; icon: typeof CheckCircle2 }> = {
  GREEN: { label: 'Baik — sesuai target', box: 'border-[#a7f3d0] bg-[#ecfdf5]', icon: CheckCircle2 },
  YELLOW: { label: 'Perlu perhatian', box: 'border-[#fde68a] bg-[#fffbeb]', icon: AlertTriangle },
  RED: { label: 'Perlu tindakan hari ini', box: 'border-[#fecaca] bg-[#fef2f2]', icon: AlertTriangle },
  NO_DATA: { label: 'Belum ada data hari ini', box: 'border-[#e2e8f0] bg-[#f8fafc]', icon: MinusCircle },
};

export default function DailyStatusCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/me/daily-status')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('gagal'))))
      .then((j) => { if (active) setStatus(j.data); })
      .catch(() => { if (active) setError('Status harian belum dapat dimuat.'); });
    return () => { active = false; };
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 text-sm text-[#64748b]">
        {error}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 text-sm text-[#64748b]">
        Memuat status hari ini…
      </div>
    );
  }

  const p = PRESENTATION[status.trafficLight];
  const Icon = p.icon;

  return (
    <section className={`rounded-2xl border p-4 ${p.box}`} aria-labelledby="daily-status-heading">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 text-[#0f172a]" aria-hidden="true" />
        <div className="flex-1">
          <h2 id="daily-status-heading" className="text-sm font-extrabold text-[#0f172a]">
            Status Kinerja Hari Ini
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#0f172a]">{p.label}</p>
          <p className="mt-1 text-xs text-[#475569]">
            DPI {status.score === null ? '—' : status.score.toFixed(1)} dari 100
            {' · '}
            {status.filled} dari {status.expected} indikator terisi
          </p>
          {status.demotionReason === 'ABSENT_WITHOUT_NOTICE' && (
            <p className="mt-1 text-xs font-semibold text-[#b91c1c]">
              Status diturunkan satu tingkat karena tidak ada keterangan kehadiran.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
