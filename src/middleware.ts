import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/auth/session';
import type { UserRole } from '@/types';

// Peta segmen dashboard -> role yang diizinkan (selaras dengan Sidebar.tsx).
const DASHBOARD_ROLES: Record<string, readonly UserRole[]> = {
  executive: ['BOD', 'SUPER_ADMIN', 'AUDITOR', 'ASSESSOR'],
  'hr-command': ['HR_MANAGER', 'SUPER_ADMIN', 'BOD', 'ASSESSOR'],
  'manager-cockpit': ['PEOPLE_MANAGER', 'SUPER_ADMIN', 'HR_MANAGER', 'ASSESSOR'],
  'employee-portal': ['BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'EMPLOYEE', 'AUDITOR', 'SUPER_ADMIN', 'ASSESSOR'],
  'ninebox-matrix': ['BOD', 'HR_MANAGER', 'PEOPLE_MANAGER', 'SUPER_ADMIN', 'ASSESSOR'],
  'audit-governance': ['AUDITOR', 'BOD', 'SUPER_ADMIN', 'HR_MANAGER', 'ASSESSOR'],
};

// Dashboard utama per role (untuk redirect saat mengakses halaman terlarang).
function homeForRole(role: UserRole): string {
  switch (role) {
    case 'BOD':
    case 'SUPER_ADMIN':
      return '/dashboard/executive';
    case 'HR_MANAGER':
      return '/dashboard/hr-command';
    case 'PEOPLE_MANAGER':
      return '/dashboard/manager-cockpit';
    case 'AUDITOR':
      return '/dashboard/audit-governance';
    default:
      return '/dashboard/employee-portal';
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Task 10: verifikasi JWT nyata, bukan hanya keberadaan cookie.
  const session = token ? await verifySession(token) : null;

  if (pathname.startsWith('/dashboard')) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      const res = NextResponse.redirect(loginUrl);
      if (token) res.cookies.delete(SESSION_COOKIE_NAME); // token rusak/kedaluwarsa
      return res;
    }

    // Gating per-segmen: role yang tidak berhak diarahkan ke dashboard-nya.
    const segment = pathname.split('/')[2] ?? '';
    const allowed = DASHBOARD_ROLES[segment];
    if (allowed && !allowed.includes(session.role)) {
      return NextResponse.redirect(new URL(homeForRole(session.role), request.url));
    }
  }

  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL(homeForRole(session.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
