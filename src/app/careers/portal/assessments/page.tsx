'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, CheckCircle2, Clock } from 'lucide-react';
import CandidateTopBar from '@/components/careers/CandidateTopBar';

interface TemplateInfo { id: string; code: string; title: string; type: string; weight: number }
interface AttemptInfo { attemptId: string; status: string; score: number | null; submittedAt: string | null; code: string; title: string; type: string; weight: number }
interface Question { id: string; order_index: number; type: 'MCQ' | 'LIKERT' | 'CODING' | 'OPEN'; prompt: string; options: Array<{ key: string; label: string; score?: number }> | null; scale: string | null }
interface AttemptView { attemptId: string; status: string; template: { id: string; code: string; title: string; type: string; weight: number }; questions: Question[]; score: number | null }

const TYPE_LABEL: Record<string, string> = {
  PSYCHOMETRIC: 'Psikometri', TECHNICAL: 'Teknis', INTERVIEW: 'Wawancara',
};
const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Belum Dimulai', IN_PROGRESS: 'Sedang Berjalan', SUBMITTED: 'Terkirim', SCORED: 'Sudah Dinilai',
};

export default function CandidateAssessmentsPage() {
  const router = useRouter();
  const [account, setAccount] = useState<{ name: string } | null>(null);
  const [attempts, setAttempts] = useState<AttemptInfo[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [appStatus, setAppStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ujian aktif
  const [exam, setExam] = useState<AttemptView | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; correct: number; total: number } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/careers/assessments');
    if (res.status === 404) { setAttempts([]); setTemplates([]); return; }
    const j = await res.json().catch(() => ({}));
    setAttempts(j?.data?.attempts ?? []);
    setTemplates(j?.data?.templates ?? []);
    setAppStatus(j?.data?.status ?? null);
  }, []);

  useEffect(() => {
    fetch('/api/v1/careers/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data?.account) setAccount(j.data.account); else router.replace('/careers/login'); })
      .catch(() => router.replace('/careers/login'))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => { if (account) load(); }, [account, load]);

  const startTest = async (type: 'PSYCHOMETRIC' | 'TECHNICAL') => {
    setError(null); setResult(null);
    const res = await fetch('/api/v1/careers/assessments/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j?.detail || 'Gagal memulai tes.');
      if (res.status === 403) load();
      return;
    }
    setExam(j.data as AttemptView);
    setAnswers({});
  };

  const submit = async () => {
    if (!exam) return;
    setSubmitting(true); setError(null);
    const responses = exam.questions.map((q) => ({ questionId: q.id, answerKey: answers[q.id] ?? null }));
    const res = await fetch('/api/v1/careers/assessments/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: exam.template.id, responses }),
    });
    const j = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) { setError(j?.detail || 'Gagal mengirim jawaban.'); return; }
    setResult(j.data);
    setExam(null);
    load();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-[#64748b]">Memuat…</div>;
  if (!account) return null;

  const answeredCount = exam ? Object.keys(answers).length : 0;
  const OPEN_STATUSES = ['SCREENING', 'INTERVIEW', 'OFFERED', 'HIRED'];
  const locked = appStatus != null && !OPEN_STATUSES.includes(appStatus);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <CandidateTopBar />

      <main className="max-w-3xl mx-auto p-6 space-y-5">
        {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>}

        {result && (
          <div className="p-5 rounded-2xl bg-white border border-[#b7e1cd] text-center space-y-1">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-bold text-[#0f172a]">Tes selesai!</p>
            <p className="text-3xl font-black text-emerald-600">{result.score.toFixed(0)}<span className="text-sm text-slate-400">/100</span></p>
            {result.total > 0 && <p className="text-xs text-[#64748b]">Jawaban benar: {result.correct}/{result.total}</p>}
          </div>
        )}

        {exam ? (
          <section className="rounded-2xl bg-white border border-[#e2e8f0] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-base font-extrabold text-[#0f172a]">{exam.template.title}</h1>
                <p className="text-[11px] text-[#64748b]">{TYPE_LABEL[exam.template.type] ?? exam.template.type} · {exam.questions.length} soal · bobot {exam.template.weight}%</p>
              </div>
              <span className="text-[11px] font-semibold text-[#64748b]">{answeredCount}/{exam.questions.length} dijawab</span>
            </div>

            <div className="space-y-4">
              {exam.questions.map((q, i) => (
                <div key={q.id} className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc]">
                  <p className="text-xs font-semibold text-[#0f172a] mb-2">{i + 1}. {q.prompt}</p>
                  <div className="space-y-1.5">
                    {(q.options ?? []).map((o) => (
                      <label key={o.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${answers[q.id] === o.key ? 'border-[#007a5a] bg-[#e6f4ea] font-semibold' : 'border-[#e2e8f0] bg-white hover:border-[#94a3b8]'}`}>
                        <input type="radio" name={q.id} checked={answers[q.id] === o.key}
                          onChange={() => setAnswers({ ...answers, [q.id]: o.key })}
                          className="accent-[#007a5a]" />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button onClick={() => setExam(null)} className="text-xs font-semibold text-[#64748b] hover:text-[#0f172a]">Batal</button>
              <button onClick={submit} disabled={submitting || answeredCount === 0}
                className="px-5 py-2 text-xs font-bold text-white bg-[#007a5a] rounded-lg hover:bg-[#006347] disabled:opacity-50">
                {submitting ? 'Mengirim…' : 'Kirim Jawaban'}
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-2xl bg-white border border-[#e2e8f0] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-[#007a5a]" />
                <h2 className="text-sm font-extrabold text-[#0f172a]">Mulai Tes</h2>
              </div>
              {locked ? (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <Clock className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>Tes belum dibuka. Menunggu seleksi HR. Anda akan dapat memulai tes setelah lamaran masuk tahap <strong>Screening</strong>.</span>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-[#64748b]">Kerjakan tes berikut secara jujur. Skor psikometri (30%) dan teknis (40%) digabung dengan wawancara (30%).</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={() => startTest('PSYCHOMETRIC')}
                      className="p-4 rounded-xl border border-[#e2e8f0] hover:border-[#007a5a] hover:shadow-md transition-all text-left">
                      <p className="text-xs font-bold text-[#0f172a]">Tes Psikometri</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">20 soal kepribadian · ~10 menit · bobot 30%</p>
                    </button>
                    <button onClick={() => startTest('TECHNICAL')}
                      className="p-4 rounded-xl border border-[#e2e8f0] hover:border-[#007a5a] hover:shadow-md transition-all text-left">
                      <p className="text-xs font-bold text-[#0f172a]">Tes Teknis</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">8 soal logika & kuantitatif · ~15 menit · bobot 40%</p>
                    </button>
                  </div>
                </>
              )}
            </section>

            <section className="rounded-2xl bg-white border border-[#e2e8f0] p-5 space-y-3">
              <h2 className="text-sm font-extrabold text-[#0f172a]">Riwayat Asesmen</h2>
              {attempts.length === 0 ? (
                <p className="text-xs text-[#64748b]">Belum ada asesmen yang dikerjakan.</p>
              ) : (
                <div className="space-y-2">
                  {attempts.map((a) => (
                    <div key={a.attemptId} className="flex items-center justify-between p-3 rounded-xl border border-[#e2e8f0]">
                      <div>
                        <p className="text-xs font-bold text-[#0f172a]">{a.title}</p>
                        <p className="text-[10px] text-[#64748b]">{TYPE_LABEL[a.type] ?? a.type} · bobot {a.weight}%</p>
                      </div>
                      <div className="text-right">
                        {a.score != null ? (
                          <span className="text-sm font-black text-[#007a5a]">{Number(a.score).toFixed(0)}<span className="text-[10px] text-slate-400">/100</span></span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#92400e]"><Clock className="h-3 w-3" /> {STATUS_LABEL[a.status] ?? a.status}</span>
                        )}
                        {a.submittedAt && <p className="text-[10px] text-[#94a3b8]">{new Date(a.submittedAt).toLocaleDateString('id-ID')}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
