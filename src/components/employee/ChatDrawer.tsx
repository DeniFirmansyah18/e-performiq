'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';

interface Conversation {
  id: string;
  conversationType: 'DIRECT' | 'GROUP';
  title: string | null;
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  body: string;
  isRecalled: boolean;
  sentAt: string;
}

export default function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch('/api/v1/conversations');
    if (!res.ok) return;
    const json = await res.json();
    const items: Conversation[] = json?.data?.items ?? [];
    setConversations(items);
    setActiveId((current) => current ?? items[0]?.id ?? null);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const res = await fetch(`/api/v1/conversations/${conversationId}/messages`);
    if (!res.ok) { setMessages([]); return; }
    const json = await res.json();
    setMessages((json?.data?.items ?? []).slice().reverse());
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadConversations();
  }, [open, loadConversations]);

  useEffect(() => {
    if (open && activeId) void loadMessages(activeId);
  }, [open, activeId, loadMessages]);

  const send = async () => {
    if (!activeId || draft.trim().length === 0) return;
    setError(null);
    const res = await fetch(`/api/v1/conversations/${activeId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: draft }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json?.detail ?? 'Pesan gagal dikirim.'); return; }
    setDraft('');
    await loadMessages(activeId);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-labelledby="chat-title">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] p-4">
          <h2 id="chat-title" className="flex items-center gap-1.5 text-sm font-extrabold text-[#0f172a]">
            <MessageSquare className="h-4 w-4 text-[#007a5a]" aria-hidden="true" /> Chat Pimpinan
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 hover:bg-[#f1f5f9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]">
            <X className="h-4 w-4 text-[#475569]" />
          </button>
        </div>

        <div className="border-b border-[#e2e8f0] p-2">
          <ul className="flex gap-2 overflow-x-auto">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  aria-pressed={activeId === c.id}
                  className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] ${
                    activeId === c.id ? 'bg-[#007a5a] text-white' : 'bg-[#f1f5f9] text-[#475569]'
                  }`}
                >
                  {c.title ?? (c.conversationType === 'DIRECT' ? 'Percakapan langsung' : 'Grup')}
                  {c.unreadCount > 0 ? ` (${c.unreadCount})` : ''}
                </button>
              </li>
            ))}
            {conversations.length === 0 && (
              <li className="px-2 py-1 text-[11px] text-[#64748b]">Belum ada percakapan.</li>
            )}
          </ul>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {messages.map((m) => (
            <div key={m.id} className="rounded-xl bg-[#f8fafc] p-2.5">
              <p className="text-xs text-[#0f172a]">{m.body}</p>
              <p className="mt-1 text-[10px] text-[#94a3b8]">
                {new Date(m.sentAt).toLocaleString('id-ID')}
              </p>
            </div>
          ))}
          {activeId && messages.length === 0 && (
            <p className="text-xs text-[#64748b]">Belum ada pesan.</p>
          )}
        </div>

        <div className="border-t border-[#e2e8f0] p-3">
          <label htmlFor="chat-draft" className="text-[11px] font-semibold text-[#475569]">
            Tulis pesan
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="chat-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
              className="flex-1 rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-sm text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
            <button
              type="button"
              onClick={send}
              aria-label="Kirim pesan"
              className="rounded-lg bg-[#007a5a] p-2 text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {error && <p className="mt-1 text-[11px] font-semibold text-[#b91c1c]">{error}</p>}
          <p className="mt-2 text-[10px] text-[#94a3b8]">
            Chat tidak menggantikan disposisi resmi untuk keputusan yang mengikat.
          </p>
        </div>
      </div>
    </div>
  );
}
