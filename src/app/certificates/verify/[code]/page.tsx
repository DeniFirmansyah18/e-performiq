'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ShieldX, Loader2, Calendar, User, BookOpen, Hash } from 'lucide-react';

interface Certificate {
  id: string;
  certificateNo: string;
  verificationCode: string;
  employeeName: string;
  courseTitle: string;
  issuedAt: string;
}

/**
 * Halaman verifikasi sertifikat PUBLIK (tanpa login).
 * Membaca `params.code` dan memanggil `GET /api/v1/certificates/verify/:code`.
 * - Valid → kartu hijau berisi pemegang, kursus, tanggal, penerbit.
 * - Tidak valid → kartu merah "tidak ditemukan" (bukan 500).
 */
export default function CertificateVerifyPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code ?? '');
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState<boolean | null>(null);
  const [cert, setCert] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/certificates/verify/${encodeURIComponent(code)}`);
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok && json?.data) {
          setValid(true);
          setCert(json.data as Certificate);
        } else if (res.status === 404) {
          setValid(false);
        } else {
          setValid(false);
          setError(json?.detail || 'Gagal memverifikasi sertifikat.');
        }
      } catch {
        if (alive) {
          setValid(false);
          setError('Terjadi kesalahan saat menghubungi server.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [code]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans">
      <header className="bg-[#0f172a] text-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <div>
            <h1 className="text-base font-extrabold leading-tight">Verifikasi Sertifikat</h1>
            <p className="text-[11px] text-slate-300">E-PerformIQ — pemeriksaan keaslian sertifikat pelatihan.</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        <div className="mb-4 rounded-lg border border-[#e2e8f0] bg-white px-4 py-3">
          <p className="text-[11px] text-[#64748b]">Kode verifikasi</p>
          <p className="text-sm font-mono font-bold break-all">{code || '—'}</p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-10 text-center text-[#64748b]">
            <Loader2 className="h-5 w-5 animate-spin inline-block" />
            <p className="text-xs mt-2">Memverifikasi…</p>
          </div>
        ) : valid && cert ? (
          <div className="rounded-xl border-2 border-emerald-300 bg-white overflow-hidden">
            <div className="bg-emerald-50 px-5 py-4 flex items-center gap-3 border-b border-emerald-200">
              <div className="h-10 w-10 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-emerald-800">Sertifikat Valid</p>
                <p className="text-[11px] text-emerald-700">Sertifikat ini terverifikasi & diterbitkan E-PerformIQ.</p>
              </div>
            </div>
            <dl className="divide-y divide-[#f1f5f9]">
              <Row icon={<User className="h-3.5 w-3.5" />} label="Pemegang" value={cert.employeeName} />
              <Row icon={<BookOpen className="h-3.5 w-3.5" />} label="Program / Kursus" value={cert.courseTitle} />
              <Row icon={<Hash className="h-3.5 w-3.5" />} label="Nomor Sertifikat" value={cert.certificateNo} mono />
              <Row
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Tanggal Terbit"
                value={cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString('id-ID', { dateStyle: 'long' }) : '—'}
              />
            </dl>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-rose-200 bg-white p-8 text-center">
            <div className="h-12 w-12 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <ShieldX className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-extrabold text-rose-700">Sertifikat Tidak Ditemukan</p>
            <p className="mt-1 text-[11px] text-[#64748b]">
              {error ?? 'Kode verifikasi tidak cocok dengan sertifikat mana pun. Periksa kembali kode yang Anda masukkan.'}
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-[11px] text-[#94a3b8]">
          Kembali ke{' '}
          <Link href="/careers" className="font-semibold text-[#007a5a] hover:underline">
            halaman karier
          </Link>
          .
        </p>
      </main>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="px-5 py-3 flex items-start gap-3">
      <span className="mt-0.5 text-[#94a3b8]">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] uppercase tracking-wide text-[#94a3b8]">{label}</dt>
        <dd className={`text-xs font-semibold text-[#0f172a] break-words ${mono ? 'font-mono' : ''}`}>{value}</dd>
      </div>
    </div>
  );
}
