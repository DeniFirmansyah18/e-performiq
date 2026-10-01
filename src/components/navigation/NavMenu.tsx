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
} from 'lucide-react';

type NavItem = { name: string; href: string; icon: any; roles: UserRole[] };

const CORE_PORTALS: NavItem[] = [
  { name: 'Executive Boardroom', href: '/dashboard/executive', icon: LineChart, roles: ['BOD', 'SUPER_ADMIN', 'AUDITOR', 'ASSESSOR'] },
  { name: 'HR Ops Command Center', href: '/dashboard/hr-command', icon: Network, roles: ['HR_MANAGER', 'SUPER_ADMIN', 'BOD', 'ASSESSOR'] },
  { name: 'Manager Evaluation Cockpit', href: '/dashboard/manager-cockpit', icon: CheckSquare, roles: ['PEOPLE_MANAGER', 'SUPER_ADMIN', 'HR_MANAGER', 'ASSESSOR'] },
  { name: 'Employee Growth Portal', href: '/dashboard/employee-portal', icon: UserCheck, roles: ['EMPLOYEE', 'PEOPLE_MANAGER', 'SUPER_ADMIN', 'HR_MANAGER', 'BOD', 'AUDITOR', 'ASSESSOR'] },
];

const MODULES_GOVERNANCE: NavItem[] = [
  { name: '9-Box Talent Matrix', href: '/dashboard/ninebox-matrix', icon: Grid3X3, roles: ['BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'SUPER_ADMIN', 'ASSESSOR'] },
  { name: 'Offboarding & Clearance', href: '/dashboard/hr-command?tab=offboarding', icon: ClipboardCheck, roles: ['HR_MANAGER', 'SUPER_ADMIN', 'BOD'] },
  { name: 'GCG Audit & Compliance', href: '/dashboard/audit-governance', icon: Scale, roles: ['AUDITOR', 'BOD', 'SUPER_ADMIN', 'HR_MANAGER', 'ASSESSOR'] },
];

function NavDropdown({
  label,
  icon: Icon,
  items,
  activeRole,
}: {
  label: string;
  icon: any;
  items: NavItem[];
  activeRole: UserRole;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const visible = items.filter((i) => i.roles.includes(activeRole));
  if (visible.length === 0) return null;

  const isActive = visible.some((i) => pathname === i.href.split('?')[0]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          isActive ? 'bg-[#007a5a] text-white' : 'text-slate-200 hover:bg-slate-800'
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">{label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-64 rounded-xl bg-[#111827] border border-slate-700 shadow-2xl p-1.5 z-50 animate-fadeIn">
          {visible.map((item) => {
            const ItemIcon = item.icon;
            const itemActive = pathname === item.href.split('?')[0];
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  itemActive ? 'bg-[#007a5a] text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <ItemIcon className={`h-4 w-4 ${itemActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function NavMenu() {
  const { activeRole } = useAuth();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <nav className="flex items-center gap-1">
      <NavDropdown label="Portals" icon={Compass} items={CORE_PORTALS} activeRole={activeRole} />
      <NavDropdown label="Modul & Tata Kelola" icon={Landmark} items={MODULES_GOVERNANCE} activeRole={activeRole} />
      <button
        type="button"
        onClick={() => setIsGuideOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 hover:bg-slate-800 transition-colors"
        title="Buka Panduan Penggunaan & Acuan Standar"
      >
        <BookOpen className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">Panduan</span>
      </button>

      <UserGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </nav>
  );
}
