import { describe, it, expect } from 'vitest';
import { queryPolicyChatbotEngine } from '@/lib/services/helpdeskChatbotService';

describe('Kotak 6: Helpdesk & Policy Chatbot Engine', () => {
  it('menjawab pertanyaan tentang sisa cuti dan prosedur reimbursement secara otomatis', () => {
    const res = queryPolicyChatbotEngine('Berapa lama batas pengajuan klaim biaya kacamata?');
    expect(res.answer).toContain('klaim');
    expect(res.sourceRef).toContain('SOP');
  });

  it('menjawab pertanyaan seputar batas pesangon PP 35/2021', () => {
    const res = queryPolicyChatbotEngine('Bagaimana cara hitung pesangon PHK pensiun?');
    expect(res.answer).toContain('PP No. 35/2021');
  });
});
