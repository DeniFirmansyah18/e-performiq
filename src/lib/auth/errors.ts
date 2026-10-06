export class AuthError extends Error {
  status = 401;
  title = 'Unauthorized';
  constructor(message = 'Sesi tidak valid atau telah berakhir.') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends Error {
  status = 403;
  title = 'Forbidden';
  constructor(message = 'Anda tidak memiliki otorisasi untuk tindakan ini.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  status = 404;
  title = 'Not Found';
  constructor(message = 'Data tidak ditemukan.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** 409: konflik state (mis. mencoba mengulang tes yang sudah selesai). */
export class ConflictError extends Error {
  status = 409;
  title = 'Conflict';
  constructor(message = 'Sumber daya berada dalam konflik dengan permintaan.') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ImmutableRecordError extends Error {
  status = 409;
  title = 'Immutable Appraisal Record';
  constructor(message: string) {
    super(message);
    this.name = 'ImmutableRecordError';
  }
}

/** 422: sintaks valid, aturan bisnis dilanggar. */
export class BusinessRuleError extends Error {
  status = 422;
  title = 'Business Rule Violation';
  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}
