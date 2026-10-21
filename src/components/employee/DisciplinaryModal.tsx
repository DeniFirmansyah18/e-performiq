'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, AlertTriangle, Award } from 'lucide-react';

interface Action {
  id: string;
  actionType: 'TEGURAN' | 'SP1' | 'SP2' | 'SP3';
  reason: string;
  effectiveDate: string;
  expiryDate: string | null;
  appealStatus: 'NONE' | 'UNDER_APPEAL' | 'APPEAL_ACCEPTED' | 'APPEAL_REJECTED';
  appealDeadline: string;
}

interface Recognition {
  id: string;
  title: string;
  awardedDate: string;
  certificateUrl: string | null;
}

const APPEAL_LABEL: Record<Action['appealStatus'], string> = {
  NONE: 'Belum diajukan',
  UNDER_APPEAL: 'Sedang ditinjau HRD',
  APPEAL_ACCEPTED: 'Keberatan diterima',
  APPEAL_REJECTED: 'Keberatan ditolak',
};

export default function DisciplinaryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [actions, setActions] = useState<Action[]>([]);
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, r] = await Promise.all([
      fetch('/api/v1/me/disciplinary-actions').then((x) => (x.ok ? x.json() : null)),
      fetch('/api/v1/me/recognitions').then((x) => (x.ok ? x.json() : null)),
    ]);
    setActions(a?.data?.items ?? []);
    setRecognitions(r?.data?.items ?? []);
  }, []);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const appeal = async (id: string) => {
    const reason = window.prompt('Alasan keberatan (diajukan maksimal 5 hari kerja):') ?? '';
    if (reason.trim().length < 5) { setMessage('Alasan minimal 5 karakter.'); return; }
    const res = await fetch(`/api/v1/me/disciplinary-actions/${id}/appeal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(json?.detail ?? 'Gagal mengajukan keberatan.'); return; }
    setMessage('Keberatan tercatat.');
    await load();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="disc-title">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 id="disc-title" className="text-base font-extrabold text-[#0f172a]">Sanksi & Penghargaan</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 hover:bg-[#f1f5f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]">
            <X className="h-4 w-4 text-[#475569]" />
          </button>
        </div>

        <h3 className="mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#64748b]">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Sanksi
        </h3>
        <ul className="mt-2 space-y-2">
          {actions.map((a) => (
            <li key={a.id} className="rounded-xl border border-[#e2e8f0] p-3">
              <p className="text-sm font-bold text-[#0f172a]">{a.actionType} · {a.effectiveDate}</p>
              <p className="mt-1 text-xs text-[#475569]">{a.reason}</p>
              <p className="mt-1 text-[11px] text-[#64748b]">
                Status keberatan: {APPEAL_LABEL[a.appealStatus]} · tenggat {String(a.appealDeadline).slice(0, 10)}
              </p>
              {a.appealStatus === 'NONE' && (
                <button
                  type="button"
                  onClick={() => appeal(a.id)}
                  className="mt-2 rounded-lg border border-[#b45309] px-2.5 py-1 text-[11px] font-semibold text-[#b45309] hover:bg-[#fffbeb] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b45309] focus-visible:ring-offset-2"
                >
                  Ajukan keberatan
                </button>
              )}
            </li>
          ))}
          {actions.length === 0 && <li className="text-xs text-[#64748b]">Tidak ada catatan sanksi.</li>}
        </ul>

        <h3 className="mt-5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#64748b]">
          <Award className="h-3.5 w-3.5" aria-hidden="true" /> Penghargaan
        </h3>
        <ul className="mt-2 space-y-1">
          {recognitions.map((r) => (
            <li key={r.id} className="text-xs text-[#0f172a]">
              <span className="font-semibold">{r.title}</span> · {r.awardedDate}
              {r.certificateUrl && (
                <a href={r.certificateUrl} className="ml-2 text-[#007a5a] underline" target="_blank" rel="noreferrer">
                  sertifikat
                </a>
              )}
            </li>
          ))}
          {recognitions.length === 0 && <li className="text-xs text-[#64748b]">Belum ada penghargaan.</li>}
        </ul>

        {message && <p className="mt-3 text-xs font-semibold text-[#0f172a]">{message}</p>}
      </div>
    </div>
  );
}
