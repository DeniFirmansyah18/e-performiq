import { describe, it, expect } from 'vitest';
import {
  AuthError, ForbiddenError, NotFoundError,
  ImmutableRecordError, BusinessRuleError,
} from '@/lib/auth/errors';

describe('kelas error domain', () => {
  it('memetakan setiap kelas ke kode status yang benar', () => {
    expect(new AuthError().status).toBe(401);
    expect(new ForbiddenError().status).toBe(403);
    expect(new NotFoundError().status).toBe(404);
    expect(new ImmutableRecordError('x').status).toBe(409);
    expect(new BusinessRuleError('x').status).toBe(422);
  });

  it('mempertahankan pesan kustom', () => {
    expect(new BusinessRuleError('Total bobot 110% melebihi 100%').message)
      .toBe('Total bobot 110% melebihi 100%');
  });

  it('merupakan instanceof Error', () => {
    expect(new ForbiddenError()).toBeInstanceOf(Error);
  });
});
