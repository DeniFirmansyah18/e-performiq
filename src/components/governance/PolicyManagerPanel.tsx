'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Plus, ExternalLink } from 'lucide-react';

interface HrPolicy {
  id: string;
  documentCode: string;
  title: string;
  policyType: 'SOP' | 'PP' | 'SK' | 'IK';
  version: string;
  effectiveDate: string;
  fileUrl: string;
  status: 'DRAFT' | 'AKTIF' | 'OBSOLETE';
  acknowledgedCount: number;
  supersedesId: string | null;
}

const STATUS_TONE: Record<HrPolicy['status'], string> = {
  DRAFT: 'bg-[#f1f5f9] text-[#475569]',
  AKTIF: 'bg-[#e6f4ea] text-[#007a5a]',
  OBSOLETE: 'bg-[#fce8e6] text-[#b91c1c]',
};

interface UploadedFile {
  storageKey: string;
  fileName: string;
  size: number;
  checksumSha256: string;
  pageCount: number | null;
  scanStatus: 'CLEAN' | 'INFECTED' | 'SKIPPED';
  scanEngine: string;
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export default function PolicyManagerPanel() {
  const [policies, setPolicies] = useState<HrPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState({
    documentCode: '',
    title: '',
    policyType: 'SOP' as HrPolicy['policyType'],
    version: '',
    effectiveDate: today(),
    fileUrl: '',
    supersedesVersion: '',
  });

  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/hr/policies');
      if (res.ok) {
        const json = await res.json();
        setPolicies(json?.data?.items ?? []);
      }
    } catch {
      /* biarkan kosong */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** Dikelompokkan per kode dokumen: judul tampil sekali, versi di bawahnya. */
  const grouped = useMemo(() => {
    const map = new Map<string, HrPolicy[]>();
    for (const p of policies) {
      const list = map.get(p.documentCode) ?? [];
      list.push(p);
      map.set(p.documentCode, list);
    }
    return Array.from(map.entries()).map(([code, versions]) => ({
      code,
      title: versions[0].title,
      versions: versions.slice().sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)),
    }));
  }, [policies]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setNotice(null);
    try {
      const body = new FormData();
      body.set('file', file);
      const res = await fetch('/api/v1/policies/upload', { method: 'POST', body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploaded(null);
        setNotice(json?.detail ?? 'Gagal mengunggah berkas.');
        return;
      }
      setUploaded(json.data as UploadedFile);
      setNotice(null);
    } finally {
      setUploading(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/v1/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentCode: form.documentCode,
          title: form.title,
          policyType: form.policyType,
          version: form.version,
          effectiveDate: form.effectiveDate,
          supersedesVersion: form.supersedesVersion || undefined,
          // Unggahan lebih diutamakan; URL hanya untuk dokumen lama.
          ...(uploaded
            ? {
                storageKey: uploaded.storageKey,
                fileName: uploaded.fileName,
                fileSize: uploaded.size,
                checksumSha256: uploaded.checksumSha256,
                scanStatus: uploaded.scanStatus,
                scanEngine: uploaded.scanEngine,
                pageCount: uploaded.pageCount,
              }
            : { fileUrl: form.fileUrl || undefined }),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice(json?.detail ?? 'Gagal menerbitkan versi.'); return; }
      setNotice(`Versi ${form.version} untuk ${form.documentCode} diterbitkan.`);
      setForm((f) => ({ ...f, version: '', fileUrl: '', supersedesVersion: '' }));
      setUploaded(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl border border-[#e2e8f0] bg-white space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#0284c7]" aria-hidden="true" />
            <span>Perpustakaan SOP & Peraturan</span>
          </h3>
          <p className="text-[11px] text-[#64748b]">
            Terbitkan versi baru; versi lama otomatis menjadi OBSOLETE dan kewajiban membaca muncul ulang.
          </p>
        </div>
        <span className="text-[10px] font-bold text-[#0284c7] bg-[#e0f2fe] px-2 py-1 rounded-lg">
          {policies.length} versi
        </span>
      </div>

      {notice && (
        <p className="text-[11px] text-[#0f172a] bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      {/* Form publikasi */}
      <div className="rounded-xl border border-[#e2e8f0] p-3 space-y-2">
        <p className="text-[11px] font-bold text-[#0f172a] flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Terbitkan Versi
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] text-[#475569]">
            Kode dokumen
            <input
              value={form.documentCode}
              onChange={(e) => setForm((f) => ({ ...f, documentCode: e.target.value }))}
              placeholder="SOP-HR-001"
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-[11px] text-[#475569]">
            Versi
            <input
              value={form.version}
              onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              placeholder="2.0"
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-[11px] text-[#475569] sm:col-span-2">
            Judul
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="SOP Cuti & Izin"
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-[11px] text-[#475569]">
            Jenis
            <select
              value={form.policyType}
              onChange={(e) => setForm((f) => ({ ...f, policyType: e.target.value as HrPolicy['policyType'] }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            >
              <option value="SOP">SOP</option>
              <option value="PP">Peraturan Perusahaan</option>
              <option value="SK">Surat Keputusan</option>
              <option value="IK">Instruksi Kerja</option>
            </select>
          </label>
          <label className="text-[11px] text-[#475569]">
            Tanggal efektif
            <input
              type="date"
              value={form.effectiveDate}
              onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-[11px] text-[#475569] sm:col-span-2">
            Berkas PDF (maks 10 MB)
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(file);
              }}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] file:mr-2 file:rounded file:border-0 file:bg-[#e6f4ea] file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-[#007a5a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>

          {uploading && <p className="text-[11px] text-[#0284c7] sm:col-span-2">Mengunggah berkas…</p>}

          {uploaded && (
            <div className="sm:col-span-2 rounded-lg border border-[#a7f3d0] bg-[#ecfdf5] px-2.5 py-2">
              <p className="text-[11px] font-bold text-[#007a5a]">Berkas siap terbit</p>
              <p className="text-[10px] text-[#475569]">
                {uploaded.fileName}
                {uploaded.pageCount ? ` · ${uploaded.pageCount} halaman` : ''}
                {' · '}{Math.round(uploaded.size / 1024)} KB
                {' · '}pemindaian: {uploaded.scanStatus === 'CLEAN' ? 'bersih' : 'tidak tersedia'}
              </p>
            </div>
          )}

          <label className="text-[11px] text-[#475569] sm:col-span-2">
            atau URL berkas (untuk dokumen lama)
            <input
              value={form.fileUrl}
              onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
              placeholder="https://…/sop.pdf"
              disabled={Boolean(uploaded)}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]"
            />
          </label>
          <label className="text-[11px] text-[#475569] sm:col-span-2">
            Menggantikan versi (opsional)
            <input
              value={form.supersedesVersion}
              onChange={(e) => setForm((f) => ({ ...f, supersedesVersion: e.target.value }))}
              placeholder="1.0"
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={publish}
          className="rounded-lg bg-[#007a5a] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2 disabled:opacity-50"
        >
          Terbitkan versi
        </button>
      </div>

      {/* Daftar versi */}
      {loading && <p className="text-[11px] text-[#64748b]">Memuat dokumen…</p>}

      <ul className="space-y-3">
        {grouped.map((group) => (
          <li key={group.code} className="rounded-xl border border-[#e2e8f0] p-3">
            <p className="text-xs font-extrabold text-[#0f172a]">{group.title}</p>
            <p className="text-[10px] uppercase tracking-wide text-[#64748b]">{group.code}</p>

            <ul className="mt-2 space-y-1.5">
              {group.versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-[#f8fafc] px-2 py-1.5">
                  <span className="text-[11px] font-bold text-[#0f172a]">v{v.version}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[v.status]}`}>
                    {v.status}
                  </span>
                  <span className="text-[10px] text-[#64748b]">
                    efektif {String(v.effectiveDate).slice(0, 10)}
                  </span>
                  <span className="text-[10px] font-semibold text-[#475569]">
                    {v.acknowledgedCount} pengakuan
                  </span>
                  <a
                    href={v.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-[#0284c7] underline"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" /> berkas
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
        {!loading && grouped.length === 0 && (
          <li className="text-[11px] text-[#64748b]">Belum ada dokumen. Terbitkan versi pertama di atas.</li>
        )}
      </ul>
    </div>
  );
}
