'use client';

import { useEffect, useState } from 'react';
import ListPager from '@/components/ui/ListPager';

interface Event {
  id: string;
  employeeName: string;
  eventType: string;
  summary: string;
  occurredAt: string;
}

const LABEL: Record<string, string> = {
  ATTENDANCE: 'Kehadiran', KPI_DAILY: 'KPI harian', DPI_STATUS: 'Status harian',
  LEAVE: 'Cuti', OVERTIME: 'Lembur', TRAINING: 'Pelatihan', LETTER: 'Surat',
  DISCIPLINARY: 'Sanksi', RECOGNITION: 'Penghargaan', CAREER: 'Karir',
};

export default function CompanyActivityFeed() {
  const [items, setItems] = useState<Event[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/activity-feed/company?limit=50')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (active) setItems(j?.data?.items ?? []); })
      .catch(() => { /* biarkan kosong */ })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <h2 className="text-sm font-extrabold text-[#0f172a]">Aktivitas Karyawan Terkini</h2>
      <p className="mt-0.5 text-[11px] text-[#64748b]">
        Kejadian lintas modul. Data gaji, BPJS, dan chat pribadi tidak pernah muncul di sini.
      </p>

      <div className="mt-3">
        <ListPager
          items={items}
          itemKey={(e) => e.id}
          itemLabel="aktivitas"
          emptyMessage={loaded ? 'Belum ada aktivitas.' : 'Memuat aktivitas…'}
          searchPlaceholder="Cari nama pegawai atau ringkasan aktivitas..."
          searchText={(e) => `${e.employeeName} ${LABEL[e.eventType] ?? e.eventType} ${e.summary}`}
          maxHeight="420px"
          renderItem={(e) => (
            <div className="py-2 text-xs border-b border-[#f1f5f9]">
              <span className="font-semibold text-[#0f172a]">{e.employeeName}</span>
              <span className="text-[#475569]"> · {LABEL[e.eventType] ?? e.eventType}: {e.summary}</span>
              <span className="ml-2 text-[10px] text-[#94a3b8]">
                {new Date(e.occurredAt).toLocaleString('id-ID')}
              </span>
            </div>
          )}
        />
      </div>
    </section>
  );
}
