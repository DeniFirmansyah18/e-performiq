import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { activeEmailProvider } from '@/lib/services/notificationService';
import { activeWaProvider } from '@/lib/services/whatsappService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/careers/notifications/health — diagnosa kanal notifikasi (HR).
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');

    const emailProvider = activeEmailProvider();
    const whatsappProvider = activeWaProvider();

    const res = (await db.execute(sql`
      SELECT id, recipient AS "to", status::text AS status, provider, error, created_at AS "createdAt"
        FROM email_outbox ORDER BY created_at DESC LIMIT 5
    `)) as unknown as { rows: any[] };

    return ok({
      emailProvider,
      whatsappProvider,
      recent: res.rows ?? [],
    });
  } catch (err) {
    return problem(err, '/api/v1/careers/notifications/health');
  }
}
