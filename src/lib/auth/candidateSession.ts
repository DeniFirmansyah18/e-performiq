import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { AuthError } from './errors';

/**
 * Sesi KANDIDAT — terpisah total dari sesi karyawan (cookie berbeda),
 * agar tidak bisa saling tercampur (spec WS-2 §A1).
 */
export const CANDIDATE_COOKIE_NAME = 'eperformiq_candidate_token';
const ALG = 'HS256';
const DEFAULT_TTL = '12h';

export type CandidateSessionPayload = {
  accountId: string;
  candidateId: string | null;
  email: string;
  name: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? 'dev-only-secret-ganti-di-produksi';
  return new TextEncoder().encode(secret);
}

export async function signCandidateSession(
  payload: CandidateSessionPayload,
  ttl: string = DEFAULT_TTL
): Promise<string> {
  return new SignJWT({ ...payload, kind: 'candidate' })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(getSecret());
}

export async function verifyCandidateSession(
  token: string
): Promise<CandidateSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (payload.kind !== 'candidate') return null;
    if (typeof payload.accountId !== 'string' || typeof payload.email !== 'string') return null;
    return {
      accountId: payload.accountId,
      candidateId: (payload.candidateId as string | null) ?? null,
      email: payload.email,
      name: (payload.name as string) ?? 'Kandidat',
    };
  } catch {
    return null;
  }
}

/** Auth kandidat (mirror getAuthSession, tapi cookie kandidat). Melempar AuthError bila tak valid. */
export async function getCandidateSession(req?: Request | NextRequest): Promise<CandidateSessionPayload> {
  if (req) {
    if ('cookies' in req && typeof (req as NextRequest).cookies?.get === 'function') {
      const token = (req as NextRequest).cookies.get(CANDIDATE_COOKIE_NAME)?.value;
      if (token) {
        const s = await verifyCandidateSession(token);
        if (s) return s;
      }
    }
    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const m = cookieHeader.match(new RegExp(`(?:^|; )${CANDIDATE_COOKIE_NAME}=([^;]*)`));
      if (m && m[1]) {
        const s = await verifyCandidateSession(decodeURIComponent(m[1]));
        if (s) return s;
      }
    }
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const s = await verifyCandidateSession(authHeader.substring(7));
      if (s) return s;
    }
  }

  try {
    const token = cookies().get(CANDIDATE_COOKIE_NAME)?.value;
    if (token) {
      const s = await verifyCandidateSession(token);
      if (s) return s;
    }
  } catch {
    // cookies() tidak tersedia di luar request
  }

  throw new AuthError('Sesi kandidat tidak valid atau telah berakhir. Silakan login kembali.');
}

/**
 * Varian non-throwing: mengembalikan payload sesi kandidat, atau `null` bila
 * tidak ada sesi valid. Dipakai endpoint "whoami" agar pengunjung anonim tidak
 * memicu 401 (menghindari noise konsol di halaman seperti /careers).
 */
export async function getCandidateSessionOrNull(req?: Request | NextRequest): Promise<CandidateSessionPayload | null> {
  try {
    return await getCandidateSession(req);
  } catch {
    return null;
  }
}
