import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import { BusinessRuleError } from '@/lib/auth/errors';

export function ok<T>(data: T, initOrMessage?: ResponseInit | string): NextResponse {
  if (typeof initOrMessage === 'string') {
    return NextResponse.json({ status: 'success', data, message: initOrMessage });
  }
  return NextResponse.json({ status: 'success', data }, initOrMessage);
}

export function fail(code: string, message: string, status: number = 400): NextResponse {
  return NextResponse.json({ status: 'error', code, detail: message, message }, { status });
}

const TYPE_SLUG: Record<number, string> = {
  400: 'bad-request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  409: 'immutable-record',
  422: 'business-rule-violation',
  500: 'internal-error',
};

/**
 * Memetakan error domain ke RFC 7807. Error tak dikenal menjadi 500
 * TANPA membocorkan pesan internal ke klien.
 */
export function problem(error: unknown, instance: string): NextResponse {
  const isDomain =
    error instanceof Error &&
    typeof (error as { status?: unknown }).status === 'number';

  const status = isDomain ? (error as unknown as { status: number }).status : 500;
  const title = isDomain
    ? (error as unknown as { title: string }).title
    : 'Internal Server Error';
  const detail = isDomain
    ? (error as Error).message
    : 'Terjadi kesalahan internal pada server. Silakan coba kembali.';

  if (!isDomain) {
    console.error(`[${instance}]`, error);
  }

  return NextResponse.json(
    {
      type: `https://api.e-performiq.com/errors/${TYPE_SLUG[status] ?? 'error'}`,
      title,
      status,
      detail,
      instance,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new BusinessRuleError('Body request bukan JSON yang valid.');
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new BusinessRuleError(`Input tidak valid — ${detail}`);
  }
  return parsed.data;
}
