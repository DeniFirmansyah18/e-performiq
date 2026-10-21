'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';

interface Indicator {
  id: string;
  kpiTitle: string;
  indicatorName: string;
  unit: string;
  target: number;
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
  weight: number;
}

interface Entry {
  id: string;
  indicatorId: string;
  actualValue: number;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export default function DailyKpiChecklist() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const day = today();
    const [i, e] = await Promise.all([
      fetch('/api/v1/me/kpi-indicators').then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/v1/me/kpi-daily-entries?from=${day}&to=${day}`).then((r) => (r.ok ? r.json() : null)),
    ]);
    setIndicators(i?.data?.items ?? []);
    const map: Record<string, Entry> = {};
    for (const row of e?.data?.items ?? []) map[row.indicatorId] = row;
    setEntries(map);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async (indicatorId: string) => {
    const raw = values[indicatorId];
    if (raw === undefined || raw === '') {
      setMessage('Isi nilai realisasi terlebih dahulu.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/v1/me/kpi-daily-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        indicatorId, entryDate: today(), actualValue: Number(raw), submit: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMessage(json?.detail ?? 'Gagal mengirim realisasi.'); return; }
    setMessage('Realisasi terkirim.');
    await load();
  };

  if (indicators.length === 0) {
    return (
      <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
        <h2 className="text-sm font-extrabold text-[#0f172a]">KPI Hari Ini</h2>
        <p className="mt-2 text-xs text-[#64748b]">
          Belum ada indikator harian. Hubungi atasan Anda untuk menetapkan indikator pada KPI periode ini.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <h2 className="text-sm font-extrabold text-[#0f172a]">KPI Hari Ini</h2>
      <p className="mt-0.5 text-[11px] text-[#64748b]">Isi realisasi tiap indikator, lalu kirim.</p>

      <ul className="mt-3 space-y-3">
        {indicators.map((ind) => {
          const entry = entries[ind.id];
          const done = entry?.status === 'SUBMITTED' || entry?.status === 'VERIFIED';
          return (
            <li key={ind.id} className="rounded-xl border border-[#e2e8f0] p-3">
              <div className="flex items-start gap-2">
                {done
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#007a5a]" aria-hidden="true" />
                  : <CircleDashed className="mt-0.5 h-4 w-4 text-[#94a3b8]" aria-hidden="true" />}
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#0f172a]">{ind.indicatorName}</p>
                  <p className="text-[11px] text-[#64748b]">
                    {ind.kpiTitle} · target {ind.target} {ind.unit}
                    {ind.direction === 'LOWER_BETTER' ? ' (semakin kecil semakin baik)' : ''}
                  </p>

                  {done ? (
                    <p className="mt-1 text-xs font-semibold text-[#007a5a]">
                      Terkirim: {entry.actualValue} {ind.unit}
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold text-[#b45309]">Belum diisi</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        aria-label={`Realisasi ${ind.indicatorName}`}
                        value={values[ind.id] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [ind.id]: e.target.value }))}
                        className="w-24 rounded-lg border border-[#cbd5e1] px-2 py-1 text-sm text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
                        placeholder="0"
                      />
                      <span className="text-[11px] text-[#64748b]">{ind.unit}</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => submit(ind.id)}
                        className="rounded-lg bg-[#007a5a] px-3 py-1 text-xs font-semibold text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2 disabled:opacity-50"
                      >
                        Kirim
                      </button>
                    </div>
                  )}

                  {!done && entry?.status === 'DRAFT' && (
                    <p className="mt-1 text-[11px] text-[#b45309]">Draf tersimpan, belum dikirim.</p>
                  )}
                  {entry?.status === 'REJECTED' && (
                    <p className="mt-1 text-[11px] font-semibold text-[#b91c1c]">
                      Ditolak atasan — perbaiki lalu kirim ulang.
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {message && <p className="mt-3 text-xs font-semibold text-[#0f172a]">{message}</p>}
    </section>
  );
}
