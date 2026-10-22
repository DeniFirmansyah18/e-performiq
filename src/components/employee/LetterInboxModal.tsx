'use client';

import { useEffect, useState } from 'react';
import { X, Mail, Paperclip } from 'lucide-react';

interface Disposition {
  id: string;
  instruction: string;
  status: 'BELUM_DIBACA' | 'DIBACA' | 'DIKERJAKAN' | 'SELESAI' | 'DITOLAK';
  dueDate: string | null;
}

interface Letter {
  id: string;
  agendaNumber: string;
  direction: 'INCOMING' | 'OUTGOING' | 'DIRECTIVE';
  classification: 'BIASA' | 'TERBATAS' | 'RAHASIA';
  subject: string;
  sender: string | null;
  letterDate: string;
  status: 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  dispositions?: Disposition[];
}

const STATUS_LABEL: Record<Letter['status'], string> = {
  DRAFT: 'Draf', OPEN: 'Baru', IN_PROGRESS: 'Sedang diproses', CLOSED: 'Selesai',
};

const DISP_LABEL: Record<Disposition['status'], string> = {
  BELUM_DIBACA: 'Belum dibaca', DIBACA: 'Dibaca',
  DIKERJAKAN: 'Dikerjakan', SELESAI: 'Selesai', DITOLAK: 'Ditolak',
};

const DIRECTION_LABEL: Record<Letter['direction'], string> = {
  INCOMING: 'Surat masuk', OUTGOING: 'Surat keluar', DIRECTIVE: 'Surat perintah',
};

export default function LetterInboxModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch('/api/v1/letters')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (active) setLetters(j?.data?.items ?? []); })
      .catch(() => { /* biarkan kosong */ })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="letter-title">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 id="letter-title" className="flex items-center gap-1.5 text-base font-extrabold text-[#0f172a]">
            <Mail className="h-4 w-4" aria-hidden="true" /> e-Surat & Disposisi
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 hover:bg-[#f1f5f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]">
            <X className="h-4 w-4 text-[#475569]" />
          </button>
        </div>

        <ul className="mt-4 divide-y divide-[#e2e8f0]">
          {letters.map((l) => (
            <li key={l.id} className="py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                {l.agendaNumber} · {DIRECTION_LABEL[l.direction]} · {l.classification}
              </p>
              <p className="mt-0.5 text-sm font-bold text-[#0f172a]">{l.subject}</p>
              <p className="mt-0.5 text-xs text-[#475569]">
                {l.sender ?? '—'} · {l.letterDate} · {STATUS_LABEL[l.status]}
              </p>

              {(l.dispositions?.length ?? 0) > 0 && (
                <ul className="mt-2 space-y-1">
                  {l.dispositions!.map((d) => (
                    <li key={d.id} className="rounded-lg bg-[#f8fafc] px-2 py-1 text-[11px] text-[#475569]">
                      {d.instruction} · {DISP_LABEL[d.status]}
                      {d.dueDate ? ` · tenggat ${String(d.dueDate).slice(0, 10)}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {loaded && letters.length === 0 && (
            <li className="py-3 text-xs text-[#64748b]">Belum ada surat untuk Anda.</li>
          )}
          {!loaded && <li className="py-3 text-xs text-[#64748b]">Memuat surat…</li>}
        </ul>

        <p className="mt-3 flex items-center gap-1 text-[11px] text-[#64748b]">
          <Paperclip className="h-3 w-3" aria-hidden="true" />
          Disposisi dan tanda terima baca dikelola oleh pimpinan melalui menu yang sama.
        </p>
      </div>
    </div>
  );
}
