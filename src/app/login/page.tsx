'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { UserRole } from '@/types';
import UserGuideModal from '@/components/guide/UserGuideModal';
import {
  Layers,
  Lock,
  Mail,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Building2,
  BookOpen,
} from 'lucide-react';

/** Rute dashboard default per role (redirect setelah login). */
function dashboardForRole(role: UserRole): string {
  switch (role) {
    case 'BOD': return '/dashboard/executive';
    case 'HR_MANAGER': return '/dashboard/hr-command';
    case 'PEOPLE_MANAGER': return '/dashboard/manager-cockpit';
    case 'EMPLOYEE': return '/dashboard/employee-portal';
    case 'AUDITOR': return '/dashboard/audit-governance';
    default: return '/dashboard/executive';
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { loginWithCredentials, currentUser } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Setelah kredensial valid, context menyetel currentUser → arahkan ke dashboard per role.
  useEffect(() => {
    if (currentUser) router.push(dashboardForRole(currentUser.role));
  }, [currentUser, router]);

  const handleFormLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email) {
      setErrorMsg('Silakan masukkan alamat email terdaftar.');
      return;
    }

    setIsLoading(true);
    const success = await loginWithCredentials(email, password);
    setIsLoading(false);
    // Redirect ditangani oleh efek di atas saat currentUser ter-set.
    if (!success) {
      setErrorMsg('Email atau kata sandi tidak valid. Silakan periksa kembali.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-[#007a5a] selection:text-white">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#007a5a] to-[#004d38] shadow-sm">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-[#0f172a] tracking-tight">
              E-Perform<span className="text-[#007a5a]">IQ</span>
            </h1>
            <p className="text-[11px] text-[#64748b]">Enterprise Standard Tier-1</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#008060] bg-[#E3F1DF] hover:bg-[#D4EBD0] border border-[#B4E3B2] px-3.5 py-1.5 rounded-[12px] transition-all cursor-pointer shadow-xs"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#008060]" />
            <span>Panduan &amp; Acuan Standar</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-[#008060] bg-[#E3F1DF] border border-[#B4E3B2] px-3 py-1.5 rounded-[12px]">
            <ShieldCheck className="h-4 w-4 text-[#008060]" />
            <span>ISO 30414 &amp; GCG Compliant</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl w-full mx-auto my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Form Login Karyawan */}
        <div className="lg:col-span-6 stitch-card-white p-6 sm:p-8 space-y-6">
          <div>
            <span className="text-[11px] font-bold text-[#007a5a] tracking-wider uppercase flex items-center gap-1.5 mb-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Corporate Identity SSO
            </span>
            <h2 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">
              Masuk ke Portal Kinerja
            </h2>
            <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
              Gunakan kredensial resmi korporasi Anda untuk mengakses modul evaluasi kinerja dan tata kelola GCG.
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#fce8e6] border border-[#f5c2c7] text-[#c5221f] text-xs font-semibold animate-shake">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-[#c5221f]" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleFormLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#334155] block">
                Email Korporat (Corporate Email)
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#94a3b8]" />
                <input
                  type="email"
                  placeholder="nama@eperformiq.co.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#cbd5e1] text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#007a5a] transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-[#334155]">
                  Kata Sandi
                </label>
                <span className="text-[11px] text-[#007a5a] hover:underline cursor-pointer font-semibold">
                  Lupa sandi?
                </span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#94a3b8]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#cbd5e1] text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#007a5a] transition-all font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#007a5a] hover:bg-[#00684a] text-white font-bold text-xs shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Masuk dengan Kredensial</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-[#f1f5f9] text-center space-y-2">
            <p className="text-[11px] text-[#64748b]">
              Belum punya akun karyawan?{' '}
              <a href="/employee/register" className="font-semibold text-[#007a5a] hover:underline">
                Daftar mandiri di sini
              </a>
            </p>
            <p className="text-[11px] text-[#64748b]">
              Dilindungi enkripsi AES-256 &amp; TLS 1.3 sesuai Standar Kepatuhan OJK/GCG &amp; KNKG RI.
            </p>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="max-w-6xl w-full mx-auto text-center border-t border-[#e2e8f0] pt-6 text-xs text-[#94a3b8]">
        Enterprise Employee Performance &amp; Lifecycle Analytics (E-PerformIQ) &copy; 2026. Confidential Internal Enterprise Standard.
      </div>

      <UserGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
