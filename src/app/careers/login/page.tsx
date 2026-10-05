'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layers, Mail, Lock, LogIn, UserPlus, AlertCircle } from 'lucide-react';

/** Login KANDIDAT (terpisah dari login karyawan /login). */
export default function CandidateLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/careers/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j?.detail || 'Email atau kata sandi tidak valid.');
        return;
      }
      router.push('/careers/portal');
    } catch {
      setError('Gagal menghubungi server. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#007a5a]">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-[#0f172a] leading-tight">Portal Kandidat</p>
            <p className="text-[11px] text-[#64748b]">E-PerformIQ Careers</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-6">
          <h1 className="text-lg font-extrabold text-[#0f172a]">Masuk sebagai Kandidat</h1>
          <p className="text-xs text-[#64748b] mt-1">
            Untuk melamar lowongan dan memantau status lamaran Anda.
          </p>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-[#fce8e6] border border-[#f5c2c7] text-xs text-[#c5221f] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#94a3b8]" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#cbd5e1] bg-white text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">Kata Sandi</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-[#94a3b8]" />
                <input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#cbd5e1] bg-white text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
                />
              </div>
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#007a5a] hover:bg-[#00684a] text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              {loading ? 'Memproses…' : (<><LogIn className="h-4 w-4" /> Masuk</>)}
            </button>
          </form>

          <p className="mt-4 text-xs text-center text-[#64748b]">
            Belum punya akun?{' '}
            <Link href="/careers/register" className="font-semibold text-[#007a5a] hover:underline">
              Daftar di sini
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-[#94a3b8]">
          Karyawan internal? <Link href="/login" className="underline">Masuk di sini</Link>.
        </p>
      </div>
    </div>
  );
}
