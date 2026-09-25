'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { DUMMY_USERS } from '@/lib/dummy-data';
import UserGuideModal from '@/components/guide/UserGuideModal';
import {
  Layers,
  Search,
  Calendar,
  Bell,
  ShieldCheck,
  ChevronDown,
  LogOut,
  UserCheck,
  BookOpen,
} from 'lucide-react';

export default function Header() {
  const { currentUser, activeRole, switchRole, activePeriod, setActivePeriod, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full h-14 bg-[#0d131f] border-b border-[#1e293b] px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Brand / Logo */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/executive" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#007a5a] shadow-sm">
            <Layers className="h-4 w-4 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-white">
              E-PerformIQ
            </span>
            <span className="rounded-md bg-[#161f30] border border-slate-700/60 px-2 py-0.5 text-[10px] font-medium text-slate-300">
              Enterprise v1.0
            </span>
          </div>
        </Link>
      </div>

      {/* Center: Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search governance metrics, employee KPI, code..."
            className="w-full h-9 pl-9 pr-14 rounded-lg bg-[#161f30] border border-slate-700/60 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#007a5a]"
          />
          <div className="absolute right-2.5 top-2 px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400 border border-slate-700">
            ⌘K
          </div>
        </div>
      </div>

      {/* Right: Period, Notifs, Profile */}
      <div className="flex items-center gap-3">
        
        {/* Panduan Aplikasi Button */}
        <button
          onClick={() => setIsGuideOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[#008060] hover:bg-[#006E52] text-white transition-all text-xs font-semibold shadow-xs cursor-pointer"
          title="Buka Buku Panduan Penggunaan & Acuan Standar"
        >
          <BookOpen className="h-3.5 w-3.5 text-white" />
          <span className="hidden sm:inline">Panduan Aplikasi</span>
        </button>

        {/* Period Pill */}
        <div className="flex items-center gap-1.5 rounded-lg bg-[#161f30] border border-slate-700/60 px-3 py-1.5 text-xs text-slate-200">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={activePeriod}
            onChange={(e) => setActivePeriod(e.target.value)}
            className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer text-slate-200"
          >
            <option value="2026-Q3" className="bg-[#0d131f] text-white">2026-Q3</option>
            <option value="2026-FY" className="bg-[#0d131f] text-white">2026-FY</option>
            <option value="2026-Q2" className="bg-[#0d131f] text-white">2026-Q2</option>
          </select>
        </div>

        {/* Notification Bell */}
        <button className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[#0d131f]" />
        </button>

        {/* Shield Icon */}
        <button className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
          <ShieldCheck className="h-4 w-4" />
        </button>

        {/* User Profile Card with Role Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 pl-2 hover:opacity-90 transition-opacity"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-white leading-tight">
                {currentUser.name}
              </p>
              <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                {currentUser.position}
              </p>
            </div>
            <img
              src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'}
              alt={currentUser.name}
              className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-700"
            />
          </button>

          {/* Profile & Role Switcher Dropdown */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#111827] border border-slate-700 shadow-2xl p-2 z-50 text-xs animate-fadeIn">
              <div className="p-2.5 border-b border-slate-800">
                <p className="font-bold text-white">{currentUser.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-[#007a5a]/20 text-emerald-400 border border-[#007a5a]/30">
                  {currentUser.role}
                </span>
              </div>

              <div className="py-2">
                <p className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Beralih Role (Demo Switcher):
                </p>
                {DUMMY_USERS.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      switchRole(u.role);
                      setIsProfileOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                      activeRole === u.role
                        ? 'bg-[#007a5a] text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <p className="text-xs">{u.name}</p>
                      <p className="text-[10px] opacity-70 truncate max-w-[170px]">{u.position}</p>
                    </div>
                    {activeRole === u.role && <UserCheck className="h-3.5 w-3.5 flex-shrink-0" />}
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    setIsProfileOpen(false);
                    await logout();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-rose-400 hover:bg-rose-950/30 transition-colors text-left font-semibold text-xs"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout / Keluar Akun</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      <UserGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </header>
  );
}
