'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';

interface DetailPenawaran {
  posisi: string | null;
  gajiPokok: number;
  tunjangan: number | null;
  batasRespons: string | null;
  keterangan: string | null;
}

/** Format rupiah tanpa desimal agar mudah dibaca kandidat. */
const rupiah = (n: number | null) =>
  n === null || n === undefined
    ? '—'
    : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

/** Tanggal & jam WIB dari string ISO. */
const tanggalWib = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }) + ' WIB';
};

/**
 * Halaman publik respons penawaran kerja.
 *
 * Kandidat membuka tautan dari email/WhatsApp (berisi token), melihat rincian
 * penawaran, lalu memilih Terima atau Tolak tanpa perlu membuat akun.
 */
/** Satu baris rincian penawaran. */
function BarisDetail({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-[#64748b]">{label}</span>
      <span className="text-[12px] font-bold text-[#0f172a] text-right">{nilai}</span>
    </div>
  );
}

function IsiHalamanRespons() {
  const params = useSearchParams();
  const token = params.get('t') ?? '';

  const [status, setStatus] = useState<'memuat' | 'siap' | 'tidakvalid' | 'selesai' | 'gagal'>('memuat');
  const [pesan, setPesan] = useState<string>('');
  const [keputusan, setKeputusan] = useState<'ACCEPTED' | 'DECLINED' | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [detail, setDetail] = useState<DetailPenawaran | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('tidakvalid');
      setPesan('Tautan tidak lengkap. Silakan buka kembali tautan dari email atau WhatsApp Anda.');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/v1/careers/offers/respond?t=${encodeURIComponent(token)}`);
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setStatus('tidakvalid');
          setPesan(json?.detail ?? 'Tautan tidak valid.');
          return;
        }
        setDetail(json?.data?.detail ?? null);
        setStatus('siap');
      } catch {
        setStatus('tidakvalid');
        setPesan('Gagal menghubungi server. Silakan coba lagi.');
      }
    })();
  }, [token]);

  const kirim = async (decision: 'ACCEPTED' | 'DECLINED') => {
    setMengirim(true);
    try {
      const res = await fetch('/api/v1/careers/offers/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, decision }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus('gagal');
        setPesan(json?.detail ?? 'Jawaban gagal dikirim.');
        return;
      }
      setKeputusan(decision);
      setStatus('selesai');
    } catch {
      setStatus('gagal');
      setPesan('Gagal menghubungi server. Silakan coba lagi.');
    } finally {
      setMengirim(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-6 space-y-4">
        <h1 className="text-lg font-extrabold text-[#0f172a]">Penawaran Kerja</h1>

        {status === 'memuat' && (
          <p className="flex items-center gap-2 text-sm text-[#64748b]">
            <Loader2 className="h-4 w-4 animate-spin" /> Memeriksa tautan…
          </p>
        )}

        {(status === 'tidakvalid' || status === 'gagal') && (
          <div role="alert" className="flex items-start gap-2 rounded-xl bg-[#fce8e6] border border-[#f5c6c0] p-3">
            <AlertTriangle className="h-4 w-4 text-[#c5221f] mt-0.5 shrink-0" />
            <p className="text-[12px] text-[#c5221f] font-medium">{pesan}</p>
          </div>
        )}

        {status === 'siap' && (
          <>
            {/* Rincian penawaran agar kandidat bisa memutuskan tanpa bertanya dulu. */}
            {detail && (
              <div className="rounded-xl border border-[#d4ecdd] bg-[#f6fdf9] p-4 space-y-2.5">
                <BarisDetail label="Posisi" nilai={detail.posisi ?? '—'} />
                <BarisDetail label="Gaji Pokok" nilai={rupiah(detail.gajiPokok)} />
                <BarisDetail label="Tunjangan" nilai={rupiah(detail.tunjangan)} />
                <BarisDetail label="Batas Respons" nilai={tanggalWib(detail.batasRespons)} />
                {detail.keterangan && (
                  <div className="pt-2 border-t border-[#d4ecdd]">
                    <p className="text-[11px] font-semibold text-[#64748b] mb-1">Keterangan</p>
                    <p className="text-[12px] text-[#334155] leading-relaxed whitespace-pre-wrap">{detail.keterangan}</p>
                  </div>
                )}
              </div>
            )}

            <p className="text-sm text-[#334155] leading-relaxed">
              Terima kasih atas minat Anda bergabung dengan perusahaan kami. Silakan tentukan jawaban
              Anda atas penawaran kerja ini.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                disabled={mengirim}
                onClick={() => kirim('ACCEPTED')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#007a5a] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#00684a] disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" /> Terima Penawaran
              </button>
              <button
                type="button"
                disabled={mengirim}
                onClick={() => kirim('DECLINED')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#f5c6c0] bg-white px-4 py-2.5 text-sm font-bold text-[#c5221f] hover:bg-[#fce8e6] disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" /> Tolak Penawaran
              </button>
            </div>
            <p className="text-[11px] text-[#64748b]">
              Jawaban hanya dapat dikirim satu kali. Pastikan pilihan Anda sudah benar.
            </p>
          </>
        )}

        {status === 'selesai' && (
          <div role="status" className="rounded-xl bg-[#e6f4ea] border border-[#b7e1cd] p-4 space-y-1">
            <p className="text-sm font-bold text-[#137333]">
              {keputusan === 'ACCEPTED' ? 'Terima kasih, Anda menerima penawaran ini.' : 'Terima kasih atas jawabannya.'}
            </p>
            <p className="text-[12px] text-[#334155]">
              {keputusan === 'ACCEPTED'
                ? 'Tim HR akan menghubungi Anda untuk proses selanjutnya.'
                : 'Kami menghargai waktu Anda melamar. Semoga sukses di kesempatan berikutnya.'}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function HalamanResponsPenawaran() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center text-sm text-[#64748b]">Memuat…</main>}>
      <IsiHalamanRespons />
    </Suspense>
  );
}
