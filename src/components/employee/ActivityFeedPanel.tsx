'use client';

import { useEffect, useState } from 'react';

interface Event {
  id: string;
  eventType: string;
  summary: string;
  occurredAt: string;
}

const LABEL: Record<string, string> = {
  ATTENDANCE: 'Kehadiran', KPI_DAILY: 'KPI harian', DPI_STATUS: 'Status harian',
  LEAVE: 'Cuti', OVERTIME: 'Lembur', TRAINING: 'Pelatihan', LETTER: 'Surat',
  DISCIPLINARY: 'Sanksi', RECOGNITION: 'Penghargaan', CAREER: 'Karir',
};

export default function ActivityFeedPanel() {
  const [items, setItems] = useState<Event[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/activity-feed')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (active) setItems(j?.data?.items ?? []); })
      .catch(() => { /* biarkan kosong */ })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <h2 className="text-sm font-extrabold text-[#0f172a]">Aktivitas Terbaru</h2>
      <ul className="mt-3 space-y-2">
        {items.slice(0, 10).map((e) => (
          <li key={e.id} className="text-xs">
            <span className="font-semibold text-[#0f172a]">{LABEL[e.eventType] ?? e.eventType}</span>
            {' · '}
            <span className="text-[#475569]">{e.summary}</span>
          </li>
        ))}
        {loaded && items.length === 0 && (
          <li className="text-xs text-[#64748b]">Belum ada aktivitas.</li>
        )}
      </ul>
    </section>
  );
}
