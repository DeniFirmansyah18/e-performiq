'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Posting { id: string; postingTitle: string; description: string; department: string; position: string }
interface UploadResult {
  fileName: string;
  extracted: boolean;
  rawText: string;
  detectedSkills: string[];
  note?: string;
}
interface AtsResult { score: number; matched: string[]; missing: string[] }

/** Portal Karier publik (tanpa login). Memakai /api/v1/careers/*. */
export default function CareersPage() {
  const [postings, setPostings] = useState<Posting[]>([]);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', address: '', birthDate: '', education: '', resumeUrl: '', coverLetter: '', website: '' });
  const [selectedPosting, setSelectedPosting] = useState<string>('');
  const [upload, setUpload] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [submitted, setSubmitted] = useState<string | null>(null);
  const [ats, setAts] = useState<AtsResult | null>(null);
  const [statusQuery, setStatusQuery] = useState('');
  const [statusResult, setStatusResult] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/careers/postings')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) { setPostings(j.data.postings ?? []); setSelectedPosting(j.data.postings?.[0]?.id ?? ''); } })
      .catch(() => {});
  }, []);

  const handleFile = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/v1/careers/upload', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setUploadError(j?.detail || 'Gagal mengunggah berkas.'); return; }
      setUpload(j.data as UploadResult);
      const parsed = (j.data as any)?.parsed ?? {};
      setForm((f) => ({
        ...f,
        fullName: f.fullName || parsed.fullName || f.fullName,
        phone: f.phone || parsed.contact?.phone || f.phone,
        resumeUrl: f.resumeUrl || parsed.contact?.linkedinUrl || f.resumeUrl,
      }));
    } catch {
      setUploadError('Terjadi kesalahan saat mengunggah.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const res = await fetch('/api/v1/careers/apply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        jobPostingId: selectedPosting,
        resumeText: upload?.extracted ? upload.rawText : undefined,
        resumeFileName: upload?.fileName,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setSubmitted(j.data.applicationNo); setAts(j.data.ats ?? null); setMsg(null); }
    else setMsg(j?.detail || 'Gagal mengirim lamaran.');
  };

  const checkStatus = async () => {
    setStatusResult(null);
    const res = await fetch(`/api/v1/careers/status/${statusQuery}`);
    const j = await res.json().catch(() => ({}));
    setStatusResult(res.ok ? `Status: ${j.data.status} (${j.data.postingTitle})` : 'Nomor lamaran tidak ditemukan.');
  };

  const reset = () => {
    setSubmitted(null); setAts(null); setUpload(null);
    if (fileRef.current) fileRef.current.value = '';
    setForm({ fullName: '', email: '', phone: '', address: '', birthDate: '', education: '', resumeUrl: '', coverLetter: '', website: '' });
  };

  const field = (key: keyof typeof form, label: string, type = 'text') => (
    <label className="block text-xs">
      <span className="font-semibold text-[#334155]">{label}</span>
      <input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" />
    </label>
  );

  const scoreColor = (s: number) => (s >= 75 ? 'text-emerald-600' : s >= 50 ? 'text-amber-600' : 'text-rose-600');

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans">
      <header className="bg-[#0f172a] text-white px-6 py-4">
        <h1 className="text-lg font-extrabold">Karier di E-PerformIQ</h1>
        <p className="text-xs text-slate-300">Bergabunglah membangun ekosistem kinerja SDM kelas dunia.</p>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <section>
          <h2 className="text-sm font-extrabold mb-2">Lowongan Terbuka</h2>
          {postings.length === 0 ? (
            <p className="text-xs text-[#64748b]">Belum ada lowongan publik saat ini.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {postings.map((p) => (
                <div key={p.id} className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
                  <p className="text-xs font-bold">{p.postingTitle}</p>
                  <p className="text-[11px] text-[#64748b]">{p.department} · {p.position}</p>
                  <p className="text-[11px] text-[#334155]">{p.description}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="p-4 rounded-xl border border-[#e2e8f0] bg-white">
          <h2 className="text-sm font-extrabold mb-3">Ajukan Lamaran</h2>
          {submitted ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-[#137333]">Lamaran terkirim! Simpan nomor lamaran Anda:</p>
                <p className="text-sm font-black font-mono text-[#0f172a]">{submitted}</p>
              </div>

              {ats && (
                <div className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Skor Kesesuaian CV (ATS)</span>
                    <span className={`text-lg font-black ${scoreColor(ats.score)}`}>
                      {ats.score.toFixed(0)}<span className="text-[10px] text-slate-400">/100</span>
                    </span>
                  </div>
                  {ats.matched.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-700 mb-1">Kualifikasi terpenuhi</p>
                      <div className="flex flex-wrap gap-1">
                        {ats.matched.map((s) => (
                          <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {ats.missing.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-amber-700 mb-1">Kualifikasi yang belum terlihat</p>
                      <div className="flex flex-wrap gap-1">
                        {ats.missing.map((s) => (
                          <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button onClick={reset} className="text-[11px] font-bold text-[#007a5a] underline">Kirim lamaran lain</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <label className="block text-xs">
                <span className="font-semibold text-[#334155]">Posisi yang dilamar</span>
                <select value={selectedPosting} onChange={(e) => setSelectedPosting(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs">
                  {postings.map((p) => <option key={p.id} value={p.id}>{p.postingTitle}</option>)}
                </select>
              </label>

              {/* Unggah CV untuk analisis ATS otomatis */}
              <div className="p-3 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] space-y-2">
                <p className="text-xs font-semibold text-[#334155]">Unggah CV (PDF/DOCX/TXT) — dianalisis otomatis (ATS)</p>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.md,.rtf"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  className="block w-full text-[11px] text-[#334155] file:mr-2 file:rounded-lg file:border-0 file:bg-[#007a5a] file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-white" />
                {uploading && <p className="text-[11px] text-[#64748b]">Menganalisis berkas…</p>}
                {uploadError && <p className="text-[11px] font-semibold text-rose-600">{uploadError}</p>}
                {upload && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-[#334155]">
                      <span className="font-semibold">{upload.fileName}</span> — {upload.extracted ? 'teks berhasil diekstrak' : 'teks tidak terbaca'}
                    </p>
                    {upload.detectedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {upload.detectedSkills.slice(0, 20).map((s) => (
                          <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">{s}</span>
                        ))}
                      </div>
                    )}
                    {upload.note && <p className="text-[10px] text-[#64748b]">{upload.note}</p>}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {field('fullName', 'Nama Lengkap')}
                {field('email', 'Email', 'email')}
                {field('phone', 'Telepon')}
                {field('birthDate', 'Tanggal Lahir', 'date')}
                {field('education', 'Pendidikan')}
                {field('resumeUrl', 'Tautan CV / LinkedIn (URL)')}
              </div>
              {field('address', 'Alamat')}
              <label className="block text-xs">
                <span className="font-semibold text-[#334155]">Surat Lamaran</span>
                <textarea value={form.coverLetter} onChange={(e) => setForm({ ...form, coverLetter: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs h-20" />
              </label>
              {/* Honeypot: disembunyikan dari manusia; bot mengisinya */}
              <input type="text" tabIndex={-1} autoComplete="off" value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="hidden" aria-hidden="true" />
              {msg && <p className="text-[11px] font-semibold text-rose-600">{msg}</p>}
              <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-[#007a5a] rounded-lg hover:bg-[#006347]">
                Kirim Lamaran
              </button>
            </form>
          )}
        </section>

        <section className="p-4 rounded-xl border border-[#e2e8f0] bg-white">
          <h2 className="text-sm font-extrabold mb-3">Cek Status Lamaran</h2>
          <div className="flex gap-2">
            <input value={statusQuery} onChange={(e) => setStatusQuery(e.target.value)} placeholder="APP-YYYYMMDD-XXXXX"
              className="flex-1 rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs font-mono" />
            <button onClick={checkStatus} className="px-3 py-1.5 text-xs font-bold text-white bg-[#0f172a] rounded-lg">Cek</button>
          </div>
          {statusResult && <p className="text-[11px] font-semibold text-[#334155] mt-2">{statusResult}</p>}
          <a href={`/careers/status${statusQuery ? `?no=${encodeURIComponent(statusQuery)}` : ''}`}
            className="inline-block mt-2 text-[11px] font-bold text-[#007a5a] underline">
            Lihat progres tahapan lengkap →
          </a>
        </section>
      </main>
    </div>
  );
}
