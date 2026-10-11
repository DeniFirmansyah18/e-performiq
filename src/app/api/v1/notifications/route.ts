import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, problem } from '@/lib/api/response';
import {
  listEmployeeNotifications,
  unreadEmployeeNotificationCount,
  markEmployeeNotificationsRead,
  type NotifQuery,
} from '@/lib/services/notificationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Penerima = user sesi ini (id) + perannya + karyawan tertaut bila ada. */
function recipientOf(session: { userId: string; employeeId: string | null; role: NotifQuery['role'] }): NotifQuery {
  return { userId: session.userId, employeeId: session.employeeId, role: session.role };
}

// GET /api/v1/notifications — notifikasi in-app penerima sesi + jumlah belum dibaca.
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const limitParam = Number(req.nextUrl.searchParams.get('limit') ?? '50');
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

    const q = recipientOf(session);
    const [items, unreadCount] = await Promise.all([
      listEmployeeNotifications(db, q, limit),
      unreadEmployeeNotificationCount(db, q),
    ]);
    return ok({ items, unreadCount });
  } catch (err) {
    return problem(err, '/api/v1/notifications');
  }
}

// POST /api/v1/notifications/read — tandai notifikasi terbaca (semua, atau ?id=).
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    const q = recipientOf(session);
    const id = req.nextUrl.searchParams.get('id') ?? undefined;
    await markEmployeeNotificationsRead(db, q, id);
    const unreadCount = await unreadEmployeeNotificationCount(db, q);
    return ok({ unreadCount });
  } catch (err) {
    return problem(err, '/api/v1/notifications');
  }
}
