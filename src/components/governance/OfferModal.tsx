'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface OfferModalProps {
  applicationId: string;
  candidateName: string;
  postingTitle: string;
  /** 'offer' = terbitkan penawaran baru; 'respond' = catat respons kandidat. */
  mode?: 'offer' | 'respond';
  onClose: () => void;
  onDone: () => void;
}

/**
 * Form penawaran kerja (ADR 023).
 *
 * - mode `offer`: formulir gaji, tunjangan tetap, batas respons, dan keterangan.
 *   Memanggil `POST /api/v1/recruitment/candidates/:id/offer` yang menerbitkan
 *   `job_offers` + surat penawaran di modul e-Surat, dan menaikkan lamaran ke
 *   OFFERED.
 * - mode `respond`: tombol "Menerima" (ACCEPTED → HIRED + konversi karyawan)
 *   dan "Menolak" (DECLINED → OFFER_DECLINED + kuota dilepas).
 *
 * Validasi di klien hanya untuk kenyamanan; otoritas tetap di server (route).
 */
export default function OfferModal({ applicationId, candidateName, postingTitle, mode = 'offer', onClose, onDone }: OfferModalProps) {
  const [baseSalary, setBaseSalary] = useState('');
  const [fixedAllowance, setFixedAllowance] = useState('');
  const [responseDays, setResponseDays] = useState('7');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const submitOffer = async () => {
    setErr(null);
    const salary = Number(baseSalary);
    const allowance = Number(fixedAllowance || '0');
    const days = Number(responseDays);

    if (!Number.isFinite(salary) || salary < 0) {
      setErr('Gaji wajib berupa angka >= 0 (gunakan angka bulat rupiah).');
      return;
    }
    if (!Number.isInteger(days) || days < 1 || days > 60) {
      setErr('Batas respons wajib 1-60 hari kalender.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/v1/recruitment/candidates/${applicationId}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseSalary: salary,
          fixedAllowance: allowance > 0 ? allowance : undefined,
          responseDays: days,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.detail ?? json?.message ?? 'Gagal menerbitkan penawaran.');
        return;
      }
      const d = json.data;
      setSummary(
        `Penawaran diterbitkan. Surat penawaran ${d?.letterAgendaNumber ?? ''} dibuat dengan ` +
          `gaji pokok ${Number(d?.baseSalary ?? 0).toLocaleString('id-ID')} dan batas respons ${days} hari.`
      );
      onDone();
    } catch {
      setErr('Gagal terhubung ke server.');
    } finally {
      setBusy(false);
    }
  };

  const submitResponse = async (response: 'ACCEPTED' | 'DECLINED') => {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/recruitment/candidates/${applicationId}/offer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.detail ?? json?.message ?? 'Gagal mencatat respons.');
        return;
      }
      setSummary(
        response === 'ACCEPTED'
          ? 'Penawaran diterima. Kandidat dikonversi menjadi karyawan dan program onboarding dibuka.'
          : 'Penawaran ditolak. Kuota formasi dilepas kembali.'
      );
      onDone();
    } catch {
      setErr('Gagal terhubung ke server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xl max-w-md w-full">
        <div className="sticky top-0 bg-[#0f172a] text-white px-5 py-3.5 flex items-center justify-between rounded-t-2xl">
          <span className="text-sm font-bold">
                      {mode === 'respond' ? 'Respons Penawaran' : 'Penawaran Kerja'}
          </span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-sm">
            <p className="font-extrabold text-[#0f172a]">{candidateName}</p>
            <p className="text-[11px] text-[#64748b]">{postingTitle}</p>
          </div>

          {summary && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-900">{summary}</p>
            </div>
          )}

          {err && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900">{err}</p>
            </div>
          )}

          {mode === 'offer' ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold text-[#334155]">Gaji Pokok (Rp/bulan)</span>
                <input
                  type="number"
                  min={0}
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(e.target.value)}
                  placeholder="contoh: 28500000"
                  className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  aria-label="Gaji Pokok"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-[#334155]">Tunjangan Tetap (opsional)</span>
                <input
                  type="number"
                  min={0}
                  value={fixedAllowance}
                  onChange={(e) => setFixedAllowance(e.target.value)}
                  placeholder="contoh: 2500000"
                  className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  aria-label="Tunjangan Tetap"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-[#334155]">Batas Respons (hari)</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={responseDays}
                  onChange={(e) => setResponseDays(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  aria-label="Batas Respons (hari)"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-[#334155]">Keterangan (opsional)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </label>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#f1f5f9]">
                <button onClick={onClose} className="px-3 py-2 rounded-lg bg-slate-100 text-[#334155] text-xs font-semibold hover:bg-slate-200">
                  Batal
                </button>
                <button onClick={submitOffer} disabled={busy}
                  className="px-4 py-2 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-bold disabled:opacity-50">
                  {busy ? 'Menyimpan…' : 'Terbitkan Penawaran'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-[#64748b]">
                Pilih respons kandidat. Menerima akan mengonversi kandidat menjadi karyawan;
                menolak akan mengembalikan kuota formasi.
              </p>
              <div className="pt-2 flex justify-end gap-2 border-t border-[#f1f5f9]">
                <button onClick={() => submitResponse('DECLINED')} disabled={busy}
                  className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200 hover:bg-rose-100 disabled:opacity-50">
                  Menolak
                </button>
                <button onClick={() => submitResponse('ACCEPTED')} disabled={busy}
                  className="px-4 py-2 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-bold disabled:opacity-50">
                  {busy ? 'Memproses…' : 'Menerima'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}