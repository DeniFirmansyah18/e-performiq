'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle2, PlayCircle, FileText, HelpCircle } from 'lucide-react';

interface ModuleItem { id: string; title: string; orderIndex: number; contentType: 'TEXT' | 'VIDEO' | 'PDF' | 'QUIZ'; completed: boolean }
interface Lesson { id: string; title: string; contentType: string; contentUrl?: string; contentBody?: string; quizKey?: Array<{ q: number; a: number }> }

/**
 * Lesson viewer: daftar modul + isi lesson + aksi "Tandai selesai" / kuis.
 * Memakai /api/v1/learning/courses/:id/modules, /modules/:id, /complete, /quiz.
 */
export default function LessonViewerModal({ courseId, courseTitle, onClose, onChanged }: {
  courseId: number; courseTitle: string; onClose: () => void; onChanged?: () => void;
}) {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadModules = useCallback(async () => {
    const res = await fetch(`/api/v1/learning/courses/${courseId}/modules`);
    if (res.ok) setModules((await res.json()).data.modules ?? []);
  }, [courseId]);

  useEffect(() => { loadModules(); }, [loadModules]);

  const openLesson = async (moduleId: string) => {
    setLesson(null); setAnswers([]); setMsg(null);
    const res = await fetch(`/api/v1/learning/modules/${moduleId}`);
    if (res.ok) setLesson((await res.json()).data);
  };

  const complete = async () => {
    if (!lesson) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/learning/modules/${lesson.id}/complete`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? (j?.data?.certificate ? 'Modul selesai — sertifikat terbit!' : 'Modul ditandai selesai.') : 'Gagal menyimpan.');
      await loadModules();
      onChanged?.();
    } finally { setBusy(false); }
  };

  const submitQuiz = async () => {
    if (!lesson) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/learning/modules/${lesson.id}/quiz`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }),
      });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? (j?.data?.passed ? `Kuis lulus (skor ${j.data.score}).` : `Kuis belum lulus (skor ${j.data?.score ?? 0}).`) : 'Gagal mengirim kuis.');
      await loadModules();
      onChanged?.();
    } finally { setBusy(false); }
  };

  const icon = (t: string) => t === 'VIDEO' ? <PlayCircle className="h-3.5 w-3.5 text-[#0284c7]" /> : t === 'QUIZ' ? <HelpCircle className="h-3.5 w-3.5 text-[#b45309]" /> : <FileText className="h-3.5 w-3.5 text-[#007a5a]" />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] p-4 sticky top-0 bg-white">
          <h3 className="text-sm font-extrabold text-[#0f172a]">{courseTitle}</h3>
          <button onClick={onClose} className="text-[#64748b] hover:text-[#0f172a]"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
          {/* Module list */}
          <div className="md:col-span-2 border-r border-[#e2e8f0] p-3 space-y-1">
            {modules.map((m, i) => (
              <button key={m.id} onClick={() => openLesson(m.id)}
                className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs hover:bg-[#f8fafc]">
                <span className="text-[10px] font-bold text-[#64748b] w-4">{i + 1}</span>
                {icon(m.contentType)}
                <span className="flex-1 font-semibold text-[#0f172a] truncate">{m.title}</span>
                {m.completed && <CheckCircle2 className="h-3.5 w-3.5 text-[#137333]" />}
              </button>
            ))}
          </div>

          {/* Lesson body */}
          <div className="md:col-span-3 p-4 space-y-3">
            {!lesson ? (
              <p className="text-xs text-[#64748b]">Pilih modul untuk mulai belajar.</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  {icon(lesson.contentType)}
                  <h4 className="text-xs font-bold text-[#0f172a]">{lesson.title}</h4>
                </div>
                {lesson.contentType === 'TEXT' && <p className="text-xs text-[#334155] leading-relaxed">{lesson.contentBody}</p>}
                {lesson.contentType === 'VIDEO' && lesson.contentUrl && (
                  <video controls className="w-full rounded-lg" src={lesson.contentUrl} />
                )}
                {lesson.contentType === 'PDF' && lesson.contentUrl && (
                  <a href={lesson.contentUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#0284c7] underline">Buka materi PDF</a>
                )}
                {lesson.contentType === 'QUIZ' && (
                  <div className="space-y-2">
                    {(lesson.quizKey ?? []).map((q, idx) => (
                      <div key={idx} className="text-xs">
                        <p className="font-semibold text-[#0f172a]">Soal {q.q}</p>
                        <div className="flex gap-3 mt-1">
                          {[0, 1, 2].map((opt) => (
                            <label key={opt} className="flex items-center gap-1">
                              <input type="radio" name={`q${q.q}`} checked={answers[idx] === opt}
                                onChange={() => { const a = [...answers]; a[idx] = opt; setAnswers(a); }} />
                              <span>Opsi {opt + 1}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {msg && <p className="text-[11px] font-semibold text-[#137333]">{msg}</p>}

                <div className="pt-2">
                  {lesson.contentType === 'QUIZ' ? (
                    <button onClick={submitQuiz} disabled={busy}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-[#007a5a] rounded-lg hover:bg-[#006347] disabled:opacity-60">
                      Kirim Jawaban
                    </button>
                  ) : (
                    <button onClick={complete} disabled={busy}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-[#007a5a] rounded-lg hover:bg-[#006347] disabled:opacity-60">
                      Tandai Selesai
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
