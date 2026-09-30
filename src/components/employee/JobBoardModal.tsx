'use client';

import React, { useEffect, useState } from 'react';
import { Briefcase, X, AlertCircle, CheckCircle2, Send, ArrowLeft, Users } from 'lucide-react';

interface JobPosting {
  id: string;
  postingTitle: string;
  description: string;
  requiredSkills: string[];
  positionTitle: string;
  departmentName: string;
  approvedQuota: number;
  hiredCount: number;
  postedAt: string;
}

interface JobBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

type View = 'list' | 'form' | 'result';

export default function JobBoardModal({ isOpen, onClose, onSuccess }: JobBoardModalProps) {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<JobPosting | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [cvUrl, setCvUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screening, setScreening] = useState<{ score: number; summary: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setView('list');
    setSelected(null);
    setScreening(null);
    setErrorMsg('');
    setCoverLetter('');
    setCvUrl('');
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/talent-acquisition/job-postings', {
          credentials: 'include',
        });
        const json = await res.json();
        if (!res.ok || json.status !== 'success') {
          throw new Error(json.detail ?? json.message ?? 'Gagal memuat lowongan.');
        }
        setPostings(json.data.items ?? []);
      } catch (err: any) {
        setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen]);

  if (!isOpen) return null;

  const openForm = (p: JobPosting) => {
    setSelected(p);
    setCoverLetter('');
    setCvUrl('');
    setErrorMsg('');
    setView('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/v1/talent-acquisition/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jobPostingId: selected.id,
          coverLetter,
          cvUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        // Pesan server ditampilkan apa adanya (mis. lamaran ganda)
        setErrorMsg(json.detail ?? json.message ?? 'Gagal mengirim lamaran.');
        return;
      }
      setScreening({
        score: json.data.screeningScore,
        summary: json.data.screeningSummary,
      });
      setView('result');
      onSuccess(`Lamaran untuk "${selected.postingTitle}" terkirim.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const remaining = (p: JobPosting) => Math.max(p.approvedQuota - p.hiredCount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600 text-white">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Bursa Kerja Internal</h3>
              <p className="text-[11px] text-slate-400">Kotak 3: Job Board & Mobilitas Internal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {view === 'list' && (
            <>
              {loading && <p className="text-xs text-slate-500">Memuat lowongan…</p>}
              {!loading && errorMsg && (
                <p className="text-xs text-rose-600 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> {errorMsg}
                </p>
              )}
              {!loading && !errorMsg && postings.length === 0 && (
                <p className="text-xs text-slate-500">
                  Belum ada lowongan internal yang dibuka.
                </p>
              )}
              <div className="space-y-3">
                {postings.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{p.postingTitle}</p>
                        <p className="text-[11px] text-slate-500">
                          {p.positionTitle} • {p.departmentName}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 flex items-center gap-1 flex-shrink-0">
                        <Users className="h-3 w-3" /> Sisa kuota: {remaining(p)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                      {p.description}
                    </p>
                    {p.requiredSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {p.requiredSkills.map((s) => (
                          <span
                            key={s}
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => openForm(p)}
                      disabled={remaining(p) === 0}
                      className="text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Lamar Posisi Ini
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {view === 'form' && selected && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => setView('list')}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke daftar
              </button>
              <div>
                <p className="text-sm font-bold text-slate-800">{selected.postingTitle}</p>
                <p className="text-[11px] text-slate-500">
                  {selected.positionTitle} • {selected.departmentName}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Cover Letter</label>
                <textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={4}
                  minLength={10}
                  required
                  placeholder="Ceritakan motivasi dan kecocokan Anda (min. 10 karakter)…"
                  className="mt-1 w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">URL CV</label>
                <input
                  type="url"
                  value={cvUrl}
                  onChange={(e) => setCvUrl(e.target.value)}
                  required
                  placeholder="https://…"
                  className="mt-1 w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              {errorMsg && (
                <p className="text-xs text-rose-600 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> {errorMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full text-xs font-bold px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="h-3.5 w-3.5" />
                {isSubmitting ? 'Mengirim…' : 'Kirim Lamaran'}
              </button>
            </form>
          )}

          {view === 'result' && screening && selected && (
            <div className="space-y-4 text-center py-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <div>
                <p className="text-sm font-bold text-slate-800">Lamaran Terkirim</p>
                <p className="text-xs text-slate-500 mt-1">
                  Hasil screening CV Anda untuk "{selected.postingTitle}":
                </p>
              </div>
              <div className="inline-block px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="text-3xl font-bold font-mono text-indigo-700">
                  {screening.score}
                </p>
                <p className="text-[10px] uppercase font-semibold text-slate-500">
                  Skor Kecocokan / 100
                </p>
              </div>
              <p className="text-xs text-slate-600 max-w-md mx-auto">{screening.summary}</p>
              <button
                onClick={() => setView('list')}
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300"
              >
                Kembali ke Daftar Lowongan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
