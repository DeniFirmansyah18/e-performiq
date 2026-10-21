'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

interface TeamStatus {
  employeeId: string;
  employeeName?: string;
  date: string;
  score: number | null;
  trafficLight: 'GREEN' | 'YELLOW' | 'RED' | 'NO_DATA';
  filled: number;
  expected: number;
  demotionReason: string | null;
}

interface Entry {
  id: string;
  entryDate: string;
  actualValue: number;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  isLate: boolean;
}

const LIGHT_LABEL: Record<TeamStatus['trafficLight'], string> = {
  GREEN: 'Baik',
  YELLOW: 'Perlu perhatian',
  RED: 'Perlu tindakan',
  NO_DATA: 'Belum ada data',
};

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export default function DailyVerificationPanel() {
  const [team, setTeam] = useState<TeamStatus[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    const res = await fetch(`/api/v1/performance/daily-status/team?date=${today()}`);
    if (!res.ok) return;
    const json = await res.json();
    setTeam(json?.data?.items ?? []);
  }, []);

  useEffect(() => { void loadTeam(); }, [loadTeam]);

  const loadEntries = useCallback(async (employeeId: string) => {
    setSelected(employeeId);
    const day = today();
    const res = await fetch(
      `/api/v1/me/kpi-daily-entries?from=${day}&to=${day}&employeeId=${employeeId}`,
    );
    if (!res.ok) { setEntries([]); return; }
    const json = await res.json();
    setEntries(json?.data?.items ?? []);
  }, []);

  const decide = async (entryId: string, decision: 'VERIFIED' | 'REJECTED') => {
    setMessage(null);
    const body: Record<string, unknown> = { decision };
    if (decision === 'REJECTED') {
      const reason = window.prompt('Alasan penolakan (wajib):') ?? '';
      if (reason.trim().length < 5) { setMessage('Alasan penolakan minimal 5 karakter.'); return; }
      body.reason = reason;
    }
    const res = await fetch(`/api/v1/performance/kpi-daily-entries/${entryId}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(json?.detail ?? 'Gagal menyimpan keputusan.'); return; }
    setMessage('Keputusan tersimpan.');
    if (selected) await loadEntries(selected);
    await loadTeam();
  };

  const pending = entries.filter((e) => e.status === 'SUBMITTED');

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <h2 className="text-sm font-extrabold text-[#0f172a]">Verifikasi Kinerja Harian Tim</h2>
      <p className="mt-0.5 text-[11px] text-[#64748b]">
        Status hari ini per bawahan. Klik nama untuk meninjau entri yang menunggu.
      </p>

      <ul className="mt-3 divide-y divide-[#e2e8f0]">
        {team.map((row) => (
          <li key={row.employeeId} className="py-2">
            <button
              type="button"
              onClick={() => loadEntries(row.employeeId)}
              aria-pressed={selected === row.employeeId}
              className="flex w-full items-center justify-between gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            >
              <span className="text-xs font-semibold text-[#0f172a]">
                {row.employeeName ?? `${row.employeeId.slice(0, 8)}…`}
              </span>
              <span className="text-[11px] font-bold text-[#0f172a]">
                {LIGHT_LABEL[row.trafficLight]} · DPI {row.score ?? '—'} · {row.filled}/{row.expected}
              </span>
            </button>
          </li>
        ))}
        {team.length === 0 && (
          <li className="py-2 text-xs text-[#64748b]">Belum ada snapshot tim untuk hari ini.</li>
        )}
      </ul>

      {selected && (
        <div className="mt-4 rounded-xl border border-[#e2e8f0] p-3">
          <p className="text-xs font-bold text-[#0f172a]">Entri menunggu verifikasi</p>
          <ul className="mt-2 space-y-2">
            {pending.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[#0f172a]">
                  {e.entryDate} · nilai {e.actualValue}{e.isLate ? ' · terlambat' : ''}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => decide(e.id, 'VERIFIED')}
                    className="rounded-lg bg-[#007a5a] p-1.5 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2"
                    aria-label={`Setujui entri ${e.entryDate}`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(e.id, 'REJECTED')}
                    className="rounded-lg bg-[#b91c1c] p-1.5 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b91c1c] focus-visible:ring-offset-2"
                    aria-label={`Tolak entri ${e.entryDate}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
            {pending.length === 0 && (
              <li className="text-xs text-[#64748b]">Tidak ada entri yang menunggu.</li>
            )}
          </ul>
        </div>
      )}

      {message && <p className="mt-3 text-xs font-semibold text-[#0f172a]">{message}</p>}
    </section>
  );
}
