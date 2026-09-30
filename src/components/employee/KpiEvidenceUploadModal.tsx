'use client';

import React, { useState } from 'react';
import { Paperclip, X, AlertCircle } from 'lucide-react';

interface KpiOption {
id: string;
title: string;
}

interface KpiEvidenceUploadModalProps {
isOpen: boolean;
onClose: () => void;
onSuccess: (msg: string) => void;
kpiOptions?: KpiOption[];
}

export default function KpiEvidenceUploadModal({
isOpen,
onClose,
onSuccess,
kpiOptions = [],
}: KpiEvidenceUploadModalProps) {
const [kpiId, setKpiId] = useState('');
const [fileTitle, setFileTitle] = useState('');
const [fileUrl, setFileUrl] = useState('');
const [isSubmitting, setIsSubmitting] = useState(false);
const [errorMsg, setErrorMsg] = useState('');

if (!isOpen) return null;

const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setIsSubmitting(true);
setErrorMsg('');



try {
  const res = await fetch('/api/v1/performance/kpi-evidence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      individual_kpi_id: kpiId,
      file_title: fileTitle,
      file_url: fileUrl,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    setErrorMsg(json.detail || json.message || 'Gagal mengunggah bukti.');
    return;
  }

  onSuccess('Bukti pendukung KPI berhasil diunggah.');
  onClose();
} catch (err: any) {
  setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
} finally {
  setIsSubmitting(false);
}
};

return (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
    <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-indigo-600 text-white">
          <Paperclip className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-bold text-sm">Unggah Bukti Pendukung KPI</h3>
          <p className="text-[11px] text-slate-400">SUBUnggah Bukti Pendukung KPI</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
      >
        <X className="h-4 w-4" />
      </button>
    </div>

    <form onSubmit={handleSubmit} className="p-5 space-y-4">
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">KPI Terkait</label>
        {kpiOptions.length > 0 ? (
          <select
            value={kpiId}
            onChange={(e) => setKpiId(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600 bg-white"
            required
          >
            <option value="">— Pilih KPI —</option>
            {kpiOptions.map((k) => (
              <option key={k.id} value={k.id}>
                {k.title}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-50 border border-slate-200">
            Belum ada KPI pada periode ini. Ajukan milestone KPI terlebih dahulu.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Bukti</label>
        <input
          type="text"
          value={fileTitle}
          onChange={(e) => setFileTitle(e.target.value)}
          placeholder="Contoh: Laporan sprint Q3 — modul API gateway"
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600"
          required
          minLength={3}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Tautan / Nama Berkas Bukti
        </label>
        <input
          type="text"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="https://... atau nama berkas"
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !kpiId}
        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-colors"
      >
        {isSubmitting ? 'Mengunggah...' : 'Unggah Bukti'}
      </button>
    </form>
  </div>
</div>
);
}
