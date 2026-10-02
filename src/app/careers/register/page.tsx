'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layers, Mail, Lock, User, Phone, UserPlus, AlertCircle } from 'lucide-react';

/** Pendaftaran akun KANDIDAT mandiri (terpisah dari akun karyawan). */
export default function CandidateRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/careers/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j?.detail || 'Pendaftaran gagal. Periksa data Anda.');
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
          <h1 className="text-lg font-extrabold text-[#0f172a]">Daftar Akun Kandidat</h1>
          <p className="text-xs text-[#64748b] mt-1">
            Buat akun untuk melamar dan memantau status lamaran Anda.
          </p>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-[#fce8e6] border border-[#f5c2c7] text-xs text-[#c5221f] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">Nama Lengkap</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-[#94a3b8]" />
                <input
                  type="text" required value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Nama sesuai KTP"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#94a3b8]" />
                <input
                  type="email" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="nama@email.com"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">No. Telepon (opsional)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-[#94a3b8]" />
                <input
                  type="text" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+62 8xx-xxxx-xxxx"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#334155] mb-1">Kata Sandi</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-[#94a3b8]" />
                <input
                  type="password" required minLength={6} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
                />
              </div>
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#007a5a] hover:bg-[#00684a] text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              {loading ? 'Mendaftar…' : (<><UserPlus className="h-4 w-4" /> Daftar</>)}
            </button>
          </form>

          <p className="mt-4 text-xs text-center text-[#64748b]">
            Sudah punya akun?{' '}
            <Link href="/careers/login" className="font-semibold text-[#007a5a] hover:underline">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
