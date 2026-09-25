import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/response';
import { queryPolicyChatbotEngine } from '@/lib/services/helpdeskChatbotService';
import { z } from 'zod';

const ChatSchema = z.object({
  question: z.string().min(3),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ChatSchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Pertanyaan tidak valid', 400);
    }

    const reply = queryPolicyChatbotEngine(parsed.data.question);
    return ok(reply, 'Jawaban chatbot berhasil didapatkan.');
  } catch (err: any) {
    return fail('INTERNAL_ERROR', err?.message ?? 'Gagal memproses chatbot', 500);
  }
}
