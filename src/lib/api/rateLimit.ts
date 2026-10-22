/**
 * Rate limiter in-memory untuk endpoint sensitif (unggah, publikasi, AI).
 *
 * Batasan jujur: penyimpanan per-proses. Di deployment multi-instance
 * (serverless/beberapa pod) batas ini berlaku per instance, bukan global.
 * Untuk batas global, ganti penyimpanan dengan Redis tanpa mengubah pemanggil.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Dipakai tes untuk mengosongkan state antar kasus. */
export function resetRateLimit(): void {
  buckets.clear();
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, limit, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0, resetAt };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  const allowed = existing.count <= limit;

  return {
    allowed,
    limit,
    remaining,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    resetAt: existing.resetAt,
  };
}

export function rateLimitHeaders(result: RateLimitResult, limit = result.limit): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(result.remaining),
  };
  if (!result.allowed) headers['Retry-After'] = String(result.retryAfterSeconds);
  return headers;
}

/**
 * Kunci rate limit: identitas pengguna bila ada, jika tidak alamat IP.
 * `x-forwarded-for` dipakai karena aplikasi berjalan di belakang proxy.
 */
export function rateLimitKey(req: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  return `ip:${ip}`;
}
