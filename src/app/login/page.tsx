'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { DUMMY_USERS } from '@/lib/dummy-data';
import { UserRole } from '@/types';
import UserGuideModal from '@/components/guide/UserGuideModal';
import {
  Layers,
  Lock,
  Mail,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Building2,
  KeyRound,
  BookOpen,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithCredentials, loginAs } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('enterprise2026');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const roleMeta: Record<UserRole, { label: string; desc: string; badge: string; badgeColor: string }> = {
    BOD: {
      label: 'Board of Directors (CEO)',
      desc: 'Akses Strategic VMAI, 4 Balanced Scorecard, & Heatmap Eksekutif.',
      badge: 'C-Level / Direksi',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    HR_MANAGER: {
      label: 'VP of Human Capital',
      desc: 'Kelola Manpower Planning (MPP), QoH, 9-Box Matrix, & Pesangon PP 35.',
      badge: 'HR Command',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    PEOPLE_MANAGER: {
      label: 'Head of Engineering (Atasan)',
      desc: 'Persetujuan target KPI tim, kepatuhan SOP tim, & evaluasi 360.',
      badge: 'People Lead',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    EMPLOYEE: {
      label: 'Senior Software Engineer',
      desc: 'Self-service KPI tree, Composite GPA real-time, peer review, & LCI.',
      badge: 'Individual Talent',
      badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    },
    AUDITOR: {
      label: 'Chief Internal Auditor',
      desc: 'Monitoring audit trail anti-tamper, GCG compliance, & log kalibrasi.',
      badge: 'SPI Governance',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    SUPER_ADMIN: {
      label: 'Super Admin',
      desc: 'Konfigurasi parameter sistem & manajemen hak akses.',
      badge: 'Administrator',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    },
    ASSESSOR: {
      label: 'Lead Talent Assessor (Penilai)',
      desc: 'Komite penilai independen: asesmen potensi, moderasi nilai Gaussian, & kalibrasi suksesi 9-Box.',
      badge: 'Komite Penilai',
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    },
  };

  const handleRoleQuickLogin = async (role: UserRole) => {
    setIsLoading(true);
    setErrorMsg('');
    const ok = await loginAs(role);
    setIsLoading(false);
    if (ok) {
      if (role === 'BOD') router.push('/dashboard/executive');
      else if (role === 'HR_MANAGER') router.push('/dashboard/hr-command');
      else if (role === 'PEOPLE_MANAGER') router.push('/dashboard/manager-cockpit');
      else if (role === 'EMPLOYEE') router.push('/dashboard/employee-portal');
      else if (role === 'AUDITOR') router.push('/dashboard/audit-governance');
      else router.push('/dashboard/executive');
    } else {
      setErrorMsg('Gagal melakukan login cepat. Pastikan database aktif.');
    }
  };

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

    if (success) {
      const user = DUMMY_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
      const role = user?.role || 'BOD';
      if (role === 'BOD') router.push('/dashboard/executive');
      else if (role === 'HR_MANAGER') router.push('/dashboard/hr-command');
      else if (role === 'PEOPLE_MANAGER') router.push('/dashboard/manager-cockpit');
      else if (role === 'EMPLOYEE') router.push('/dashboard/employee-portal');
      else if (role === 'AUDITOR') router.push('/dashboard/audit-governance');
      else router.push('/dashboard/executive');
    } else {
      setErrorMsg('Email atau password tidak valid. Silakan periksa kembali atau gunakan tombol role di bawah.');
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
        
        {/* Left Column: Form Login Asli */}
        <div className="lg:col-span-5 stitch-card-white p-6 sm:p-8 space-y-6">
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

          <div className="pt-4 border-t border-[#f1f5f9] text-center">
            <p className="text-[11px] text-[#64748b]">
              Dilindungi enkripsi AES-256 &amp; TLS 1.3 sesuai Standar Kepatuhan OJK/GCG &amp; KNKG RI.
            </p>
          </div>
        </div>

        {/* Right Column: 1-Click Quick Demo Account Selector */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#007a5a] tracking-wider uppercase flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Quick 1-Click Role Testing
              </span>
              <h3 className="text-xl font-extrabold text-[#0f172a] tracking-tight mt-0.5">
                Pilih Akun Demo Sesuai Role PRD
              </h3>
            </div>
            <span className="text-[11px] text-[#475569] bg-white border border-[#e2e8f0] px-2.5 py-1 rounded-lg font-semibold shadow-xs">
              Langsung Masuk
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DUMMY_USERS.map((user) => {
              const meta = roleMeta[user.role];
              return (
                <button
                  key={user.id}
                  onClick={() => handleRoleQuickLogin(user.role)}
                  className="flex flex-col justify-between p-4 rounded-2xl border border-[#e2e8f0] bg-white hover:border-[#007a5a] hover:shadow-xs text-left transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={user.name}
                      className="h-10 w-10 rounded-full object-cover border border-[#e2e8f0] flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta?.badgeColor}`}>
                          {meta?.badge || user.role}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#0f172a] group-hover:text-[#007a5a] transition-colors truncate mt-1.5">
                        {user.name}
                      </p>
                      <p className="text-[11px] text-[#64748b] truncate">
                        {user.position}
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#64748b] mt-3 pt-2 border-t border-[#f1f5f9] line-clamp-2 leading-relaxed">
                    {meta?.desc}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-[#007a5a] font-bold">
                    <span className="font-mono text-[10px] text-[#94a3b8] truncate max-w-[170px]">{user.email}</span>
                    <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Masuk &rarr;
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white flex items-center gap-3 shadow-xs">
            <CheckCircle2 className="h-5 w-5 text-[#007a5a] flex-shrink-0" />
            <p className="text-xs text-[#334155] leading-relaxed">
              Seluruh data terisi otomatis (*pre-seeded PostgreSQL data*) mencakup 24 tabel ERD PRD, perhitungan komposit GPA, kalkulator pesangon PP 35/2021, dan log audit GCG.
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
