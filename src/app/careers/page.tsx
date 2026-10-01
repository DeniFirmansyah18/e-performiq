'use client';

import React, { useEffect, useState } from 'react';

interface Posting { id: string; postingTitle: string; description: string; department: string; position: string }

/** Portal Karier publik (tanpa login). Memakai /api/v1/careers/*. */
export default function CareersPage() {
  const [postings, setPostings] = useState<Posting[]>([]);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', address: '', birthDate: '', education: '', resumeUrl: '', coverLetter: '', website: '' });
  const [selectedPosting, setSelectedPosting] = useState<string>('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [statusQuery, setStatusQuery] = useState('');
  const [statusResult, setStatusResult] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/careers/postings')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) { setPostings(j.data.postings ?? []); setSelectedPosting(j.data.postings?.[0]?.id ?? ''); } })
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const res = await fetch('/api/v1/careers/apply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, jobPostingId: selectedPosting }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setSubmitted(j.data.applicationNo); setMsg(null); }
    else setMsg(j?.detail || 'Gagal mengirim lamaran.');
  };

  const checkStatus = async () => {
    setStatusResult(null);
    const res = await fetch(`/api/v1/careers/status/${statusQuery}`);
    const j = await res.json().catch(() => ({}));
    setStatusResult(res.ok ? `Status: ${j.data.status} (${j.data.postingTitle})` : 'Nomor lamaran tidak ditemukan.');
  };

  const field = (key: keyof typeof form, label: string, type = 'text') => (
    <label className="block text-xs">
      <span className="font-semibold text-[#334155]">{label}</span>
      <input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" />
    </label>
  );

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
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#137333]">Lamaran terkirim! Simpan nomor lamaran Anda:</p>
              <p className="text-sm font-black font-mono text-[#0f172a]">{submitted}</p>
              <button onClick={() => { setSubmitted(null); setForm({ fullName: '', email: '', phone: '', address: '', birthDate: '', education: '', resumeUrl: '', coverLetter: '', website: '' }); }}
                className="text-[11px] font-bold text-[#007a5a] underline">Kirim lamaran lain</button>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {field('fullName', 'Nama Lengkap')}
                {field('email', 'Email', 'email')}
                {field('phone', 'Telepon')}
                {field('birthDate', 'Tanggal Lahir', 'date')}
                {field('education', 'Pendidikan')}
                {field('resumeUrl', 'Tautan CV (URL)')}
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
        </section>
      </main>
    </div>
  );
}
