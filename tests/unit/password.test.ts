import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('password', () => {
  it('menghasilkan hash yang berbeda dari plaintext', async () => {
    const hash = await hashPassword('enterprise2026');
    expect(hash).not.toBe('enterprise2026');
    expect(hash.startsWith('$2')).toBe(true); // format bcrypt
  });

  it('menerima password yang benar', async () => {
    const hash = await hashPassword('enterprise2026');
    expect(await verifyPassword('enterprise2026', hash)).toBe(true);
  });

  it('menolak password yang salah', async () => {
    const hash = await hashPassword('enterprise2026');
    expect(await verifyPassword('salah', hash)).toBe(false);
  });

  it('menghasilkan salt berbeda untuk password sama', async () => {
    const a = await hashPassword('sama');
    const b = await hashPassword('sama');
    expect(a).not.toBe(b);
  });

  it('mengembalikan false, bukan melempar, untuk hash rusak', async () => {
    expect(await verifyPassword('apa pun', 'bukan-hash-bcrypt')).toBe(false);
  });
});
