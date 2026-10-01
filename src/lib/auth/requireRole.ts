import { ForbiddenError } from '@/lib/auth/errors';
import type { UserRole } from '@/types';

/**
 * Menegakkan otorisasi role di server (Task 10).
 * Melempar ForbiddenError bila role tidak termasuk daftar yang diizinkan.
 */
export function requireRole(role: UserRole, allowed: readonly UserRole[]): void {
  if (!allowed.includes(role)) {
    throw new ForbiddenError('Role tidak berhak mengakses halaman ini.');
  }
}
