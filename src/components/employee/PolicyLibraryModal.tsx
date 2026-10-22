'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, BookOpen, ExternalLink } from 'lucide-react';

interface Policy {
  id: string;
  documentCode: string;
  title: string;
  policyType: 'SOP' | 'PP' | 'SK' | 'IK';
  version: string;
  effectiveDate: string;
  fileUrl: string;
  acknowledgedAt: string | null;
}

export default function PolicyLibraryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/policies');
    if (!res.ok) { setLoaded(true); return; }
    const json = await res.json();
    setPolicies(json?.data?.items ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const acknowledge = async (id: string) => {
    const res = await fetch(`/api/v1/policies/${id}/acknowledge`, { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(json?.detail ?? 'Gagal menandai dokumen.'); return; }
    setMessage('Dokumen ditandai telah dipahami.');
    await load();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="policy-title">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 id="policy-title" className="flex items-center gap-1.5 text-base font-extrabold text-[#0f172a]">
            <BookOpen className="h-4 w-4" aria-hidden="true" /> SOP & Peraturan Perusahaan
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 hover:bg-[#f1f5f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]">
            <X className="h-4 w-4 text-[#475569]" />
          </button>
        </div>

        <ul className="mt-4 divide-y divide-[#e2e8f0]">
          {policies.map((p) => (
            <li key={p.id} className="py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                {p.policyType} · {p.documentCode} · v{p.version}
              </p>
              <p className="mt-0.5 text-sm font-bold text-[#0f172a]">{p.title}</p>
              <p className="mt-0.5 text-[11px] text-[#64748b]">Efektif {p.effectiveDate}</p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a
                  href={p.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#cbd5e1] px-2.5 py-1 text-[11px] font-semibold text-[#475569] hover:bg-[#f8fafc] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" /> Buka dokumen
                </a>

                {p.acknowledgedAt ? (
                  <span className="text-[11px] font-semibold text-[#007a5a]">Sudah diakui</span>
                ) : (
                  <>
                    <span className="text-[11px] font-semibold text-[#b45309]">Belum diakui</span>
                    <button
                      type="button"
                      onClick={() => acknowledge(p.id)}
                      className="rounded-lg bg-[#007a5a] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2"
                    >
                      Tandai telah dipahami
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
          {loaded && policies.length === 0 && (
            <li className="py-3 text-xs text-[#64748b]">Belum ada dokumen aktif.</li>
          )}
        </ul>

        {message && <p className="mt-3 text-xs font-semibold text-[#0f172a]">{message}</p>}
      </div>
    </div>
  );
}
