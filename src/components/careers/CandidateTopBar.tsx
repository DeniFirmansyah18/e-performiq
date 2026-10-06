'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Layers, ArrowLeft, LogOut } from 'lucide-react';
import CandidateNotifications from '@/components/careers/CandidateNotifications';

interface CandidateAccount { id: string; name: string; email: string; converted?: boolean }

/**
 * Navbar kandidat yang konsisten di seluruh halaman portal karier
 * (lamaran, status, portal, asesmen). Hanya tampil bila pengunjung
 * memiliki sesi kandidat aktif — pengunjung anonim di /careers tidak
 * melihat navbar ini. Menyediakan tombol kembali + notifikasi progress.
 */
export default function CandidateTopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [account, setAccount] = useState<CandidateAccount | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/v1/careers/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setAccount(j?.data?.account ?? null); })
      .catch(() => { if (alive) setAccount(null); });
    return () => { alive = false; };
  }, [pathname]);

  if (!account) return null;

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/careers/portal');
  };

  const logout = async () => {
    await fetch('/api/v1/careers/auth/me', { method: 'POST' }).catch(() => {});
    router.push('/careers/login');
  };

  return (
    <header className="h-14 bg-[#0d131f] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={goBack}
          aria-label="Kembali"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Link href="/careers/portal" className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#007a5a] flex-shrink-0">
            <Layers className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-white truncate">Portal Kandidat</span>
        </Link>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-xs text-slate-300 hidden sm:inline truncate max-w-[160px]">{account.name}</span>
        <CandidateNotifications />
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}
