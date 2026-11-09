import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mw = readFileSync(resolve(process.cwd(), 'src/middleware.ts'), 'utf8');
const nav = readFileSync(resolve(process.cwd(), 'src/components/navigation/NavMenu.tsx'), 'utf8');

describe('super admin hanya panel akun', () => {
  it('beranda super admin adalah panel akun', () => {
    // Blok homeForRole harus memetakan SUPER_ADMIN ke account-management.
    const blok = mw.slice(mw.indexOf('function homeForRole'), mw.indexOf('export async function middleware'));
    expect(blok).toMatch(/case 'SUPER_ADMIN':[\s\S]{0,120}account-management/);
  });

  it('menu super admin hanya Manajemen Akun', () => {
    const barisSuperAdmin = nav
      .split('\n')
      .filter((l) => l.includes("'SUPER_ADMIN'") && l.includes('name:'));
    expect(barisSuperAdmin).toHaveLength(1);
    expect(barisSuperAdmin[0]).toContain('Manajemen Akun');
  });

  it('middleware mengalihkan super admin yang membuka dashboard lain', () => {
    expect(mw).toMatch(/SUPER_ADMIN[\s\S]{0,160}account-management/);
    expect(mw).toContain("pathname !== '/dashboard/account-management'");
  });
});
