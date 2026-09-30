import { describe, it, expect } from 'vitest';
import { requireRole } from '@/lib/auth/requireRole';
import { ForbiddenError } from '@/lib/auth/errors';

describe('requireRole', () => {
  it('lolos bila role termasuk dalam daftar yang diizinkan', () => {
    expect(() => requireRole('BOD', ['BOD', 'HR_MANAGER'])).not.toThrow();
  });

  it('melempar ForbiddenError bila role tidak diizinkan', () => {
    expect(() => requireRole('EMPLOYEE', ['BOD', 'HR_MANAGER'])).toThrow(ForbiddenError);
  });
});
