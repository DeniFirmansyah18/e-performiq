'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layers, LogOut, Briefcase, LayoutDashboard, ClipboardList } from 'lucide-react';

/** Dashboard ringkas kandidat. Daftar lowongan penuh menyusul di WS-3. */
export default function CandidatePortalPage() {
  const router = useRouter();
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/careers/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data?.account) setAccount(j.data.account);
        else router.replace('/careers/login');
      })
      .catch(() => router.replace('/careers/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const logout = async () => {
    await fetch('/api/v1/careers/auth/me', { method: 'POST' });
    router.push('/careers/login');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-[#64748b]">Memuat…</div>;
  }
  if (!account) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="h-14 bg-[#0d131f] px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#007a5a]">
            <Layers className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-white">Portal Kandidat</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-300 hidden sm:inline">{account.name}</span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Keluar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl bg-white border border-[#e2e8f0] p-6">
          <h1 className="text-xl font-extrabold text-[#0f172a]">Selamat datang, {account.name}</h1>
          <p className="text-xs text-[#64748b] mt-1">{account.email}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/careers"
            className="group rounded-2xl bg-white border border-[#e2e8f0] p-5 hover:border-[#007a5a] hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6f4ea]">
                <Briefcase className="h-4 w-4 text-[#007a5a]" />
              </span>
              <p className="text-sm font-bold text-[#0f172a]">Daftar Lowongan</p>
            </div>
            <p className="mt-2 text-xs text-[#64748b]">
              Lihat posisi yang tersedia, kualifikasi, kuota, dan status lowongan.
            </p>
          </Link>

          <Link
            href="/careers/status"
            className="group rounded-2xl bg-white border border-[#e2e8f0] p-5 hover:border-[#007a5a] hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e0f2fe]">
                <ClipboardList className="h-4 w-4 text-[#0284c7]" />
              </span>
              <p className="text-sm font-bold text-[#0f172a]">Status Lamaran</p>
            </div>
            <p className="mt-2 text-xs text-[#64748b]">
              Pantau timeline tahapan lamaran Anda (tes, wawancara, keputusan).
            </p>
          </Link>
        </div>

        <div className="rounded-2xl bg-white border border-dashed border-[#cbd5e1] p-6 text-center">
          <LayoutDashboard className="h-5 w-5 text-[#94a3b8] mx-auto" />
          <p className="mt-2 text-xs text-[#64748b]">
            Daftar lowongan lengkap &amp; lamaran menyusul pada pengembangan berikutnya.
          </p>
        </div>
      </main>
    </div>
  );
}
