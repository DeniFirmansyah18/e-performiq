'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Layers, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

function VerifyContent() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('fail');
      setMessage('Tautan verifikasi tidak valid (token kosong).');
      return;
    }
    fetch(`/api/v1/employee/verify?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          setState('ok');
        } else {
          setState('fail');
          setMessage(j?.detail || 'Verifikasi gagal.');
        }
      })
      .catch(() => {
        setState('fail');
        setMessage('Gagal menghubungi server. Coba lagi.');
      });
  }, [token]);

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-6 text-center">
      {state === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="h-8 w-8 text-[#007a5a] animate-spin" />
          <p className="text-sm text-[#64748b]">Memverifikasi email Anda…</p>
        </div>
      )}
      {state === 'ok' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <CheckCircle2 className="h-10 w-10 text-[#137333]" />
          <h1 className="text-lg font-extrabold text-[#0f172a]">Email terverifikasi</h1>
          <p className="text-xs text-[#64748b] max-w-sm">
            Akun Anda menunggu persetujuan HR. Anda akan dapat login setelah HR mengaktifkannya.
          </p>
          <Link href="/login" className="text-sm font-semibold text-[#007a5a] hover:underline mt-2">
            Ke halaman login
          </Link>
        </div>
      )}
      {state === 'fail' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <AlertCircle className="h-10 w-10 text-[#c5221f]" />
          <h1 className="text-lg font-extrabold text-[#0f172a]">Verifikasi gagal</h1>
          <p className="text-xs text-[#64748b] max-w-sm">{message}</p>
          <Link href="/employee/register" className="text-sm font-semibold text-[#007a5a] hover:underline mt-2">
            Daftar ulang
          </Link>
        </div>
      )}
    </div>
  );
}

/** Halaman hasil verifikasi email karyawan (publik, dibaca dari ?token=). */
export default function EmployeeVerifiedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#007a5a]">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-[#0f172a] leading-tight">Portal Karyawan</p>
            <p className="text-[11px] text-[#64748b]">E-PerformIQ Employee</p>
          </div>
        </div>
        <Suspense fallback={<div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 text-center text-sm text-[#64748b]">Memuat…</div>}>
          <VerifyContent />
        </Suspense>
      </div>
    </div>
  );
}
