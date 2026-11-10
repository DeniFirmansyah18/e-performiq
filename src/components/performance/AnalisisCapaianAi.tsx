'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Bantuan analisis AI untuk capaian target.
 *
 * Sengaja memakai tombol, bukan memuat otomatis: setiap panggilan AI memakai
 * kuota dan biaya, sedangkan hasilnya tidak berubah selama data sama.
 */
export default function AnalisisCapaianAi({ periodId }: { periodId?: string }) {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [catatan, setCatatan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mintaAnalisis = async () => {
    setLoading(true);
    setError(null);
    setCatatan(null);
    try {
      const q = periodId ? `?period_id=${encodeURIComponent(periodId)}` : '';
      const res = await fetch(`/api/v1/performance/target-achievement/analisis${q}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.detail ?? 'Gagal memuat analisis AI.');
        return;
      }
      setInsight(json?.data?.insight ?? null);
      if (json?.data && json.data.configured === false) {
        setCatatan('Analisis AI belum aktif karena kunci API belum diatur di server.');
      } else if (json?.data?.failed) {
        setCatatan('Analisis AI sedang tidak tersedia. Coba lagi beberapa saat lagi.');
      }
    } catch {
      setError('Gagal menghubungi layanan analisis.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#c7e7d3] bg-[#f6fdf9] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-[#0f172a] flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#007a5a]" />
          Rekomendasi Tindakan dari AI
        </p>
        <button
          type="button"
          onClick={mintaAnalisis}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#007a5a] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#00684a] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Menganalisis…
            </>
          ) : insight ? (
            <>
              <RefreshCw className="h-3 w-3" /> Perbarui analisis
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" /> Minta analisis
            </>
          )}
        </button>
      </div>

      {!insight && !loading && !error && (
        <p className="text-[11px] text-[#64748b] leading-relaxed">
          AI akan menandai departemen yang capaiannya paling rendah dan menyarankan tindakan yang
          bisa dilakukan HRD.
        </p>
      )}

      {error && (
        <p role="alert" className="text-[11px] font-semibold text-[#c5221f] flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      {insight && (
        <div className="text-[11px] text-[#334155] leading-relaxed whitespace-pre-wrap">{insight}</div>
      )}

      {catatan && <p className="text-[10px] text-[#92400e]">{catatan}</p>}
    </div>
  );
}
