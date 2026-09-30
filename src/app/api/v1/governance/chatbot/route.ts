import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { getAuthSession } from '@/lib/auth/getAuthSession';
import { ok, fail, problem } from '@/lib/api/response';
import { queryPolicyChatbotEngine } from '@/lib/services/helpdeskChatbotService';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ChatSchema = z.object({
  question: z.string().min(3),
});

export async function POST(req: NextRequest) {
  try {
    // Task 9: chatbot wajib terautentikasi; employeeId diambil dari sesi, bukan body.
    const session = await getAuthSession(req);
    if (!session.employeeId) {
      return fail('FORBIDDEN', 'Sesi tidak terkait dengan karyawan.', 403);
    }

    const body = await req.json();
    const parsed = ChatSchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Pertanyaan tidak valid', 400);
    }

    const reply = await queryPolicyChatbotEngine(db, parsed.data.question, session.employeeId);
    return ok(reply, 'Jawaban chatbot berhasil didapatkan.');
  } catch (err) {
    return problem(err, '/api/v1/governance/chatbot');
  }
}
