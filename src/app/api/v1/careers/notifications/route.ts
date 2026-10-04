import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getCandidateSessionOrNull } from '@/lib/auth/candidateSession';
import { ok, fail, problem } from '@/lib/api/response';
import { listNotifications, markNotificationsRead } from '@/lib/services/notificationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/careers/notifications — notifikasi in-app kandidat (butuh sesi kandidat)
export async function GET(req: NextRequest) {
  try {
    const session = await getCandidateSessionOrNull(req);
    if (!session) return fail('UNAUTHORIZED', 'Silakan login sebagai kandidat.', 401);
    const notifications = await listNotifications(db, session.accountId);
    const unread = notifications.filter((n: any) => !n.isRead).length;
    return ok({ notifications, unread });
  } catch (err) {
    return problem(err, '/api/v1/careers/notifications');
  }
}

// POST /api/v1/careers/notifications — tandai semua terbaca
export async function POST(req: NextRequest) {
  try {
    const session = await getCandidateSessionOrNull(req);
    if (!session) return fail('UNAUTHORIZED', 'Silakan login sebagai kandidat.', 401);
    await markNotificationsRead(db, session.accountId);
    return ok({ read: true });
  } catch (err) {
    return problem(err, '/api/v1/careers/notifications');
  }
}
