import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const p = (rel: string) => resolve(root, rel);

describe('modul audit dihapus', () => {
  it('halaman & endpoint audit tidak ada lagi', () => {
    expect(existsSync(p('src/app/dashboard/audit-governance/page.tsx'))).toBe(false);
    expect(existsSync(p('src/app/api/v1/governance/audit-logs/route.ts'))).toBe(false);
    expect(existsSync(p('src/app/api/v1/audit/integrity/route.ts'))).toBe(false);
  });

  it('middleware tidak lagi memetakan audit-governance', () => {
    const mw = readFileSync(p('src/middleware.ts'), 'utf8');
    expect(mw).not.toContain('audit-governance');
  });

  it('insertAuditLog tetap ada (dipakai login/profil)', () => {
    expect(existsSync(p('src/lib/services/auditService.ts'))).toBe(true);
    const svc = readFileSync(p('src/lib/services/auditService.ts'), 'utf8');
    expect(svc).toContain('insertAuditLog');
  });

  it('menu tidak lagi memuat GCG Audit & Compliance', () => {
    const nav = readFileSync(p('src/components/navigation/NavMenu.tsx'), 'utf8');
    expect(nav).not.toContain('GCG Audit & Compliance');
  });
});
