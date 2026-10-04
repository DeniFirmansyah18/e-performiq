import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Kumpulkan semua file .ts/.tsx di bawah src/ (rekursif). */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

describe('Produksi: tidak ada referensi fitur demo', () => {
  it('tidak ada file src/ yang mengimpor dummy-data atau DEMO_LOGIN_ACCOUNTS', () => {
    const offenders = walk(join(process.cwd(), 'src')).filter((f) => {
      const t = readFileSync(f, 'utf8');
      return /dummy-data|DEMO_LOGIN_ACCOUNTS/.test(t);
    });
    expect(offenders).toEqual([]);
  });
});
