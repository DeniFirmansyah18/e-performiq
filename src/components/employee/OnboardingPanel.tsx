'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  GraduationCap, CheckCircle2, Circle, Award, RefreshCw, Play,
  ChevronDown, ChevronRight, FileText, HelpCircle, ExternalLink, Loader2,
} from 'lucide-react';

interface OnboardingItem {
  courseId: number;
  courseCode: string;
  title: string;
  isMandatory: boolean;
  enrolled: boolean;
  completionPct: number;
  completionState: string | null;
  certified: boolean;
  verificationCode: string | null;
}
interface OnboardingStatus {
  employeeId: string;
  programId: string | null;
  positionTitle: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'WAIVED';
  totalMandatory: number;
  completedMandatory: number;
  progressPct: number;
  items: OnboardingItem[];
}
interface ModuleItem {
  id: string;
  title: string;
  orderIndex: number;
  contentType: 'TEXT' | 'VIDEO' | 'PDF' | 'QUIZ';
  completed: boolean;
}
interface QuizQuestion {
  text: string;
  options: string[];
}

/**
 * Panel Onboarding LMS (WS-8) — program onboarding per-posisi untuk karyawan.
 * Kursus onboarding bersifat NYATA: karyawan harus membuka setiap modul dan
 * menyelesaikan materi/kuis (dinilai server-side) sebelum sertifikat terbit.
 */
export default function OnboardingPanel() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [openCourse, setOpenCourse] = useState<number | null>(null);
  const [modules, setModules] = useState<Record<number, ModuleItem[]>>({});
  const [loadingModules, setLoadingModules] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/learning/onboarding');
      const j = await res.json().catch(() => ({}));
      setStatus(res.ok ? (j.data as OnboardingStatus) : null);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setBusy(true); setMsg(null);
    const res = await fetch('/api/v1/learning/onboarding', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate' }),
    });
    const j = await res.json().catch(() => ({}));
    setMsg(res.ok ? `Program onboarding dibuat (${j.data.enrolled ?? 0} kursus didaftarkan).` : (j?.detail || 'Gagal membuat program.'));
    setBusy(false); await load();
  };

  const refresh = async () => {
    setBusy(true); setMsg(null);
    const res = await fetch('/api/v1/learning/onboarding', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      const issued = j.data.issuedCertificates?.length ?? 0;
      setMsg(issued > 0 ? `Onboarding selesai! ${issued} e-sertifikat diterbitkan.` : 'Status diperbarui.');
    } else setMsg(j?.detail || 'Gagal memperbarui status.');
    setBusy(false); await load();
  };

  const loadModules = useCallback(async (courseId: number) => {
    setLoadingModules(courseId);
    try {
      const res = await fetch(`/api/v1/learning/courses/${courseId}/modules`);
      const j = await res.json().catch(() => ({}));
      if (res.ok) setModules((prev) => ({ ...prev, [courseId]: j.data.modules as ModuleItem[] }));
    } finally {
      setLoadingModules(null);
    }
  }, []);

  const toggleCourse = async (item: OnboardingItem) => {
    if (openCourse === item.courseId) { setOpenCourse(null); return; }
    setOpenCourse(item.courseId);
    if (!modules[item.courseId]) await loadModules(item.courseId);
  };

  // Setelah modul/kuis selesai: segarkan status onboarding (memicu sertifikat bila tuntas).
  const afterCompletion = async () => {
    await fetch('/api/v1/learning/onboarding', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }),
    });
    await load();
  };

  const completeText = async (courseId: number, moduleId: string) => {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/v1/learning/modules/${moduleId}/complete`, { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg(j?.data?.certificate ? 'Modul selesai — e-sertifikat kursus diterbitkan!' : 'Modul ditandai selesai.');
      await loadModules(courseId);
      await afterCompletion();
    } else setMsg(j?.detail || 'Gagal menyelesaikan modul.');
    setBusy(false);
  };

  const submitQuiz = async (courseId: number, moduleId: string, answers: number[]) => {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/v1/learning/modules/${moduleId}/quiz`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      const d = j.data ?? {};
      setMsg(d.passed ? `Kuis lulus (skor ${d.score}).` : `Kuis belum lulus (skor ${d.score}). Coba lagi.`);
      if (d.passed) { await loadModules(courseId); await afterCompletion(); }
    } else setMsg(j?.detail || 'Gagal mengirim kuis.');
    setBusy(false);
  };

  if (loading) return <div className="stitch-card-white p-6 text-xs text-[#64748b]">Memuat onboarding…</div>;

  return (
    <div className="stitch-card-white p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
        <div className="flex items-center gap-2.5">
          <GraduationCap className="h-4 w-4 text-[#007a5a]" />
          <h2 className="text-base font-extrabold text-[#0f172a]">Onboarding</h2>
          {status?.status === 'COMPLETED' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#e6f4ea] text-[#137333]">Selesai</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button disabled={busy} onClick={refresh}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-[#334155] text-[11px] font-semibold hover:bg-slate-200 disabled:opacity-50">
            <RefreshCw className="h-3 w-3" /> Segarkan
          </button>
          {!status?.programId && (
            <button disabled={busy} onClick={generate}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0f172a] text-white text-[11px] font-semibold hover:bg-[#1e293b] disabled:opacity-50">
              <Play className="h-3 w-3" /> Mulai Program
            </button>
          )}
        </div>
      </div>

      {msg && <p className="text-[11px] font-semibold text-[#047857]">{msg}</p>}

      {!status || status.items.length === 0 ? (
        <p className="text-xs text-[#64748b]">Belum ada kurikulum onboarding untuk posisi Anda. Klik &quot;Mulai Program&quot; atau hubungi HR.</p>
      ) : (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#64748b]">{status.positionTitle} · {status.completedMandatory}/{status.totalMandatory} kursus wajib selesai</span>
              <span className="font-bold text-[#0f172a]">{status.progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#e2e8f0] overflow-hidden">
              <div className="h-full bg-[#007a5a] transition-all" style={{ width: `${status.progressPct}%` }} />
            </div>
          </div>

          <div className="space-y-2">
            {status.items.map((item) => {
              const done = item.completionState === 'COMPLETE';
              const isOpen = openCourse === item.courseId;
              return (
                <div key={item.courseId} className="rounded-xl border border-[#e2e8f0] overflow-hidden">
                  <button disabled={!item.enrolled} onClick={() => toggleCourse(item)}
                    className="w-full flex items-center justify-between p-3 text-left disabled:opacity-40 hover:bg-[#f8fafc]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {done ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" /> : <Circle className="h-4 w-4 text-[#cbd5e1] flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#0f172a] truncate">{item.title}</p>
                        <p className="text-[10px] text-[#64748b]">
                          {item.courseCode}
                          {item.isMandatory ? ' · Wajib' : ' · Opsional'}
                          {item.certified && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-emerald-600">
                              <Award className="h-3 w-3" /> Bersertifikat
                            </span>
                          )}
                          {item.verificationCode && (
                            <a
                              href={`/api/v1/certificates/verify/${item.verificationCode}/pdf`}
                              download={`sertifikat-${item.verificationCode}.pdf`}
                              onClick={(e) => e.stopPropagation()}
                              className="ml-1 font-semibold text-[#047857] underline"
                            >
                              Unduh PDF
                            </a>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] font-semibold text-[#334155]">{done ? 'Selesai' : `${item.completionPct ?? 0}%`}</span>
                      {item.enrolled && (isOpen ? <ChevronDown className="h-4 w-4 text-[#64748b]" /> : <ChevronRight className="h-4 w-4 text-[#64748b]" />)}
                    </div>
                  </button>

                  {isOpen && item.enrolled && (
                    <div className="border-t border-[#f1f5f9] bg-[#fbfdfc] p-3 space-y-2">
                      {loadingModules === item.courseId && (
                        <p className="text-[11px] text-[#64748b] inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Memuat modul…</p>
                      )}
                      {(modules[item.courseId] ?? []).map((m) => (
                        <ModuleView key={m.id} module={m} busy={busy}
                          onComplete={() => completeText(item.courseId, m.id)}
                          onSubmitQuiz={(answers) => submitQuiz(item.courseId, m.id, answers)} />
                      ))}
                      {loadingModules !== item.courseId && (modules[item.courseId] ?? []).length === 0 && (
                        <p className="text-[11px] text-[#94a3b8]">Kursus ini belum memiliki modul.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** Satu modul: materi teks/tautan atau kuis yang harus dikerjakan. */
function ModuleView({
  module, busy, onComplete, onSubmitQuiz,
}: {
  module: ModuleItem;
  busy: boolean;
  onComplete: () => void;
  onSubmitQuiz: (answers: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [lesson, setLesson] = useState<{ contentBody: string | null; contentUrl: string | null; contentType: string } | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const openLesson = async () => {
    setOpen((v) => !v);
    if (!lesson) {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/learning/modules/${module.id}`);
        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          const d = j.data ?? {};
          setLesson({ contentBody: d.contentBody ?? null, contentUrl: d.contentUrl ?? null, contentType: d.contentType });
          if (d.contentType === 'QUIZ' && d.contentBody) {
            const parsed = safeQuestions(d.contentBody);
            setAnswers(new Array(parsed.length).fill(-1));
          }
        }
      } finally { setLoading(false); }
    }
  };

  const questions = module.contentType === 'QUIZ' && lesson?.contentBody ? safeQuestions(lesson.contentBody) : [];
  const icon = module.contentType === 'QUIZ'
    ? <HelpCircle className="h-3.5 w-3.5 text-[#b45309]" />
    : <FileText className="h-3.5 w-3.5 text-[#0369a1]" />;

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white">
      <button onClick={openLesson} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#f8fafc]">
        <span className="flex items-center gap-2 min-w-0">
          {module.completed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" /> : <Circle className="h-3.5 w-3.5 text-[#cbd5e1] flex-shrink-0" />}
          {icon}
          <span className="text-[11px] font-semibold text-[#0f172a] truncate">{module.orderIndex}. {module.title}</span>
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {module.completed && <span className="text-[10px] font-bold text-emerald-600">Selesai</span>}
          {open ? <ChevronDown className="h-3.5 w-3.5 text-[#94a3b8]" /> : <ChevronRight className="h-3.5 w-3.5 text-[#94a3b8]" />}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-[#f1f5f9]">
          {loading && <p className="text-[11px] text-[#64748b] pt-2 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Memuat materi…</p>}

          {!loading && module.contentType !== 'QUIZ' && (
            <>
              {lesson?.contentBody && <p className="text-[11px] text-[#334155] leading-relaxed pt-2 whitespace-pre-line">{lesson.contentBody}</p>}
              {lesson?.contentUrl && (
                <a href={lesson.contentUrl} target="_blank" rel="noreferrer" className="text-[11px] text-[#0369a1] inline-flex items-center gap-1 hover:underline">
                  <ExternalLink className="h-3 w-3" /> Buka materi
                </a>
              )}
              {!module.completed && (
                <button disabled={busy} onClick={onComplete}
                  className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#007a5a] text-white text-[11px] font-semibold hover:bg-[#006347] disabled:opacity-50">
                  <CheckCircle2 className="h-3 w-3" /> Tandai Modul Selesai
                </button>
              )}
            </>
          )}

          {!loading && module.contentType === 'QUIZ' && (
            <div className="pt-2 space-y-3">
              {questions.length === 0 && <p className="text-[11px] text-[#94a3b8]">Soal kuis tidak tersedia.</p>}
              {questions.map((q, qi) => (
                <div key={qi} className="space-y-1">
                  <p className="text-[11px] font-semibold text-[#0f172a]">{qi + 1}. {q.text}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {q.options.map((opt, oi) => {
                      const active = answers[qi] === oi;
                      return (
                        <button key={oi} type="button" disabled={module.completed}
                          onClick={() => setAnswers((prev) => { const n = [...prev]; n[qi] = oi; return n; })}
                          className={`px-2 py-1 rounded-md text-[11px] border ${active ? 'bg-[#0f172a] text-white border-[#0f172a]' : 'bg-white text-[#334155] border-[#e2e8f0] hover:border-[#94a3b8]'}`}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {questions.length > 0 && !module.completed && (
                <button disabled={busy || answers.some((a) => a < 0)} onClick={() => onSubmitQuiz(answers)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0f172a] text-white text-[11px] font-semibold hover:bg-[#1e293b] disabled:opacity-50">
                  Kirim Jawaban
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Parse soal kuis dari content_body (JSON {questions}) dengan aman. */
function safeQuestions(body: string): QuizQuestion[] {
  try {
    const parsed = JSON.parse(body);
    const qs = parsed?.questions;
    if (!Array.isArray(qs)) return [];
    return qs
      .filter((q: any) => typeof q?.text === 'string' && Array.isArray(q?.options))
      .map((q: any) => ({ text: q.text as string, options: (q.options as any[]).filter((o) => typeof o === 'string') as string[] }));
  } catch {
    return [];
  }
}
