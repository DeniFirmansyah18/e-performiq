'use client';

import React, { useState } from 'react';
import { Bot, Send, X, ShieldAlert, Sparkles, MessageSquare } from 'lucide-react';

interface HelpdeskChatbotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpdeskChatbotDrawer({ isOpen, onClose }: HelpdeskChatbotDrawerProps) {
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; source?: string }>>([
    {
      sender: 'bot',
      text: 'Halo! Saya Asisten HR Virtual E-PerformIQ. Ada yang bisa saya bantu seputar Peraturan Perusahaan, cuti, klaim, atau alur kerja penilaian?',
      source: 'Basis Pengetahuan SOP & Regulasi',
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isLoading) return;

    const userQ = inputVal;
    setInputVal('');
    setMessages((prev) => [...prev, { sender: 'user', text: userQ }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/governance/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQ }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: json.data.answer,
            source: json.data.sourceRef,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'bot',
            text: 'Maaf, terjadi kendala saat memproses pertanyaan Anda.',
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Maaf, server chatbot sedang sibuk.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-600 text-white">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Asisten HR &amp; SOP 24/7</h3>
            <p className="text-[10px] text-slate-400">Kotak 6: Employee Voice &amp; Knowledge Base</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-none'
                  : 'bg-white border border-slate-200 text-slate-800 shadow-2xs rounded-bl-none'
              }`}
            >
              <p>{m.text}</p>
              {m.source && (
                <span className="block mt-1.5 text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                  Rujukan: {m.source}
                </span>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="text-left">
            <div className="p-3 bg-white border border-slate-200 rounded-2xl text-xs text-slate-500 inline-flex items-center gap-1.5">
              <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-600"></span>
              Menelusuri Peraturan Perusahaan...
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
          placeholder="Tanyakan cuti, klaim, pesangon, dll..."
          className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
        />
        <button
          type="submit"
          disabled={!inputVal.trim() || isLoading}
          className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl cursor-pointer"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
