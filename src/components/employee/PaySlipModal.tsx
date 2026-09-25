'use client';

import React, { useState } from 'react';
import { Lock, X, Download, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

interface PaySlipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PaySlipModal({ isOpen, onClose }: PaySlipModalProps) {
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [payslipData, setPayslipData] = useState<any>(null);

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/v1/finance/payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.detail || json.message || 'PIN keamanan salah. Masukkan 6 digit PIN (Default: 123456).');
        return;
      }

      setPayslipData(json.data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsVerifying(false);
    }
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-600 text-white">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Slip Gaji Digital Terproteksi PIN</h3>
              <p className="text-[11px] text-slate-400">Kotak 5: Payroll & Financial Self-Service</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!payslipData ? (
          <form onSubmit={handleVerify} className="p-6 space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
              <div className="p-3 bg-white inline-flex rounded-full text-slate-700 shadow-xs border border-slate-200">
                <Lock className="h-5 w-5 text-emerald-600" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Masukkan PIN Keamanan</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Slip gaji memuat data konfidensial keuangan. Masukkan 6 digit PIN akun Anda untuk membuka dokumen (PIN demo: <strong>123456</strong>).
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="******"
                className="w-full text-center tracking-widest text-lg font-mono py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                required
                autoFocus
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Tutup
              </button>
              <button
                type="submit"
                disabled={isVerifying || pin.length < 6}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-xs"
              >
                {isVerifying ? 'Memverifikasi...' : 'Buka Slip Gaji'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-5">
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{payslipData.fullName}</h4>
                  <p className="text-xs text-slate-500">{payslipData.position} &bull; {payslipData.department}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md font-bold">
                    Periode: {payslipData.period}
                  </span>
                </div>
              </div>

              {/* Rincian Pendapatan & Potongan */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                    Komponen Penerimaan (+)
                  </span>
                  <div className="flex justify-between text-slate-600">
                    <span>Gaji Pokok:</span>
                    <span className="font-mono">{formatIDR(payslipData.earnings.baseSalary)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tunjangan Tetap:</span>
                    <span className="font-mono">{formatIDR(payslipData.earnings.fixedAllowance)}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                    Komponen Pemotongan (-)
                  </span>
                  <div className="flex justify-between text-slate-600">
                    <span>BPJS Naker:</span>
                    <span className="font-mono">{formatIDR(payslipData.deductions.bpjsKetenagakerjaan)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>PPh 21:</span>
                    <span className="font-mono">{formatIDR(payslipData.deductions.pph21)}</span>
                  </div>
                </div>
              </div>

              {/* Take Home Pay */}
              <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between font-bold">
                <span className="text-xs text-slate-800">Total Gaji Bersih (Take Home Pay):</span>
                <span className="text-sm font-mono text-emerald-600">{formatIDR(payslipData.netSalary)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Terotentikasi &amp; Sah Sesuai PP No. 36/2021
              </span>
              <button
                onClick={() => alert('Fitur unduh PDF slip gaji terenkripsi telah disiapkan.')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
