import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ok, problem, parseBody } from '@/lib/api/response';
import { BusinessRuleError, NotFoundError } from '@/lib/auth/errors';

describe('envelope response', () => {
  it('membungkus sukses dalam { status, data }', async () => {
    const res = ok({ nilai: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'success', data: { nilai: 1 } });
  });

  it('menghormati status kustom', () => {
    expect(ok({}, { status: 201 }).status).toBe(201);
  });

  it('memetakan error domain ke RFC 7807', async () => {
    const res = problem(new NotFoundError('KPI tidak ditemukan'), '/api/v1/uji');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({
      title: 'Not Found',
      status: 404,
      detail: 'KPI tidak ditemukan',
      instance: '/api/v1/uji',
    });
    expect(body.type).toContain('not-found');
    expect(typeof body.timestamp).toBe('string');
  });

  it('memetakan error tak dikenal menjadi 500 tanpa membocorkan pesan internal', async () => {
    const res = problem(new Error('rahasia database'), '/api/v1/uji');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('rahasia database');
  });

  it('parseBody mengembalikan data valid', async () => {
    const schema = z.object({ nama: z.string() });
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ nama: 'Budi' }),
    });
    expect(await parseBody(req, schema)).toEqual({ nama: 'Budi' });
  });

  it('parseBody melempar BusinessRuleError 422 untuk data tidak valid', async () => {
    const schema = z.object({ nama: z.string().min(1) });
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ nama: '' }),
    });
    await expect(parseBody(req, schema)).rejects.toThrow(BusinessRuleError);
  });

  it('parseBody menyebut nama field yang bermasalah', async () => {
    const schema = z.object({ kpi_weight: z.number().max(100) });
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ kpi_weight: 150 }),
    });
    await expect(parseBody(req, schema)).rejects.toThrow(/kpi_weight/);
  });
});
