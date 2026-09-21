import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME, SessionPayload } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';

export async function getAuthSession(req?: Request | NextRequest): Promise<SessionPayload> {
  // 1. If req is passed, check req cookies and headers directly
  if (req) {
    if ('cookies' in req && typeof (req as NextRequest).cookies?.get === 'function') {
      const token = (req as NextRequest).cookies.get(SESSION_COOKIE_NAME)?.value;
      if (token) {
        const sess = await verifySession(token);
        if (sess) return sess;
      }
    }

    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]*)`));
      if (match && match[1]) {
        const sess = await verifySession(decodeURIComponent(match[1]));
        if (sess) return sess;
      }
    }

    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sess = await verifySession(authHeader.substring(7));
      if (sess) return sess;
    }
  }

  // 2. Next.js AsyncLocalStorage cookies()
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const sess = await verifySession(token);
      if (sess) return sess;
    }
  } catch {
    // cookies() context not available
  }

  // 3. Next.js AsyncLocalStorage headers()
  try {
    const authHeader = headers().get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sess = await verifySession(authHeader.substring(7));
      if (sess) return sess;
    }
  } catch {
    // headers() context not available
  }

  throw new AuthError('Sesi tidak valid atau telah berakhir. Silakan login kembali.');
}
