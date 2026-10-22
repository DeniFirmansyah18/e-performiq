'use client';

import { useState } from 'react';
import { Bot, Send } from 'lucide-react';

export default function PerformanceCoachPanel() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    if (question.trim().length < 5) { setError('Pertanyaan minimal 5 karakter.'); return; }
    setBusy(true);
    setError(null);
    setAnswer(null);
    const res = await fetch('/api/v1/ai/performance-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json?.detail ?? 'Gagal memproses pertanyaan.'); return; }
    setAnswer(json.data.reply);
    setSources(json.data.sources ?? []);
  };

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-[#0f172a]">
        <Bot className="h-4 w-4 text-[#007a5a]" aria-hidden="true" /> Tanya Performa Anda
      </h2>
      <p className="mt-0.5 text-[11px] text-[#64748b]">
        Jawaban memakai data KPI, status harian, kehadiran, cuti, dan pelatihan Anda.
        Gaji dan BPJS tidak termasuk.
      </p>

      <label className="mt-3 block text-xs font-semibold text-[#475569]" htmlFor="coach-question">
        Pertanyaan tentang performa
      </label>
      <textarea
        id="coach-question"
        rows={2}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Contoh: kenapa status saya merah kemarin?"
        className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-sm text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
      />

      <button
        type="button"
        disabled={busy}
        onClick={ask}
        className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#007a5a] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2 disabled:opacity-50"
      >
        <Send className="h-3 w-3" aria-hidden="true" /> Tanya
      </button>

      {error && <p className="mt-2 text-xs font-semibold text-[#b91c1c]">{error}</p>}

      {answer && (
        <div className="mt-3 rounded-xl bg-[#f8fafc] p-3">
          <p className="whitespace-pre-line text-xs leading-relaxed text-[#0f172a]">{answer}</p>
          {sources.length > 0 && (
            <p className="mt-2 text-[11px] text-[#64748b]">Sumber: {sources.join(', ')}</p>
          )}
        </div>
      )}
    </section>
  );
}
