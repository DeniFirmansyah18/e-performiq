'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Clock } from 'lucide-react';

interface Row {
  id: string;
  workDate: string;
  plannedHours: number;
  reason: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
}

const STATUS_LABEL: Record<Row['status'], string> = {
  DRAFT: 'Draf', SUBMITTED: 'Menunggu persetujuan',
  APPROVED: 'Disetujui', REJECTED: 'Ditolak', CANCELLED: 'Dibatalkan',
};

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const tomorrow = () => {
  const d = new Date(`${today()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export default function OvertimeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ workDate: tomorrow(), plannedHours: '2', reason: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/me/overtime-requests');
    if (!res.ok) return;
    const json = await res.json();
    setRows(json?.data?.items ?? []);
  }, []);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/v1/me/overtime-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workDate: form.workDate,
        plannedHours: Number(form.plannedHours),
        reason: form.reason,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMessage(json?.detail ?? 'Gagal mengajukan lembur.'); return; }
    setMessage('Pengajuan lembur terkirim.');
    setForm((f) => ({ ...f, reason: '' }));
    await load();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="ot-title">
      <div className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 id="ot-title" className="flex items-center gap-1.5 text-base font-extrabold text-[#0f172a]">
            <Clock className="h-4 w-4" aria-hidden="true" /> Pengajuan Lembur
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 hover:bg-[#f1f5f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]">
            <X className="h-4 w-4 text-[#475569]" />
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-[#475569]">
            Tanggal
            <input
              type="date"
              value={form.workDate}
              min={today()}
              onChange={(e) => setForm((f) => ({ ...f, workDate: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-sm text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-xs text-[#475569]">
            Perkiraan jam (maks 4)
            <input
              type="number"
              min={0.5}
              max={4}
              step={0.5}
              value={form.plannedHours}
              onChange={(e) => setForm((f) => ({ ...f, plannedHours: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-sm text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-xs text-[#475569] sm:col-span-2">
            Alasan / penugasan
            <textarea
              value={form.reason}
              rows={2}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-sm text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="mt-3 rounded-lg bg-[#007a5a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2 disabled:opacity-50"
        >
          Ajukan
        </button>

        {message && <p className="mt-2 text-xs font-semibold text-[#0f172a]">{message}</p>}

        <ul className="mt-4 divide-y divide-[#e2e8f0]">
          {rows.map((r) => (
            <li key={r.id} className="py-2 text-xs">
              <p className="font-semibold text-[#0f172a]">{r.workDate} · {r.plannedHours} jam</p>
              <p className="text-[#64748b]">{STATUS_LABEL[r.status]} · {r.reason}</p>
            </li>
          ))}
          {rows.length === 0 && <li className="py-2 text-xs text-[#64748b]">Belum ada pengajuan lembur.</li>}
        </ul>
      </div>
    </div>
  );
}
