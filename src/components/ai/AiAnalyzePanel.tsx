'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, RefreshCw, Loader2, Info } from 'lucide-react';
import { renderRichText } from './RichText';

export default function AiAnalyzePanel({
  feature,
  judulMenu,
}: {
  feature: string;
  /** Nama menu yang sedang dibuka, agar analisis menyebut konteksnya. */
  judulMenu?: string;
}) {
  const [insight, setInsight] = useState<string>('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  // `konteks` menentukan data apa yang dirakit server. Bila menu yang dibuka
  // tidak punya konteks khusus, pakai konteks umum HR agar tetap ada analisis.
  const konteks = feature || 'hr';

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: konteks, menu: judulMenu ?? null }),
      });
      const json = await res.json().catch(() => null);
      setInsight(json?.data?.insight ?? 'Tidak ada keluaran dari model.');
      setConfigured(json?.data ? !!json.data.configured : false);
    } catch {
      setInsight('Maaf, gagal menghubungi layanan AI.');
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }, [konteks, judulMenu]);

  useEffect(() => { run(); }, [run]);

  return (
    <div className="mt-4 rounded-xl border border-[#007a5a]/30 bg-[#f0fdf9] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#007a5a]" />
          <p className="text-xs font-bold text-[#007a5a]">
            Rekomendasi AI{judulMenu ? ` — ${judulMenu}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-[#007a5a]/40 px-2.5 py-1 text-[11px] font-semibold text-[#007a5a] hover:bg-[#007a5a]/10 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Analisis ulang
        </button>
      </div>

      <div className="mt-3 text-xs leading-relaxed text-[#334155] whitespace-pre-wrap">
        {loading ? (
          <span className="inline-flex items-center gap-2 text-[#64748b]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Menganalisis data…
          </span>
        ) : configured === false ? (
          <span className="inline-flex items-start gap-2 text-[#92400e]">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{insight}</span>
          </span>
        ) : (
          renderRichText(insight)
        )}
      </div>
    </div>
  );
}
