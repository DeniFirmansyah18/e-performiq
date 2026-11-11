'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FileCheck2, Check, X, ExternalLink } from 'lucide-react';
import ListPager from '@/components/ui/ListPager';

interface Doc {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  documentType: string;
  fileUrl: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
  expiryDate: string | null;
  verifiedAt: string | null;
}

const STATUS_LABEL: Record<Doc['verificationStatus'], string> = {
  PENDING: 'Menunggu verifikasi',
  VERIFIED: 'Terverifikasi',
  REJECTED: 'Ditolak',
  EXPIRED: 'Kedaluwarsa',
};

const STATUS_TONE: Record<Doc['verificationStatus'], string> = {
  PENDING: 'bg-[#fef3c7] text-[#b45309]',
  VERIFIED: 'bg-[#e6f4ea] text-[#007a5a]',
  REJECTED: 'bg-[#fce8e6] text-[#b91c1c]',
  EXPIRED: 'bg-[#f1f5f9] text-[#475569]',
};

export default function DocumentVerificationPanel() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [status, setStatus] = useState<'' | Doc['verificationStatus']>('PENDING');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = status ? `?status=${status}` : '';
      const res = await fetch(`/api/v1/hr/documents${query}`);
      if (res.ok) setDocs((await res.json())?.data?.items ?? []);
    } catch {
      /* biarkan kosong */
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const decide = async (id: string, decision: 'VERIFIED' | 'REJECTED') => {
    setBusyId(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/hr/documents/${id}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice(json?.detail ?? 'Gagal menyimpan keputusan.'); return; }
      setNotice(decision === 'VERIFIED' ? 'Berkas diverifikasi.' : 'Berkas ditolak.');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-5 rounded-2xl border border-[#e2e8f0] bg-white space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-[#0284c7]" aria-hidden="true" />
            <span>Verifikasi Berkas Kepegawaian</span>
          </h3>
          <p className="text-[11px] text-[#64748b]">
            Antrean berkas yang diunggah karyawan beserta status verifikasinya.
          </p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as '' | Doc['verificationStatus'])}
          aria-label="Filter status berkas"
          className="rounded-lg border border-[#cbd5e1] px-2 py-1 text-[11px] text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
        >
          <option value="PENDING">Menunggu</option>
          <option value="VERIFIED">Terverifikasi</option>
          <option value="REJECTED">Ditolak</option>
          <option value="">Semua</option>
        </select>
      </div>

      {notice && (
        <p className="text-[11px] text-[#0f172a] bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      {loading && <p className="text-[11px] text-[#64748b]">Memuat berkas…</p>}

      <ListPager
        items={docs}
        itemKey={(d) => d.id}
        itemLabel="berkas"
        emptyMessage={loading ? 'Memuat berkas…' : 'Tidak ada berkas pada filter ini.'}
        searchPlaceholder="Cari jenis dokumen atau nama pegawai..."
        searchText={(d) => `${d.documentType} ${d.employeeName ?? ''} ${d.employeeCode ?? ''} ${STATUS_LABEL[d.verificationStatus] ?? ''}`}
        maxHeight="440px"
        renderItem={(d) => (
          <div className="py-2.5 border-b border-[#f1f5f9]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#0f172a]">{d.documentType}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[d.verificationStatus]}`}>
                {STATUS_LABEL[d.verificationStatus]}
              </span>
              <a
                href={d.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0284c7] underline"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" /> berkas
              </a>
            </div>

            <p className="mt-0.5 text-[11px] text-[#475569]">
              {d.employeeName} · {d.employeeCode}
              {d.expiryDate ? ` · berlaku s.d. ${String(d.expiryDate).slice(0, 10)}` : ''}
            </p>

            {d.verificationStatus === 'PENDING' && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => decide(d.id, 'VERIFIED')}
                  aria-label={`Setujui berkas ${d.documentType}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#007a5a] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" aria-hidden="true" /> Setujui
                </button>
                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => decide(d.id, 'REJECTED')}
                  aria-label={`Tolak berkas ${d.documentType}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#b91c1c] px-2.5 py-1 text-[10px] font-semibold text-[#b91c1c] hover:bg-[#fef2f2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b91c1c] focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  <X className="h-3 w-3" aria-hidden="true" /> Tolak
                </button>
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}
