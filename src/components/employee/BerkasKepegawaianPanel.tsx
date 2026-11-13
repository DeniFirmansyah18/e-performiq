'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FileText, CheckCircle2, AlertTriangle, Clock, Upload, Loader2 } from 'lucide-react';
import {
  KATALOG_DOKUMEN,
  LABEL_KELOMPOK,
  DOKUMEN_BY_KODE,
  type KelompokDokumen,
  type JenisDokumen,
} from '@/lib/services/documentCatalog';

interface DokumenTersimpan {
  documentType: string;
  verificationStatus: string;
  expiryDate: string | null;
}

interface Ringkasan {
  teksKelengkapan: string;
  jumlahWajib: number;
  jumlahLengkap: number;
  persen: number;
  belumAda: Array<{ kode: string; label: string }>;
  kedaluwarsa: Array<{ kode: string; label: string; tanggal: string }>;
  segeraKedaluwarsa: Array<{ kode: string; label: string; tanggal: string }>;
}

const URUTAN_KELOMPOK: KelompokDokumen[] = [
  'IDENTITAS',
  'PENDIDIKAN',
  'HUBUNGAN_KERJA',
  'JAMINAN',
  'ADMINISTRASI',
];

const tanggal = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Berkas kepegawaian lengkap menurut katalog baku.
 *
 * Dipakai BERSAMA oleh portal pegawai ("Profil Saya") dan direktori HR
 * ("Detail Pegawai"), sehingga PEOPLE MANAGER, BOD, dan HR melihat daftar,
 * penanda wajib/opsional, indikator kelengkapan, serta peringatan kedaluwarsa
 * yang sama persis.
 *
 * `employeeId` = pegawai yang dilihat. Bila kosong, memakai sesi sendiri.
 * `bolehUnggah` = tombol unggah ditampilkan (hanya untuk berkas sendiri).
 */
export default function BerkasKepegawaianPanel({
  employeeId,
  bolehUnggah = false,
}: {
  employeeId?: string;
  bolehUnggah?: boolean;
}) {
  const [dokumen, setDokumen] = useState<DokumenTersimpan[]>([]);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [unggahBusy, setUnggahBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      const url = employeeId
        ? `/api/v1/hr/employees/${employeeId}/detail`
        : '/api/v1/me/documents';
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.detail || 'Gagal memuat berkas kepegawaian.'); return; }

      if (employeeId) {
        // Endpoint detail pegawai (dipakai HR) mengirim dokumen + ringkasan.
        const d = json?.data?.dokumen;
        setDokumen(Array.isArray(d) ? d : []);
        setRingkasan(json?.data?.kelengkapanBerkas ?? null);
      } else {
        const d = json?.data?.items ?? json?.data?.documents ?? json?.data;
        setDokumen(Array.isArray(d) ? d : []);
        setRingkasan(json?.data?.kelengkapan ?? null);
      }
    } catch {
      setErr('Gagal memuat berkas kepegawaian.');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { void muat(); }, [muat]);

  async function unggah(jenis: JenisDokumen, file: File | null) {
    if (!file || !bolehUnggah) return;
    setUnggahBusy(jenis.kode); setErr(null); setMsg(null);
    try {
      // 1) Simpan berkas ke storage lewat endpoint unggahan yang sudah ada.
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch('/api/v1/policies/upload', { method: 'POST', body: fd });
      const upJson = await up.json().catch(() => ({}));
      if (!up.ok) { setErr(upJson?.detail || 'Gagal mengunggah berkas.'); return; }

      const url =
        upJson?.data?.url ??
        (upJson?.data?.storageKey
          ? `${window.location.origin}/api/v1/policies/${upJson.data.storageKey}`
          : null);
      if (!url) { setErr('Berkas tersimpan tetapi tautannya tidak diperoleh.'); return; }

      // 2) Catat sebagai berkas kepegawaian dengan JENIS BAKU dari katalog.
      const res = await fetch('/api/v1/me/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType: jenis.kode, fileUrl: url }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.detail || 'Gagal mencatat berkas.'); return; }
      setMsg(`Berkas ${jenis.label} terunggah dan menunggu verifikasi HR.`);
      await muat();
    } catch {
      setErr('Gagal mengunggah berkas.');
    } finally {
      setUnggahBusy(null);
    }
  }

  const perKode = new Map(
    (Array.isArray(dokumen) ? dokumen : []).map((d) => [
      String(d?.documentType ?? '').trim().toUpperCase(),
      d,
    ])
  );

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-[11px] text-[#64748b]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat berkas kepegawaian…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {err && <p className="text-[11px] text-[#b91c1c] bg-[#fef2f2] px-3 py-2 rounded-lg">{err}</p>}
      {msg && <p className="text-[11px] text-[#137333] bg-[#e6f4ea] px-3 py-2 rounded-lg">{msg}</p>}

      {/* Indikator kelengkapan */}
      {ringkasan && (
        <div className="rounded-xl border border-[#d4ecdd] bg-[#f6fdf9] p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-extrabold text-[#0f172a]">{ringkasan.teksKelengkapan}</p>
            <span className="text-[11px] font-bold text-[#137333]">{ringkasan.persen}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#e2e8f0] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#007a5a] transition-all"
              style={{ width: `${ringkasan.persen}%` }}
            />
          </div>
          {ringkasan.belumAda.length > 0 && (
            <p className="text-[11px] text-[#64748b]">
              Belum ada: {ringkasan.belumAda.map((d) => d.label).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Peringatan kedaluwarsa */}
      {(ringkasan?.kedaluwarsa.length || ringkasan?.segeraKedaluwarsa.length) ? (
        <div className="rounded-xl border border-[#f5c6c0] bg-[#fce8e6] p-3 space-y-1">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-[#c5221f]">
            <AlertTriangle className="h-3.5 w-3.5" /> Dokumen perlu diperbarui
          </p>
          {ringkasan?.kedaluwarsa.map((d) => (
            <p key={d.kode} className="text-[11px] text-[#334155]">
              <strong>{d.label}</strong> — sudah kedaluwarsa sejak {tanggal(d.tanggal)}
            </p>
          ))}
          {ringkasan?.segeraKedaluwarsa.map((d) => (
            <p key={d.kode} className="text-[11px] text-[#92400e]">
              <strong>{d.label}</strong> — berakhir {tanggal(d.tanggal)}
            </p>
          ))}
        </div>
      ) : null}

      {/* Daftar baku per kelompok */}
      {URUTAN_KELOMPOK.map((kel) => {
        const jenis = KATALOG_DOKUMEN.filter((d) => d.kelompok === kel);
        if (jenis.length === 0) return null;
        return (
          <div key={kel} className="rounded-xl border border-[#e2e8f0] bg-white">
            <p className="px-3 pt-2.5 pb-1 text-[11px] font-extrabold text-[#334155]">
              {LABEL_KELOMPOK[kel]}
            </p>
            <ul className="divide-y divide-[#f1f5f9]">
              {jenis.map((d) => {
                const ada = perKode.get(d.kode);
                const kedaluwarsa =
                  ada?.expiryDate && new Date(ada.expiryDate).getTime() < Date.now();
                return (
                  <li key={d.kode} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#0f172a]">
                        <FileText className="h-3 w-3 shrink-0 text-[#64748b]" />
                        <span className="truncate">{d.label}</span>
                        <span
                          className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${
                            d.wajib ? 'bg-[#fce8e6] text-[#c5221f]' : 'bg-[#f1f5f9] text-[#64748b]'
                          }`}
                        >
                          {d.wajib ? 'WAJIB' : 'OPSIONAL'}
                        </span>
                      </p>
                      <p className="text-[10px] text-[#64748b]">
                        Verifikator: {d.verifikator === 'HR' ? 'HR' : 'Atasan langsung'}
                        {ada?.expiryDate && ` · berlaku s.d. ${tanggal(ada.expiryDate)}`}
                        {d.ket && !ada && ` · ${d.ket}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {ada ? (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                            kedaluwarsa ? 'text-[#c5221f]' : 'text-[#137333]'
                          }`}
                        >
                          {kedaluwarsa ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                          {kedaluwarsa ? 'Kedaluwarsa' : 'Ada'}
                        </span>
                      ) : bolehUnggah ? (
                        <label className="inline-flex items-center gap-1 rounded-lg border border-[#cbd5e1] px-2 py-1 text-[10px] font-semibold text-[#334155] cursor-pointer hover:bg-[#f8fafc]">
                          {unggahBusy === d.kode ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Upload className="h-3 w-3" />
                          )}
                          Unggah
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => void unggah(d, e.target.files?.[0] ?? null)}
                          />
                        </label>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#94a3b8]">
                          <Clock className="h-3 w-3" /> Belum ada
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <p className="text-[10px] text-[#94a3b8]">
        Katalog baku {KATALOG_DOKUMEN.length} jenis berkas. Data yang diisi kandidat saat
        melamar (nama, email, pendidikan) terisi otomatis — berkas fisiknya tetap perlu diunggah.
      </p>
    </div>
  );
}
