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
} from 'lucide-react';

type NavItem = { name: string; href: string; icon: any; roles: UserRole[] };

/**
 * Menu bilah atas. Hanya entri yang benar-benar perlu jalan pintas:
 * - HR Command Center dan tab Kontrol Siklus 3-Fase dicapai lewat tab di dalam
 *   halaman HR Command Center itu sendiri (Ringkasan & Analitik / Kontrol 3-Fase),
 *   jadi tidak diduplikasi di sini.
 * - SUPER_ADMIN hanya Manajemen Akun karena middleware mengalihkannya dari
 *   segmen lain.
 */
const NAV_ITEMS: NavItem[] = [
  { name: 'Executive Boardroom', href: '/dashboard/executive', icon: LineChart, roles: ['BOD'] },
  { name: 'Manager Evaluation Cockpit', href: '/dashboard/manager-cockpit', icon: CheckSquare, roles: ['PEOPLE_MANAGER'] },
  { name: 'Manajemen Akun', href: '/dashboard/account-management', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
];

/**
 * Employee Portal tidak ditampilkan untuk HR/BOD (mereka membukanya dari
 * dashboard-nya sendiri) dan tidak untuk SUPER_ADMIN (dialihkan middleware).
 */
const EMPLOYEE_PORTAL_ITEM: NavItem = {
  name: 'Employee Growth Portal',
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
      className={`flex items-center px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
        active ? 'bg-[#007a5a] text-white' : 'text-slate-200 hover:bg-slate-800'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
    </Link>
  );
}

export default function NavMenu() {
  const { activeRole } = useAuth();
  const pathname = usePathname();

  const items = [...NAV_ITEMS, EMPLOYEE_PORTAL_ITEM].filter((i) => i.roles.includes(activeRole));

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {items.map((item) => (
        <NavLink key={item.name} item={item} active={pathname === item.href.split('?')[0]} />
      ))}
    </nav>
  );
}
