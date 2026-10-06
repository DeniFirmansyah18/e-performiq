import { NextRequest } from 'next/server';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { assertCan } from '@/lib/auth/rbac';
import { ok, problem } from '@/lib/api/response';
import { generateInterviewRoom, isGoogleMeetConfigured } from '@/lib/services/googleMeetService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/recruitment/interviews/generate-room/config — status integrasi (HR).
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:read');
    return ok({ googleMeetConfigured: isGoogleMeetConfigured() });
  } catch (err) {
    return problem(err, '/api/v1/recruitment/interviews/generate-room');
  }
}

// POST /api/v1/recruitment/interviews/generate-room — buat tautan ruang (HR).
// Memakai Google Meet REST API bila env kredensial diisi; jika tidak, fallback
// ke generator tautan meet.google.com.
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    assertCan(session, 'recruitment:manage');
    const result = await generateInterviewRoom();
    const message = result.provider === 'GOOGLE_MEET_API'
      ? 'Ruang Google Meet berhasil dibuat.'
      : 'Tautan ruang dibuat (mode fallback).';
    return ok(result, message);
  } catch (err) {
    return problem(err, '/api/v1/recruitment/interviews/generate-room');
  }
}
