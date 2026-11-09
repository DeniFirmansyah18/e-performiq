'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { UserRole } from '@/types';
import UserGuideModal from '@/components/guide/UserGuideModal';
import {
  LineChart,
  Network,
  CheckSquare,
  UserCheck,
  Grid3X3,
  ClipboardCheck,
  Scale,
  BookOpen,
  ChevronDown,
  Compass,
  Landmark,
  ShieldCheck,
} from 'lucide-react';

type NavItem = { name: string; href: string; icon: any; roles: UserRole[] };

const NAV_ITEMS: NavItem[] = [
  { name: 'Executive Boardroom', href: '/dashboard/executive', icon: LineChart, roles: ['BOD'] },
  { name: 'HR Ops Command Center', href: '/dashboard/hr-command', icon: Network, roles: ['HR_MANAGER', 'BOD'] },
  { name: 'Manager Evaluation Cockpit', href: '/dashboard/manager-cockpit', icon: CheckSquare, roles: ['PEOPLE_MANAGER', 'HR_MANAGER'] },
  { name: 'Employee Growth Portal', href: '/dashboard/employee-portal', icon: UserCheck, roles: ['EMPLOYEE', 'PEOPLE_MANAGER', 'HR_MANAGER', 'BOD'] },
  { name: '9-Box Talent Matrix', href: '/dashboard/ninebox-matrix', icon: Grid3X3, roles: ['BOD', 'HR_MANAGER', 'PEOPLE_MANAGER'] },
  { name: 'Offboarding & Clearance', href: '/dashboard/hr-command?tab=lifecycle&phase=POST', icon: ClipboardCheck, roles: ['HR_MANAGER', 'BOD'] },
  { name: 'Manajemen Akun', href: '/dashboard/account-management', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.name}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
        active ? 'bg-[#007a5a] text-white' : 'text-slate-200 hover:bg-slate-800'
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden xl:inline">{item.name}</span>
    </Link>
  );
}

export default function NavMenu() {
  const { activeRole } = useAuth();
  const pathname = usePathname();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {NAV_ITEMS.filter((i) => i.roles.includes(activeRole)).map((item) => (
        <NavLink key={item.name} item={item} active={pathname === item.href.split('?')[0]} />
      ))}
      <button
        type="button"
        onClick={() => setIsGuideOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 hover:bg-slate-800 transition-colors whitespace-nowrap"
        title="Buka Panduan Penggunaan & Acuan Standar"
      >
        <BookOpen className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden xl:inline">Panduan</span>
      </button>

      <UserGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </nav>
  );
}
