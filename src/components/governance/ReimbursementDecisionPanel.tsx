'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Receipt, CheckCircle2, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface Klaim {
  id: string;
  employeeCode: string | null;
  employeeName: string;
  claimCategory: 'MEDICAL' | 'TRAVEL' | 'OPERATIONAL';
  amount: number;
  receiptUrl: string;
  claimDate: string;
  status: 'SUBMITTED' | 'APPROVED' | 'PAID' | 'REJECTED';
  decisionNote: string | null;
}

const KATEGORI: Record<string, string> = {
  MEDICAL: 'Medis',
  TRAVEL: 'Perjalanan',
  OPERATIONAL: 'Operasional',
};

const WARNA: Record<string, string> = {
  SUBMITTED: 'bg-[#fef3c7] text-[#b45309]',
  APPROVED: 'bg-[#e6f4ea] text-[#137333]',
  PAID: 'bg-[#e0f2fe] text-[#0284c7]',
  REJECTED: 'bg-[#fce8e6] text-[#c5221f]',
};

function rupiah(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Panel "Reimbursement" untuk HR/Finance.
 *
 * Menampilkan antrean klaim pegawai dan memungkinkan HR memutuskan:
 * SETUJUI (penuh, sesuai pengajuan) atau TOLAK (alasan wajib, min 5 karakter).
 * Sesuai kebijakan perusahaan tidak ada persetujuan sebagian.
 */
export default function ReimbursementDecisionPanel() {
  const { activeRole } = useAuth();
  const bolehPutuskan = ['HR_MANAGER', 'BOD', 'SUPER_ADMIN'].includes(activeRole);

  const [klaim, setKlaim] = useState<Klaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState('SUBMITTED');
  const [alasan, setAlasan] = useState<Record<string, string>>({});

  const muat = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = filter ? `?status=${encodeURIComponent(filter)}` : '';
      const res = await fetch(`/api/v1/finance/expense-claims${q}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.detail || 'Gagal memuat klaim reimbursement.');
        return;
      }
      const isi = json?.data?.items ?? json?.data ?? [];
      setKlaim(Array.isArray(isi) ? isi : []);
    } catch {
      setErr('Gagal memuat klaim reimbursement.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function putuskan(k: Klaim, keputusan: 'APPROVED' | 'REJECTED') {
    const catatan = (alasan[k.id] ?? '').trim();
    if (keputusan === 'REJECTED' && catatan.length < 5) {
      setErr('Alasan penolakan wajib diisi (minimal 5 karakter).');
      return;
    }
    setBusyId(k.id);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/v1/finance/expense-claims/${k.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keputusan, catatan: catatan || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.detail || json?.message || 'Gagal memutuskan klaim.');
        return;
      }
      setMsg(
        keputusan === 'APPROVED'
          ? `Klaim ${k.employeeName} disetujui penuh (${rupiah(k.amount)}).`
          : `Klaim ${k.employeeName} ditolak.`
      );
      setAlasan((prev) => ({ ...prev, [k.id]: '' }));
      await muat();
    } catch {
      setErr('Gagal memutuskan klaim.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="stitch-card-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1f5f9] pb-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-[#007a5a]" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-extrabold text-[#0f172a]">Reimbursement</h2>
            <p className="text-[11px] text-[#64748b]">
              Setujui penuh atau tolak klaim pegawai. Penolakan wajib disertai alasan.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-[11px] text-[#0f172a]"
          >
            <option value="SUBMITTED">Menunggu keputusan</option>
            <option value="APPROVED">Disetujui</option>
            <option value="REJECTED">Ditolak</option>
            <option value="PAID">Dibayar</option>
            <option value="">Semua</option>
          </select>
          <button
            type="button"
            onClick={() => void muat()}
            className="p-1.5 rounded-lg border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#64748b]"
            title="Muat ulang"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {err && <p className="text-[11px] text-[#b91c1c] bg-[#fef2f2] px-3 py-2 rounded-lg">{err}</p>}
      {msg && <p className="text-[11px] text-[#137333] bg-[#e6f4ea] px-3 py-2 rounded-lg">{msg}</p>}

      {loading ? (
        <p className="flex items-center gap-2 text-[11px] text-[#64748b]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat klaim...
        </p>
      ) : klaim.length === 0 ? (
        <p
          className="text-[11px] text-[#64748b] bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded-lg p-3">
          Tidak ada klaim pada filter ini.
        </p>
      ) : (
        <ul className="space-y-2">
          {klaim.map((k) => (
            <li key={k.id} className="rounded-xl border border-[#e2e8f0] px-3 py-2.5 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-[#0f172a]">
                    {k.employeeName}
                    {k.employeeCode ? (
                      <span className="text-[10px] text-[#94a3b8]"> ({k.employeeCode})</span>
                    ) : null}
                  </p>
                  <p className="text-[10px] text-[#64748b]">
                    {KATEGORI[k.claimCategory] ?? k.claimCategory} - {k.claimDate}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-mono font-bold text-[#0f172a]">
                    {rupiah(k.amount)}
                  </p>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${WARNA[k.status] ?? ''}`}>
                    {k.status}
                  </span>
                </div>
              </div>

              {k.status === 'SUBMITTED' && bolehPutuskan && (
                <div className="space-y-2 pt-1">
                  <input
                    value={alasan[k.id] ?? ''}
                    onChange={(e) => setAlasan((prev) => ({ ...prev, [k.id]: e.target.value }))}
                    placeholder="Alasan (wajib bila menolak), mis. bukti struk tidak terbaca"
                    className="w-full rounded-lg border border-[#cbd5e1] px-2 py-1 text-[11px]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === k.id}
                      onClick={() => void putuskan(k, 'APPROVED')}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#007a5a] px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Setujui penuh
                    </button>
                    <button
                      type="button"
                      disabled={busyId === k.id}
                      onClick={() => void putuskan(k, 'REJECTED')}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#b91c1c] px-2.5 py-1 text-[10px] font-semibold text-[#b91c1c] disabled:opacity-50"
                    >
                      <XCircle className="h-3 w-3" /> Tolak
                    </button>
                    <a
                      href={k.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-semibold text-[#0284c7] underline self-center"
                    >
                      lihat bukti
                    </a>
                  </div>
                </div>
              )}

              {k.status !== 'SUBMITTED' && k.decisionNote && (
                <p className="text-[10px] text-[#64748b]">Catatan: {k.decisionNote}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
