'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LineChart,
  Network,
  CheckSquare,
  Sparkles,
  Grid3X3,
  ClipboardCheck,
  Scale,
  Settings,
  FolderArchive,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const corePortals = [
    { name: 'Executive Boardroom', href: '/dashboard/executive', icon: LineChart },
    { name: 'HR Ops Command Center', href: '/dashboard/hr-command', icon: Network },
    { name: 'Manager Evaluation Cockpit', href: '/dashboard/manager-cockpit', icon: CheckSquare },
    { name: 'Employee Growth Portal', href: '/dashboard/employee-portal', icon: Sparkles },
  ];

  const modulesGovernance = [
    { name: '9-Box Talent Matrix', href: '/dashboard/ninebox-matrix', icon: Grid3X3 },
    { name: 'Offboarding & Clearance', href: '/dashboard/hr-command?tab=offboarding', icon: ClipboardCheck },
    { name: 'GCG Audit & Compliance', href: '/dashboard/audit-governance', icon: Scale },
  ];

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
            {corePortals.map((item) => {
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
        <div>
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">
            Modules & Governance
          </p>
          <nav className="space-y-1">
            {modulesGovernance.map((item) => {
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

      </div>

      {/* Section 3: Bottom Menu */}
      <div className="p-4 border-t border-[#e2e8f0] space-y-1">
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
    </aside>
  );
}
