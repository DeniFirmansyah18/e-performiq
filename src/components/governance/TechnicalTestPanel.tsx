'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  Wand2,
  ClipboardList,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';

interface Posting {
  id: string;
  postingTitle: string;
  status?: string;
  departmentName?: string;
  positionTitle?: string;
  requiredSkills?: string[];
}

interface DraftQuestion {
  id: string;
  order_index: number;
  type: string;
  prompt: string;
  options: { key: string; label: string }[] | null;
  correct_key: string | null;
  difficulty?: string | null;
  skill_tag?: string | null;
  source?: string | null;
  source_ref?: string | null;
}

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * Panel HR: Bank Soal Tes Teknis (AI, WS-4).
 *
 * Alur: pilih lowongan → "Generate soal (AI)" → daftar soal berstatus DRAFT
 * (`is_active = FALSE`) → HR menyetujui (approve) agar soal layak tampil ke
 * kandidat, atau menolak (reject). AI bersifat best-effort: kegagalan tidak
 * pernah membuat server error — pengisian manual tetap tersedia.
 */
export default function TechnicalTestPanel() {
  const [postings, setPostings] = useState<Posting[]>([]);
  const [positionId, setPositionId] = useState<string>('');
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [language, setLanguage] = useState<'id' | 'en'>('id');

  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);

  const loadPostings = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/recruitment/job-postings');
      if (!res.ok) {
        setErr(res.status === 403 ? 'Anda tidak berwenang melihat lowongan.' : 'Gagal memuat daftar lowongan.');
        return;
      }
      const json = await res.json();
      const list: Posting[] = json.data?.postings ?? [];
      setPostings(list);
      if (list[0]) setPositionId((prev) => prev || list[0].id);
    } catch {
      setErr('Gagal memuat daftar lowongan.');
    }
  }, []);

  const loadDrafts = useCallback(async (pid: string) => {
    if (!pid) {
      setDrafts([]);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/v1/recruitment/assessments/questions/drafts?positionId=${encodeURIComponent(pid)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(res.status === 403 ? 'Anda tidak berwenang melihat draft soal.' : json?.detail || 'Gagal memuat draft soal.');
        setDrafts([]);
        return;
      }
      setDrafts(json.data?.drafts ?? []);
    } catch {
      setErr('Gagal memuat draft soal.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPostings();
  }, [loadPostings]);

  useEffect(() => {
    loadDrafts(positionId);
  }, [positionId, loadDrafts]);

  const generate = async () => {
    if (!positionId) {
      setErr('Pilih lowongan terlebih dahulu.');
      return;
    }
    setGenerating(true);
    setMsg(null);
    setErr(null);
    setAiWarning(null);
    try {
      const res = await fetch('/api/v1/recruitment/assessments/generate-technical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId, count, difficulty, language }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.detail || 'Gagal membuat soal. Silakan coba lagi.');
        return;
      }
      const data = json.data ?? {};
      if (data.generated > 0) {
        setMsg(`${data.generated} soal draft berhasil dibuat. Tinjau & setujui sebelum dipakai kandidat.`);
      } else {
        setAiWarning(
          'AI tidak menghasilkan soal (mungkin belum dikonfigurasi atau gagal). Anda masih dapat menambah soal secara manual.',
        );
      }
      await loadDrafts(positionId);
    } catch {
      setErr('Gagal membuat soal. Silakan coba lagi.');
    } finally {
      setGenerating(false);
    }
  };

  const approve = async (id: string) => {
    setBusyId(id);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/v1/recruitment/assessments/questions/${id}/approve`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.detail || 'Gagal menyetujui soal.');
        return;
      }
      setMsg('Soal disetujui — kini layak tampil ke kandidat.');
      await loadDrafts(positionId);
    } catch {
      setErr('Gagal menyetujui soal.');
    } finally {
      setBusyId(null);
    }
  };

  const selectedPosting = postings.find((p) => p.id === positionId);

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#0f172a]">Bank Soal Tes Teknis (AI)</h3>
            <p className="text-[11px] text-[#64748b]">
              Generate soal MCQ teknis per posisi, tinjau, lalu setujui sebelum dipakai kandidat.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
          DRAFT → APPROVED
        </span>
      </div>

      {/* Kontrol generate */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="text-xs">
          <span className="block text-[#334155] font-medium mb-1">Lowongan / Posisi</span>
          <select
            value={positionId}
            onChange={(e) => setPositionId(e.target.value)}
            className="w-full rounded-lg border border-[#cbd5e1] px-2.5 py-2 text-xs bg-white"
          >
            <option value="">— Pilih lowongan —</option>
            {postings.map((p) => (
              <option key={p.id} value={p.id}>
                {p.postingTitle}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="block text-[#334155] font-medium mb-1">Jumlah soal</span>
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            className="w-full rounded-lg border border-[#cbd5e1] px-2.5 py-2 text-xs"
          />
        </label>

        <label className="text-xs">
          <span className="block text-[#334155] font-medium mb-1">Kesulitan</span>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className="w-full rounded-lg border border-[#cbd5e1] px-2.5 py-2 text-xs bg-white"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs">
          <span className="block text-[#334155] font-medium mb-1">Bahasa</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'id' | 'en')}
            className="w-full rounded-lg border border-[#cbd5e1] px-2.5 py-2 text-xs bg-white"
          >
            <option value="id">Indonesia</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          onClick={generate}
          disabled={generating || !positionId}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-white px-3.5 py-2 text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          {generating ? 'Membuat soal…' : 'Generate soal (AI)'}
        </button>
        <button
          onClick={() => loadDrafts(positionId)}
          disabled={loading || !positionId}
          className="inline-flex items-center gap-2 rounded-lg border border-[#cbd5e1] text-[#334155] px-3.5 py-2 text-xs font-medium hover:bg-[#f8fafc] disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" /> Muat ulang draft
        </button>
        <span className="text-[11px] text-[#64748b]">
          {selectedPosting?.requiredSkills?.length
            ? `Skill acuan: ${selectedPosting.requiredSkills.slice(0, 5).join(', ')}`
            : 'Skill acuan: dari judul lowongan'}
        </span>
      </div>

      {err && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-[#b91c1c] bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          <XCircle className="h-3.5 w-3.5" /> {err}
        </div>
      )}
      {msg && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5" /> {msg}
        </div>
      )}
      {aiWarning && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5" /> {aiWarning}
        </div>
      )}

      {/* Daftar draft */}
      <div className="mt-4 border-t border-[#f1f5f9] pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#0f172a]">Draft soal menunggu persetujuan</span>
          <span className="text-[10px] text-[#64748b]">{drafts.length} soal</span>
        </div>

        {loading ? (
          <div className="py-6 text-center text-xs text-[#64748b]">
            <Loader2 className="h-4 w-4 animate-spin inline-block" /> Memuat…
          </div>
        ) : drafts.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#94a3b8]">
            Belum ada draft. Pilih lowongan lalu klik “Generate soal (AI)”.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {drafts.map((q) => (
              <li key={q.id} className="rounded-xl border border-[#e2e8f0] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-[#0f172a] font-medium leading-relaxed">{q.prompt}</p>
                  <button
                    onClick={() => approve(q.id)}
                    disabled={busyId === q.id}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-2.5 py-1.5 text-[11px] font-semibold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busyId === q.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Setujui
                  </button>
                </div>

                {Array.isArray(q.options) && q.options.length > 0 && (
                  <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {q.options.map((o) => (
                      <li
                        key={o.key}
                        className={`text-[11px] rounded-md px-2 py-1 border ${
                          q.correct_key && o.key === q.correct_key
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-[#f1f5f9] text-[#475569]'
                        }`}
                      >
                        <span className="font-semibold">{o.key}.</span> {o.label}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-2 flex items-center gap-2 flex-wrap text-[10px] text-[#64748b]">
                  <span className="px-1.5 py-0.5 rounded bg-[#f1f5f9]">{q.type}</span>
                  {q.difficulty && <span className="px-1.5 py-0.5 rounded bg-[#f1f5f9]">{q.difficulty}</span>}
                  {q.skill_tag && <span className="px-1.5 py-0.5 rounded bg-[#f1f5f9]">🏷 {q.skill_tag}</span>}
                  {q.source && <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{q.source}</span>}
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">DRAFT</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
