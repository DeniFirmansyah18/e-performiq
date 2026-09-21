import { SignJWT, jwtVerify } from 'jose';
import type { UserRole } from '@/types';

export const SESSION_COOKIE_NAME = 'eperformiq_token';
const ALG = 'HS256';
const DEFAULT_TTL = '8h';

export type SessionPayload = {
  userId: string;
  employeeId: string | null;
  role: UserRole;
  email: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? 'dev-only-secret-ganti-di-produksi';
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET wajib diisi di produksi');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  payload: SessionPayload,
  ttl: string = DEFAULT_TTL
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(getSecret());
}

/**
 * Mengembalikan null untuk token tidak valid ATAU kedaluwarsa. Pemanggil
 * tidak perlu membedakan keduanya — dua-duanya berarti "belum
 * terautentikasi" (Review Focus butir 4).
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      employeeId: (payload.employeeId as string | null) ?? null,
      role: payload.role as UserRole,
      email: payload.email,
    };
  } catch {
    return null;
  }
}
