import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const login = readFileSync(resolve(process.cwd(), 'src/app/login/page.tsx'), 'utf8');
const root = readFileSync(resolve(process.cwd(), 'src/app/page.tsx'), 'utf8');

describe('super admin punya beranda yang sah', () => {
  it('login mengarahkan SUPER_ADMIN ke panel akun', () => {
    const blok = login.slice(login.indexOf('function dashboardForRole'), login.indexOf('export default function LoginPage'));
    expect(blok).toMatch(/SUPER_ADMIN[\s\S]{0,60}account-management/);
  });

  it('halaman root mengarahkan SUPER_ADMIN ke panel akun', () => {
    expect(root).toMatch(/SUPER_ADMIN[\s\S]{0,120}account-management/);
  });
});
