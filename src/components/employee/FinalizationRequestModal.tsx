'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, X, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface FinalizationRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  periodId?: string;
  periodLabel?: string;
}

interface FinalizationRequest {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  periodCode: string;
}

const STATUS_VIEW: Record<
  string,
  { label: string; cls: string; icon: React.ReactNode; hint: string }
> = {
  PENDING: {
    label: 'Menunggu Persetujuan Atasan',
    cls: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: <Clock className="h-4 w-4" />,
    hint: 'Pengajuan Anda sudah terkirim dan sedang ditinjau atasan langsung.',
  },
  APPROVED: {
    label: 'Disetujui',
    cls: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    icon: <CheckCircle2 className="h-4 w-4" />,
    hint: 'Finalisasi penilaian kinerja Anda telah disetujui.',
  },
  REJECTED: {
    label: 'Ditolak',
    cls: 'bg-rose-50 border-rose-200 text-rose-800',
    icon: <AlertCircle className="h-4 w-4" />,
    hint: 'Pengajuan ditolak. Silakan perbaiki lalu ajukan kembali.',
  },
};

export default function FinalizationRequestModal({
  isOpen,
  onClose,
  onSuccess,
  periodId,
  periodLabel = 'Q3',
}: FinalizationRequestModalProps) {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [existing, setExisting] = useState<FinalizationRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setIsLoading(true);
    setErrorMsg('');
    (async () => {
      try {
        const qs = periodId ? `?period_id=${periodId}` : '';
        const res = await fetch(`/api/v1/performance/finalization${qs}`);
        const json = await res.json().catch(() => ({}));
        if (active) setExisting(json?.data?.request ?? null);
      } catch {
        if (active) setExisting(null);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isOpen, periodId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/v1/performance/finalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_id: periodId, note: note.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(json?.error?.message || json?.message || 'Gagal mengirim pengajuan finalisasi.');
        return;
      }
      setExisting(json?.data ?? null);
      onSuccess(`Pengajuan finalisasi ${periodLabel} berhasil dikirim kepada atasan.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const view = existing ? STATUS_VIEW[existing.status] : null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-gradient-to-r from-[#0f172a] to-[#134e4a] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-400/40 text-emerald-300">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Ajukan Finalisasi {periodLabel}</h3>
              <p className="text-[11px] text-emerald-200/80">Self-Appraisal · Pengajuan ke Atasan</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isLoading ? (
            <p className="text-xs text-slate-500 inline-flex items-center gap-2">
              <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-600" />
              Memeriksa status pengajuan…
            </p>
          ) : view ? (
            <>
              <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${view.cls}`}>
                {view.icon}
                <div>
                  <p className="font-bold">{view.label}</p>
                  <p className="mt-0.5 opacity-90">{view.hint}</p>
                </div>
              </div>
              {existing?.note && (
                <div className="text-xs">
                  <p className="font-semibold text-slate-700 mb-1">Catatan pengajuan Anda</p>
                  <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 whitespace-pre-wrap">{existing.note}</p>
                </div>
              )}
              {existing?.decisionNote && (
                <div className="text-xs">
                  <p className="font-semibold text-slate-700 mb-1">Catatan atasan</p>
                  <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 whitespace-pre-wrap">{existing.decisionNote}</p>
                </div>
              )}
              {existing?.status !== 'APPROVED' && (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {existing?.status === 'REJECTED' ? 'Perbaikan / Catatan Baru' : 'Perbarui Catatan (opsional)'}
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      maxLength={1000}
                      placeholder="Contoh: Seluruh KPI periode ini telah tercapai, mohon ditinjau untuk finalisasi."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    />
                  </div>
                  <button type="submit" disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-colors">
                    {isSubmitting ? 'Mengirim…' : existing?.status === 'REJECTED' ? 'Ajukan Ulang' : 'Perbarui Pengajuan'}
                  </button>
                </form>
              )}
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                Pengajuan ini mengirim permintaan finalisasi penilaian kinerja Anda kepada atasan langsung.
                Pastikan seluruh KPI periode {periodLabel} telah diperbarui dengan realisasi terbaru.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan untuk Atasan (opsional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Contoh: Pertumbuhan penjualan tercapai 110% dari target, terlampir bukti di panel KPI."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                />
              </div>
              <button type="submit" disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-colors">
                {isSubmitting ? 'Mengirim…' : `Kirim Pengajuan Finalisasi ${periodLabel}`}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
