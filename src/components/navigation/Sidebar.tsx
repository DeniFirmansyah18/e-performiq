'use client';

import React, { useState } from 'react';
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
  Settings,
  FolderArchive,
  BookOpen,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { activeRole } = useAuth();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const corePortals: Array<{ name: string; href: string; icon: any; roles: UserRole[] }> = [
    { name: 'Executive Boardroom', href: '/dashboard/executive', icon: LineChart, roles: ['BOD', 'SUPER_ADMIN', 'AUDITOR', 'ASSESSOR'] },
    { name: 'HR Ops Command Center', href: '/dashboard/hr-command', icon: Network, roles: ['HR_MANAGER', 'SUPER_ADMIN', 'BOD', 'ASSESSOR'] },
    { name: 'Manager Evaluation Cockpit', href: '/dashboard/manager-cockpit', icon: CheckSquare, roles: ['PEOPLE_MANAGER', 'SUPER_ADMIN', 'HR_MANAGER', 'ASSESSOR'] },
    { name: 'Employee Growth Portal', href: '/dashboard/employee-portal', icon: UserCheck, roles: ['EMPLOYEE', 'PEOPLE_MANAGER', 'SUPER_ADMIN', 'HR_MANAGER', 'BOD', 'AUDITOR', 'ASSESSOR'] },
  ];

  const modulesGovernance: Array<{ name: string; href: string; icon: any; roles: UserRole[] }> = [
    { name: '9-Box Talent Matrix', href: '/dashboard/ninebox-matrix', icon: Grid3X3, roles: ['BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'SUPER_ADMIN', 'ASSESSOR'] },
    { name: 'Offboarding & Clearance', href: '/dashboard/hr-command?tab=offboarding', icon: ClipboardCheck, roles: ['HR_MANAGER', 'SUPER_ADMIN', 'BOD'] },
    { name: 'GCG Audit & Compliance', href: '/dashboard/audit-governance', icon: Scale, roles: ['AUDITOR', 'BOD', 'SUPER_ADMIN', 'HR_MANAGER', 'ASSESSOR'] },
  ];

  const visibleCorePortals = corePortals.filter((p) => p.roles.includes(activeRole));
  const visibleModules = modulesGovernance.filter((m) => m.roles.includes(activeRole));

  const bottomNav = [
    { name: 'Settings & Preferences', href: '#', icon: Settings },
    { name: 'GCG Policy Archive', href: '#', icon: FolderArchive },
  ];

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-[#e2e8f0] flex flex-col justify-between min-h-[calc(100vh-3.5rem)] select-none">
      <div className="p-4 space-y-6">
        
        {/* Section 1: Core Portals */}
        <div>
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">
            Core Portals
          </p>
          <nav className="space-y-1">
            {visibleCorePortals.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#007a5a] text-white shadow-sm'
                      : 'text-[#334155] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-[#64748b]'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Section 2: Modules & Governance */}
        {visibleModules.length > 0 && (
          <div>
            <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">
              Modules & Governance
            </p>
            <nav className="space-y-1">
              {visibleModules.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-[#007a5a] text-white shadow-sm'
                        : 'text-[#334155] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-[#64748b]'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

      </div>

      {/* Section 3: Bottom Menu */}
      <div className="p-4 border-t border-[#E1E3E5] space-y-1.5">
        <button
          type="button"
          onClick={() => setIsGuideOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[12px] text-xs font-semibold text-[#008060] bg-[#E3F1DF] hover:bg-[#D4EBD0] border border-[#B4E3B2] transition-all cursor-pointer text-left"
        >
          <BookOpen className="h-4 w-4 text-[#008060] flex-shrink-0" />
          <span>Panduan Aplikasi &amp; Acuan</span>
        </button>

        {bottomNav.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-all"
            >
              <Icon className="h-4 w-4 text-[#94a3b8]" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      <UserGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </aside>
  );
}
