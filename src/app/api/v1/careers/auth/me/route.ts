import { NextRequest } from 'next/server';
import { getCandidateSessionOrNull, CANDIDATE_COOKIE_NAME } from '@/lib/auth/candidateSession';
import { ok, problem } from '@/lib/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/v1/careers/auth/me — profil akun kandidat dari sesi kandidat.
// Pola whoami: pengunjung anonim (tanpa sesi) → 200 { account: null } (bukan 401),
// agar halaman publik tidak memicu error konsol. Sisi klien tetap mengalihkan
// ke /careers/login bila account null pada halaman yang dilindungi.
export async function GET(req: NextRequest) {
  try {
    const session = await getCandidateSessionOrNull(req);
    if (!session) return ok({ account: null });
    return ok({
      account: {
        id: session.accountId,
        email: session.email,
        name: session.name,
        candidateId: session.candidateId,
      },
    });
  } catch (err) {
    return problem(err, '/api/v1/careers/auth/me');
  }
}

// GET /api/v1/careers/auth/me (logout) — POST untuk logout
export async function POST(req: NextRequest) {
  const response = ok({ loggedOut: true });
  response.cookies.set({
    name: CANDIDATE_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
