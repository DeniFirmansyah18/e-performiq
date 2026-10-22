import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { runSeed } from '@/lib/db/seed';
import { getDb } from '@/lib/db/client';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { GET as getConversations, POST as postConversation } from '@/app/api/v1/conversations/route';
import { GET as getMessages, POST as postMessage } from '@/app/api/v1/conversations/[id]/messages/route';

const HR_USER = 'e0000000-0000-4000-8000-000000000001';
const MGR_USER = 'e0000000-0000-4000-8000-000000000002';
const EMP_USER = 'e0000000-0000-4000-8000-000000000004';

const jsonReq = (path: string, method: string, body: unknown, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers({ 'Content-Type': 'application/json', cookie }),
    body: JSON.stringify(body),
  });
const getReq = (path: string, cookie: string) =>
  new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: new Headers({ cookie }) });

describe('chat pimpinan', () => {
  let mgrCookie = '';
  let empCookie = '';
  let hrCookie = '';
  let outsiderCookie = '';
  let conversationId = '';

  beforeAll(async () => {
    const client = await getDb();
    await runSeed(client);

    const stamp = Date.now();
    const outsider = await client.query<{ id: string }>(
      `INSERT INTO employees (id, employee_code, full_name, email, department_id, position_id, status, base_salary, join_date)
       VALUES (gen_random_uuid(), $1, 'Bukan Anggota', $2,
               'a0000000-0000-4000-8000-000000000101'::uuid, 'a0000000-0000-4000-8000-000000000204'::uuid,
               'PERMANENT', 8000000, CURRENT_DATE)
       RETURNING id`,
      [`CHAT-${stamp}`, `chat.${stamp}@eperformiq.co.id`],
    );

    mgrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: MGR_USER, employeeId: 'b0000000-0000-4000-8000-000000000002', role: 'PEOPLE_MANAGER', email: 'mgr@eperformiq.co.id' })}`;
    empCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: EMP_USER, employeeId: 'b0000000-0000-4000-8000-000000000004', role: 'EMPLOYEE', email: 'budi@eperformiq.co.id' })}`;
    hrCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: HR_USER, employeeId: 'b0000000-0000-4000-8000-000000000001', role: 'HR_MANAGER', email: 'hr@eperformiq.co.id' })}`;
    outsiderCookie = `${SESSION_COOKIE_NAME}=${await signSession({ userId: randomUUID(), employeeId: outsider.rows[0].id, role: 'EMPLOYEE', email: `chat.${stamp}@eperformiq.co.id` })}`;
  });

  it('membuat percakapan langsung', async () => {
    const res = await postConversation(jsonReq('/api/v1/conversations', 'POST', {
      type: 'DIRECT', memberIds: [EMP_USER],
    }, mgrCookie));
    expect(res.status).toBe(200);
    conversationId = (await res.json()).data.id;
  });

  it('percakapan langsung dengan tiga anggota ditolak', async () => {
    const res = await postConversation(jsonReq('/api/v1/conversations', 'POST', {
      type: 'DIRECT', memberIds: [EMP_USER, HR_USER],
    }, mgrCookie));
    expect(res.status).toBe(422);
  });

  it('anggota dapat mengirim dan membaca pesan', async () => {
    const sent = await postMessage(
      jsonReq(`/api/v1/conversations/${conversationId}/messages`, 'POST', { body: 'Tolong siapkan laporan' }, mgrCookie),
      { params: { id: conversationId } } as any,
    );
    expect(sent.status).toBe(200);

    const read = await getMessages(
      getReq(`/api/v1/conversations/${conversationId}/messages`, empCookie),
      { params: { id: conversationId } } as any,
    );
    expect(read.status).toBe(200);
    expect((await read.json()).data.items[0].body).toBe('Tolong siapkan laporan');
  });

  it('non-anggota ditolak 403, bukan daftar kosong', async () => {
    const res = await getMessages(
      getReq(`/api/v1/conversations/${conversationId}/messages`, outsiderCookie),
      { params: { id: conversationId } } as any,
    );
    expect(res.status).toBe(403);
  });

  it('non-anggota tidak boleh mengirim pesan', async () => {
    const res = await postMessage(
      jsonReq(`/api/v1/conversations/${conversationId}/messages`, 'POST', { body: 'menyusup' }, outsiderCookie),
      { params: { id: conversationId } } as any,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('menolak lampiran dengan ekstensi berbahaya', async () => {
    const res = await postMessage(
      jsonReq(`/api/v1/conversations/${conversationId}/messages`, 'POST', {
        body: 'ini file', attachmentUrl: 'https://files.example.com/payload.exe',
      }, mgrCookie),
      { params: { id: conversationId } } as any,
    );
    expect(res.status).toBe(400);
  });

  it('pesan kosong ditolak', async () => {
    const res = await postMessage(
      jsonReq(`/api/v1/conversations/${conversationId}/messages`, 'POST', { body: '   ' }, mgrCookie),
      { params: { id: conversationId } } as any,
    );
    expect(res.status).toBe(400);
  });

  it('daftar percakapan menghitung pesan belum dibaca', async () => {
    // Karyawan sudah membaca pesan sebelumnya; kirim pesan baru agar ada yang belum dibaca.
    await postMessage(
      jsonReq(`/api/v1/conversations/${conversationId}/messages`, 'POST', { body: 'Mohon konfirmasi' }, mgrCookie),
      { params: { id: conversationId } } as any,
    );

    const res = await getConversations(getReq('/api/v1/conversations', empCookie));
    expect(res.status).toBe(200);
    const row = (await res.json()).data.items.find((c: any) => c.id === conversationId);
    expect(row.unreadCount).toBeGreaterThanOrEqual(1);
  });

  it('membaca pesan menandai sudah dibaca', async () => {
    await getMessages(
      getReq(`/api/v1/conversations/${conversationId}/messages`, empCookie),
      { params: { id: conversationId } } as any,
    );

    const res = await getConversations(getReq('/api/v1/conversations', empCookie));
    const row = (await res.json()).data.items.find((c: any) => c.id === conversationId);
    expect(row.unreadCount).toBe(0);
  });
});
