import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { BusinessRuleError } from '@/lib/auth/errors';

export interface ConversationRow {
  id: string;
  conversationType: 'DIRECT' | 'GROUP';
  title: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  attachmentUrl: string | null;
  isRecalled: boolean;
  sentAt: string;
}

const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png'];

/** Validasi sebelum simpan: ekstensi diizinkan. Bukan pemindai antivirus. */
function assertSafeAttachment(url: string): void {
  const path = url.split('?')[0].toLowerCase();
  if (!ALLOWED_EXT.some((ext) => path.endsWith(ext))) {
    throw new BusinessRuleError('Lampiran harus PDF, JPG, atau PNG.');
  }
}

export async function createConversation(
  db: Db,
  input: { type: 'DIRECT' | 'GROUP'; title?: string; memberIds: string[]; createdBy: string },
): Promise<ConversationRow> {
  const members = Array.from(new Set([input.createdBy, ...input.memberIds]));
  if (members.length < 2) {
    throw new BusinessRuleError('Percakapan membutuhkan minimal dua anggota.');
  }
  if (input.type === 'DIRECT' && members.length !== 2) {
    throw new BusinessRuleError('Percakapan langsung hanya untuk dua orang.');
  }

  const conv = (await db.execute(sql`
    INSERT INTO conversations (conversation_type, title, created_by)
    VALUES (${input.type}, ${input.title ?? null}, ${input.createdBy}::uuid)
    RETURNING id, conversation_type AS "conversationType", title,
              NULL::timestamptz AS "lastMessageAt", 0::int AS "unreadCount"
  `)) as unknown as { rows: ConversationRow[] };
  const row = conv.rows[0];

  for (const memberId of members) {
    await db.execute(sql`
      INSERT INTO conversation_members (conversation_id, user_id)
      VALUES (${row.id}::uuid, ${memberId}::uuid)
      ON CONFLICT DO NOTHING
    `);
  }
  return row;
}

export async function listConversations(db: Db, userId: string): Promise<ConversationRow[]> {
  const res = (await db.execute(sql`
    SELECT c.id, c.conversation_type AS "conversationType", c.title,
           (SELECT max(m.sent_at) FROM messages m WHERE m.conversation_id = c.id) AS "lastMessageAt",
           (SELECT count(*)::int FROM messages m
             WHERE m.conversation_id = c.id
               AND m.sender_id <> ${userId}::uuid
               AND (cm.last_read_at IS NULL OR m.sent_at > cm.last_read_at)) AS "unreadCount"
      FROM conversations c
      JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ${userId}::uuid
     ORDER BY 4 DESC NULLS LAST
  `)) as unknown as { rows: ConversationRow[] };
  return res.rows ?? [];
}

async function assertMember(db: Db, conversationId: string, userId: string): Promise<void> {
  const res = (await db.execute(sql`
    SELECT 1 FROM conversation_members
     WHERE conversation_id = ${conversationId}::uuid AND user_id = ${userId}::uuid
  `)) as unknown as { rows: unknown[] };
  if (!res.rows?.length) {
    throw new BusinessRuleError('Anda bukan anggota percakapan ini.');
  }
}

export async function listMessages(
  db: Db,
  input: { conversationId: string; userId: string; limit?: number },
): Promise<MessageRow[]> {
  await assertMember(db, input.conversationId, input.userId);

  const res = (await db.execute(sql`
    SELECT id, conversation_id AS "conversationId", sender_id AS "senderId",
           CASE WHEN is_recalled THEN 'Pesan ditarik' ELSE body END AS body,
           CASE WHEN is_recalled THEN NULL ELSE attachment_url END AS "attachmentUrl",
           is_recalled AS "isRecalled", sent_at AS "sentAt"
      FROM messages
     WHERE conversation_id = ${input.conversationId}::uuid
     ORDER BY sent_at DESC
     LIMIT ${input.limit ?? 50}
  `)) as unknown as { rows: MessageRow[] };

  await db.execute(sql`
    UPDATE conversation_members SET last_read_at = CURRENT_TIMESTAMP
     WHERE conversation_id = ${input.conversationId}::uuid AND user_id = ${input.userId}::uuid
  `);

  return res.rows ?? [];
}

export async function sendMessage(
  db: Db,
  input: { conversationId: string; senderId: string; body: string; attachmentUrl?: string },
): Promise<MessageRow> {
  await assertMember(db, input.conversationId, input.senderId);
  if (input.body.trim().length === 0) {
    throw new BusinessRuleError('Pesan tidak boleh kosong.');
  }
  if (input.attachmentUrl) assertSafeAttachment(input.attachmentUrl);

  const res = (await db.execute(sql`
    INSERT INTO messages (conversation_id, sender_id, body, attachment_url)
    VALUES (${input.conversationId}::uuid, ${input.senderId}::uuid,
            ${input.body}, ${input.attachmentUrl ?? null})
    RETURNING id, conversation_id AS "conversationId", sender_id AS "senderId",
              body, attachment_url AS "attachmentUrl", is_recalled AS "isRecalled",
              sent_at AS "sentAt"
  `)) as unknown as { rows: MessageRow[] };
  return res.rows[0];
}

export async function recallMessage(
  db: Db,
  input: { messageId: string; userId: string },
): Promise<MessageRow> {
  const res = (await db.execute(sql`
    UPDATE messages
       SET is_recalled = TRUE, attachment_url = NULL
     WHERE id = ${input.messageId}::uuid AND sender_id = ${input.userId}::uuid
    RETURNING id, conversation_id AS "conversationId", sender_id AS "senderId",
              body, attachment_url AS "attachmentUrl", is_recalled AS "isRecalled",
              sent_at AS "sentAt"
  `)) as unknown as { rows: MessageRow[] };

  const row = res.rows?.[0];
  if (!row) throw new BusinessRuleError('Pesan tidak ditemukan atau bukan milik Anda.');
  return row;
}
