'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, Loader2, CalendarClock } from 'lucide-react';
import { LABEL_SANKSI, type JenisSanksi } from '@/lib/services/disciplinaryPoints';

interface Sanksi {
  id: string;
  actionType: JenisSanksi;
  reason: string;
  effectiveDate: string;
  expiryDate: string | null;
  appealStatus: string;
  violationPoints?: number | null;
  violationCategory?: string | null;
}

interface Ringkasan {
  totalPoinAktif: number;
  jumlahSanksiAktif: number;
  ambangTerlampaui: { poin: number; label: string } | null;
  perKategori: Array<{ kategori: string; label: string; poin: number }>;
  berlakuSampai: string | null;
}

const APPEAL_LABEL: Record<string, string> = {
  NONE: 'Tidak ada keberatan',
  UNDER_APPEAL: 'Keberatan diproses',
  APPEAL_ACCEPTED: 'Keberatan diterima',
  APPEAL_REJECTED: 'Keberatan ditolak',
};

const tanggal = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Sudah lewat masa berlaku? */
function berakhir(s: Sanksi): boolean {
  if (!s.expiryDate) return false;
  const d = new Date(s.expiryDate);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

/**
 * "Sanksi & Pelanggaran" untuk pegawai.
 *
 * Menampilkan total poin pelanggaran yang masih berlaku, ambang yang sudah
 * terlewati, rekap per kategori, dan riwayat sanksi lengkap dengan masa
 * berlakunya. Data berasal dari endpoint /me/disciplinary-actions yang diinput
 * HR.
 */
export default function SanksiPelanggaranPanel() {
  const [items, setItems] = useState<Sanksi[]>([]);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/me/disciplinary-actions');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.detail || 'Gagal memuat data sanksi.'); return; }
      const d = json?.data;
      setItems(Array.isArray(d?.items) ? d.items : []);
      setRingkasan(d?.ringkasanPoin ?? null);
    } catch {
      setErr('Gagal memuat data sanksi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void muat(); }, [muat]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-[11px] text-[#64748b]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat sanksi &amp; pelanggaran…
      </p>
    );
  }

  const poin = ringkasan?.totalPoinAktif ?? 0;
  const adaSanksi = items.length > 0;

  return (
    <div className="space-y-3">
      {err && <p className="text-[11px] text-[#b91c1c] bg-[#fef2f2] px-3 py-2 rounded-lg">{err}</p>}

      {/* Ringkasan poin */}
      <div
        className={`rounded-xl border p-3 ${
          poin === 0 ? 'border-[#d4ecdd] bg-[#f6fdf9]' : 'border-[#f5c6c0] bg-[#fce8e6]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748b]">
              Poin pelanggaran aktif
            </p>
            <p className={`mt-0.5 text-2xl font-black ${poin === 0 ? 'text-[#137333]' : 'text-[#c5221f]'}`}>
              {poin} poin
            </p>
            <p className="text-[11px] text-[#475569] mt-0.5">
              {ringkasan?.jumlahSanksiAktif ?? 0} sanksi masih berlaku
              {ringkasan?.berlakuSampai ? ` · berakhir ${tanggal(ringkasan.berlakuSampai)}` : ''}
            </p>
          </div>
          <span className="shrink-0 rounded-full p-2" style={{ background: poin === 0 ? '#e6f4ea' : '#fde2e1' }}>
            {poin === 0 ? (
              <ShieldCheck className="h-4 w-4 text-[#137333]" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-[#c5221f]" />
            )}
          </span>
        </div>

        {poin === 0 && (
          <p className="mt-2 text-[11px] text-[#137333]">
            Tidak ada poin pelanggaran aktif. Pertahankan kedisiplinan Anda.
          </p>
        )}

        {ringkasan?.ambangTerlampaui && (
          <p className="mt-2 text-[11px] font-semibold text-[#92400e] bg-[#fffbeb] border border-[#fde68a] rounded px-2 py-1">
            Poin Anda telah melewati ambang {ringkasan.ambangTerlampaui.poin} poin —{' '}
            {ringkasan.ambangTerlampaui.label}.
          </p>
        )}

        {/* Rekap per kategori */}
        {(ringkasan?.perKategori?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ringkasan!.perKategori.map((k) => (
              <span
                key={k.kategori}
                className="rounded bg-white/70 border border-[#e2e8f0] px-1.5 py-0.5 text-[10px] font-semibold text-[#334155]"
              >
                {k.label}: {k.poin} poin
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Riwayat sanksi */}
      {!adaSanksi ? (
        <p className="text-[11px] text-[#64748b] bg-[#f8fafc] border border-dashed border-[#cbd5e1] rounded-lg p-3">
          Belum ada catatan sanksi. Sanksi yang diterbitkan HR akan tampil di sini.
        </p>
      ) : (
        <div className="rounded-xl border border-[#e2e8f0] bg-white">
          <p className="px-3 pt-2.5 pb-1 text-[11px] font-extrabold text-[#334155]">
            Riwayat sanksi ({items.length})
          </p>
          <ul className="divide-y divide-[#f1f5f9]">
            {items.map((s) => {
              const lewat = berakhir(s);
              return (
                <li key={s.id} className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12px] font-bold text-[#0f172a]">
                      {LABEL_SANKSI[s.actionType] ?? s.actionType}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        lewat ? 'bg-[#f1f5f9] text-[#64748b]' : 'bg-[#fce8e6] text-[#c5221f]'
                      }`}
                    >
                      {lewat ? 'Berakhir' : 'Berlaku'}
                    </span>
                    {s.violationCategory && (
                      <span className="rounded bg-[#eef2ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#3730a3]">
                        {s.violationCategory.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#475569]">{s.reason}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-[#94a3b8]">
                    <span>Berlaku sejak {tanggal(s.effectiveDate)}</span>
                    {s.expiryDate && (
                      <span className="inline-flex items-center gap-0.5">
                        <CalendarClock className="h-2.5 w-2.5" /> s.d. {tanggal(s.expiryDate)}
                      </span>
                    )}
                    <span>· {APPEAL_LABEL[s.appealStatus] ?? s.appealStatus}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-[#94a3b8]">
        Poin hanya dihitung selama sanksi masih berlaku. Sanksi diterbitkan oleh HR; keberatan
        dapat diajukan dalam 5 hari kerja sejak tanggal efektif.
      </p>
    </div>
  );
}
