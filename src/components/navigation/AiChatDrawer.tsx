'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';

type Msg = { role: 'user' | 'model'; content: string };

const SUGGESTIONS = [
  'Bagaimana kondisi kinerja perusahaan periode ini?',
  'Siapa karyawan dengan flight risk tertinggi?',
  'Ringkas progres pembelajaran dan sertifikasi.',
];

export default function AiChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/v1/ai/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setConfigured(!!j.data.configured); })
      .catch(() => setConfigured(false));
  }, [open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const json = await res.json().catch(() => null);
      const reply: string =
        json?.data?.reply ?? 'Maaf, terjadi kendala saat menghubungi asisten AI.';
      if (json?.data) setConfigured(!!json.data.configured);
      setMessages((m) => [...m, { role: 'model', content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: 'model', content: 'Maaf, gagal menghubungi layanan AI.' }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-[61] h-full w-full sm:w-[420px] bg-white border-l border-[#e2e8f0] shadow-2xl flex flex-col animate-slideIn">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-[#e2e8f0] bg-[#0d131f]">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#007a5a]">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">Asisten AI E-PerformIQ</p>
              <p className="text-[10px] text-slate-400">Analisis berbasis data aplikasi</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8fafc]">
          {configured === false && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              AI belum dikonfigurasi. Set <code className="font-mono">GEMINI_API_KEY</code> pada
              environment server untuk mengaktifkan analisis AI.
            </div>
          )}

          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-xs text-[#64748b]">Mulai dengan salah satu pertanyaan berikut:</p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full text-left rounded-xl border border-[#e2e8f0] bg-white p-3 text-xs font-medium text-[#334155] hover:border-[#007a5a] hover:bg-[#f0fdf9] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#007a5a] text-white rounded-br-sm'
                    : 'bg-white border border-[#e2e8f0] text-[#0f172a] rounded-bl-sm'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-white border border-[#e2e8f0] px-3.5 py-2.5 text-xs text-[#64748b]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Menganalisis…
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="border-t border-[#e2e8f0] p-3 flex items-end gap-2 bg-white"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            rows={1}
            placeholder="Tanya apa saja tentang data SDM & kinerja…"
            className="flex-1 resize-none rounded-xl border border-[#e2e8f0] px-3 py-2 text-xs text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#007a5a] max-h-28"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#007a5a] text-white disabled:opacity-40 hover:bg-[#00664b] transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </aside>
    </>
  );
}
