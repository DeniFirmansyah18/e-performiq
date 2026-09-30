'use client';

import React, { useState } from 'react';
import { Receipt, X, AlertCircle, Paperclip } from 'lucide-react';

interface ReimbursementModalProps {
isOpen: boolean;
onClose: () => void;
onSuccess: (msg: string) => void;
}

export default function ReimbursementModal({ isOpen, onClose, onSuccess }: ReimbursementModalProps) {
const [claimCategory, setClaimCategory] = useState('MEDICAL');
const [amount, setAmount] = useState('');
const [claimDate, setClaimDate] = useState(() => new Date().toISOString().split('T')[0]);
const [receiptName, setReceiptName] = useState('');
const [isSubmitting, setIsSubmitting] = useState(false);
const [errorMsg, setErrorMsg] = useState('');

if (!isOpen) return null;

const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
const f = e.target.files?.[0];
if (f) setReceiptName(f.name);
};

const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setIsSubmitting(true);
setErrorMsg('');



try {
  const res = await fetch('/api/v1/finance/expense-claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      claimCategory,
      amount: Number(amount),
      claimDate,
      receiptUrl: receiptName,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    setErrorMsg(json.detail || json.message || 'Gagal mengajukan klaim.');
    return;
  }

  onSuccess(
    `Klaim ${claimCategory} sebesar Rp ${Number(amount).toLocaleString('id-ID')} berhasil diajukan.`
  );
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
        <div className="p-2 rounded-lg bg-teal-600 text-white">
          <Receipt className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-bold text-sm">Pengajuan Reimbursement</h3>
          <p className="text-[11px] text-slate-400">SUBPengajuan Reimbursement</p>
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
        <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori Klaim</label>
        <select
          value={claimCategory}
          onChange={(e) => setClaimCategory(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-teal-600 bg-white"
        >
          <option value="MEDICAL">MEDICAL — Kesehatan</option>
          <option value="TRAVEL">TRAVEL — Perjalanan Dinas</option>
          <option value="OPERATIONAL">OPERATIONAL — Operasional</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Nominal (Rp)</label>
          <input
            type="number"
            min="1"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Contoh: 250000"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-teal-600"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Klaim</label>
          <input
            type="date"
            value={claimDate}
            onChange={(e) => setClaimDate(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-teal-600"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Bukti Struk</label>
        <label className="flex items-center gap-2 w-full px-3 py-2.5 text-xs rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-600 cursor-pointer hover:border-teal-600 hover:bg-teal-50/50">
          <Paperclip className="h-4 w-4 text-slate-500 flex-shrink-0" />
          <span className="truncate">{receiptName || 'Pilih berkas struk...'}</span>
          <input type="file" className="hidden" onChange={handleFile} />
        </label>
        <p className="text-[10px] text-slate-500 mt-1">
          Nama berkas disimpan sebagai referensi bukti pada klaim.
        </p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !amount || !receiptName}
        className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold transition-colors"
      >
        {isSubmitting ? 'Mengirim...' : 'Ajukan Klaim'}
      </button>
    </form>
  </div>
</div>
);
}
