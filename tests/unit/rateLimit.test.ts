import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rateLimit, resetRateLimit, rateLimitHeaders } from '@/lib/api/rateLimit';

describe('rateLimit', () => {
  beforeEach(() => resetRateLimit());

  it('mengizinkan permintaan sampai batas', () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit('k', 3, 60_000)).toMatchObject({ allowed: true });
    }
  });

  it('menolak permintaan melebihi batas', () => {
    for (let i = 0; i < 3; i++) rateLimit('k', 3, 60_000);
    const res = rateLimit('k', 3, 60_000);
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('key berbeda punya kuota terpisah', () => {
    for (let i = 0; i < 3; i++) rateLimit('a', 3, 60_000);
    expect(rateLimit('a', 3, 60_000).allowed).toBe(false);
    expect(rateLimit('b', 3, 60_000).allowed).toBe(true);
  });

  it('jendela kedaluwarsa mengembalikan kuota', async () => {
    rateLimit('w', 1, 40);
    expect(rateLimit('w', 1, 40).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect(rateLimit('w', 1, 40).allowed).toBe(true);
  });

  it('remaining menurun sesuai pemakaian', () => {
    expect(rateLimit('r', 5, 60_000).remaining).toBe(4);
    expect(rateLimit('r', 5, 60_000).remaining).toBe(3);
  });

  it('header membawa nilai yang bisa dibaca klien', () => {
    const res = rateLimit('h', 2, 60_000);
    const headers = rateLimitHeaders(res, 2);
    expect(headers['X-RateLimit-Limit']).toBe('2');
    expect(headers['X-RateLimit-Remaining']).toBe('1');
  });
});
