'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { UserRole } from '@/types';
import {
  LineChart,
  CheckSquare,
  UserCheck,
  ShieldCheck,
  Grid3X3,
} from 'lucide-react';

type NavItem = { name: string; href: string; icon: any; roles: UserRole[] };

/**
 * Menu bilah atas dengan label eksplisit dan navigasi langsung ke fitur penting.
 */
const NAV_ITEMS: NavItem[] = [
  { name: 'Ruang Eksekutif (CEO)', href: '/dashboard/executive', icon: LineChart, roles: ['BOD'] },
  { name: 'Peta Talenta & Suksesi', href: '/dashboard/ninebox-matrix', icon: Grid3X3, roles: ['BOD'] },
  { name: 'Cockpit Evaluasi Manajer', href: '/dashboard/manager-cockpit', icon: CheckSquare, roles: ['PEOPLE_MANAGER'] },
  { name: 'Manajemen Akun', href: '/dashboard/account-management', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
];

/**
 * Employee Portal tidak ditampilkan untuk HR/BOD (mereka membukanya dari
 * dashboard-nya sendiri) dan tidak untuk SUPER_ADMIN (dialihkan middleware).
 */
const EMPLOYEE_PORTAL_ITEM: NavItem = {
  name: 'Portal Karyawan',
  href: '/dashboard/employee-portal',
  icon: UserCheck,
  roles: ['EMPLOYEE'],
};

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.name}
      aria-label={item.name}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
        active
          ? 'bg-[#007a5a] text-white shadow-xs'
          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
      <span>{item.name}</span>
    </Link>
  );
}

export default function NavMenu() {
  const { activeRole } = useAuth();
  const pathname = usePathname();

  const items = [...NAV_ITEMS, EMPLOYEE_PORTAL_ITEM].filter((i) => i.roles.includes(activeRole));

  return (
    <nav className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <NavLink key={item.name} item={item} active={pathname === item.href.split('?')[0]} />
      ))}
    </nav>
  );
}
