import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem } from '@/lib/api/response';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { logAction } from '@/lib/services/auditService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/v1/auth/logout
export async function POST(req: NextRequest) {
  try {
    let session = null;
    try {
      session = await getAuthSession(req);
    } catch {
      // ignore
    }

    if (session) {
      await logAction(db, {
        userId: session.userId,
        actionType: 'LOGOUT',
        entityName: 'users',
        recordId: session.userId,
        description: `User logout dari sistem: ${session.email}`,
      });
    }

    const response = ok({ message: 'Logout berhasil.' });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: '',
      httpOnly: true,
      maxAge: 0,
      expires: new Date(0),
      path: '/',
    });

    return response;
  } catch (err) {
    return problem(err, '/api/v1/auth/logout');
  }
}
