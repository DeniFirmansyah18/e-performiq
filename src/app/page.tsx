'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, activeRole } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      if (activeRole === 'BOD') router.replace('/dashboard/executive');
      else if (activeRole === 'HR_MANAGER') router.replace('/dashboard/hr-command');
      else if (activeRole === 'PEOPLE_MANAGER') router.replace('/dashboard/manager-cockpit');
      else if (activeRole === 'EMPLOYEE') router.replace('/dashboard/employee-portal');
      else if (activeRole === 'AUDITOR') router.replace('/dashboard/audit-governance');
      else router.replace('/dashboard/executive');
    } else {
      router.replace('/login');
    }
  }, [isAuthenticated, activeRole, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090d16]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <span className="text-xs text-slate-400 font-medium">Memuat E-PerformIQ Portal...</span>
      </div>
    </div>
  );
}
