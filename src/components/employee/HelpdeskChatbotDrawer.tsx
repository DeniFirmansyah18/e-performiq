'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Send, X, Sparkles, User, ChevronRight } from 'lucide-react';

interface HelpdeskChatbotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  source?: string;
}

const SOURCE_LABEL: Record<string, string> = {
  AI: 'Analisis AI · Basis Kebijakan',
  POLICY: 'Basis Pengetahuan SOP & Regulasi',
  DATA: 'Data Kepegawaian Anda',
  FALLBACK: 'Bantuan Human Capital',
};

const SUGGESTIONS = [
  'Bagaimana alur pengajuan cuti tahunan?',
  'Berapa saldo cuti saya?',
  'Apa kebijakan lembur perusahaan?',
  'Bagaimana prosedur whistleblowing?',
];

export default function HelpdeskChatbotDrawer({ isOpen, onClose }: HelpdeskChatbotDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'bot',
      text: 'Halo! Saya Asisten HR Virtual E-PerformIQ. Ada yang bisa saya bantu seputar Peraturan Perusahaan, cuti, klaim, atau alur kerja penilaian?',
      source: 'POLICY',
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const ask = async (userQ: string) => {
    if (!userQ.trim() || isLoading) return;
    setInputVal('');
    setMessages((prev) => [...prev, { sender: 'user', text: userQ }]);
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/governance/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQ }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessages((prev) => [...prev, { sender: 'bot', text: json.data.answer, source: json.data.source }]);
      } else {
        setMessages((prev) => [...prev, { sender: 'bot', text: 'Maaf, terjadi kendala saat memproses pertanyaan Anda.', source: 'FALLBACK' }]);
      }
    } catch {
      setMessages((prev) => [...prev, { sender: 'bot', text: 'Maaf, server chatbot sedang sibuk.', source: 'FALLBACK' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    void ask(inputVal);
  };

  const showSuggestions = messages.length <= 1 && !isLoading;
  // Portal ke <body> agar backdrop-blur menutupi SELURUH viewport, tidak
  // terpotong oleh ancestor ber-transform/overflow (kliping `fixed`).
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div className="w-full max-w-2xl h-[80vh] max-h-[720px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-[#0f172a] to-[#134e4a] text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/40 text-emerald-300">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight">Asisten HR &amp; SOP</h3>
            <p className="text-[10px] text-emerald-200/80 flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> Aktif 24/7 · Tata Kelola &amp; Kebijakan
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors" aria-label="Tutup">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Chat History */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.sender === 'bot' && (
              <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-emerald-600 text-white grid place-items-center">
                <Bot className="h-3.5 w-3.5" />
              </div>
            )}
            <div className="flex flex-col max-w-[82%]">
              <div
                className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                  m.sender === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-none'
                    : 'bg-white border border-slate-200 text-slate-800 shadow-sm rounded-bl-none'
                }`}
              >
                {m.text}
              </div>
              {m.source && m.sender === 'bot' && (
                <span className="mt-1 inline-flex w-fit items-center gap-1 text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                  <Sparkles className="h-2.5 w-2.5" />
                  {SOURCE_LABEL[m.source] ?? m.source}
                </span>
              )}
            </div>
            {m.sender === 'user' && (
              <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-slate-700 text-white grid place-items-center">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}

        {showSuggestions && (
          <div className="pt-2 space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Pertanyaan umum</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)}
                className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-700 hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors">
                {s}
                <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex gap-2">
            <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-emerald-600 text-white grid place-items-center">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl rounded-bl-none text-xs text-slate-500 inline-flex items-center gap-1.5">
              <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-600"></span>
              Menganalisis kebijakan &amp; data…
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Tanyakan cuti, klaim, pesangon, kebijakan…"
          className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
        />
        <button
          type="submit"
          disabled={!inputVal.trim() || isLoading}
          className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl cursor-pointer transition-colors"
          aria-label="Kirim"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
      </div>
    </div>,
    document.body
  );
}
