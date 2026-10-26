'use client';
import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

export default function BoardAiInsight({ periodCode }: { periodCode?: string }) {
  const [insight, setInsight] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ provider: string | null; generatedAt: string | null; fromCache: boolean } | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (force: boolean) => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/ai/board-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodCode, force }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.detail ?? json?.message ?? 'Gagal menjalankan analisis');
      }
      setInsight(json?.data?.insight ?? 'Tidak ada keluaran dari model.');
      setConfigured(json?.data?.configured ?? false);
      setMeta({
        provider: json?.data?.provider ?? null,
        generatedAt: json?.data?.generatedAt ?? null,
        fromCache: json?.data?.fromCache ?? false,
      });
    } catch (err) {
      setInsight((err as Error).message);
      setConfigured(false);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-indigo-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-semibold text-slate-800">Analisis AI Boardroom</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => run(false)}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Analisis AI'}
          </button>
          {insight && (
            <button
              onClick={() => run(true)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 text-[11px] font-semibold disabled:opacity-50"
            >
              Analisis ulang
            </button>
          )}
        </div>
      </div>

      {loading && (
        <p className="text-[11px] text-slate-500 inline-flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menganalisis data…
        </p>
      )}

      {!loading && insight && (
        <>
          {configured === false && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Analisis AI belum tersedia karena kunci provider belum dikonfigurasi.
            </p>
          )}
          <p className="text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap">{insight}</p>
          {meta?.generatedAt && (
            <p className="text-[10px] text-slate-400">
              {meta.fromCache ? 'Dari cache' : 'Baru dibuat'} &bull; {meta.provider ?? '-'} &bull;{' '}
              {String(meta.generatedAt).slice(0, 19).replace('T', ' ')}
            </p>
          )}
        </>
      )}

      {!loading && !insight && (
        <p className="text-[11px] text-slate-500">
          Tekan &ldquo;Analisis AI&rdquo; untuk merangkum capaian pilar, RJMP, kesesuaian posisi,
          dan aktivitas. Gaji serta data BPJS tidak pernah dikirim ke model.
        </p>
      )}
    </div>
  );
}
