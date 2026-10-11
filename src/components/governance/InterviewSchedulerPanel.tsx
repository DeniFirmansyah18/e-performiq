'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Video, CheckCircle2, XCircle, Clock, Loader2, ExternalLink, ClipboardCheck } from 'lucide-react';

interface CandidateRow {
  id: string; applicationNo: string; status: string;
  fullName: string; email: string; postingTitle: string;
}

interface InterviewRow {
  id: string; applicationId: string; scheduledAt: string; meetingUrl: string | null;
  durationMinutes: number | null; status: string; score: number | null; notes: string | null;
  interviewerName: string | null;
}

type RubricKey = 'technical_skill' | 'problem_solving' | 'communication' | 'collaboration' | 'motivation' | 'leadership' | 'professionalism';

interface InterviewEvaluationDto {
  applicationId: string;
  scores: Record<RubricKey, number | null>;
  compositeScore: number | null;
  strengths: string | null;
  concerns: string | null;
  notes: string | null;
  recommendation: string | null;
  updatedAt: string | null;
}

const RUBRIC: { key: RubricKey; label: string }[] = [
  { key: 'technical_skill', label: 'Kompetensi Teknis / Keahlian' },
  { key: 'problem_solving', label: 'Pemecahan Masalah / Analytical Thinking' },
  { key: 'communication', label: 'Komunikasi & Kejelasan' },
  { key: 'collaboration', label: 'Kolaborasi / Team Fit' },
  { key: 'motivation', label: 'Motivasi & Culture Fit' },
  { key: 'leadership', label: 'Kepemimpinan / Potensi' },
  { key: 'professionalism', label: 'Sikap & Profesionalisme' },
];

/**
 * Form penilaian wawancara terstruktur (rubrik 7 kriteria, skala 1–5).
 * Menyimpan via POST /api/v1/recruitment/interviews/score.
 */
function InterviewEvaluationForm({ applicationId, evaluation, onSaved }: {
  applicationId: string;
  evaluation: InterviewEvaluationDto | null;
  onSaved: () => void;
}) {
  const [scores, setScores] = useState<Record<RubricKey, number>>(() => {
    const init = {} as Record<RubricKey, number>;
    RUBRIC.forEach((c) => { init[c.key] = evaluation?.scores?.[c.key] ?? 0; });
    return init;
  });
  const [strengths, setStrengths] = useState(evaluation?.strengths ?? '');
  const [concerns, setConcerns] = useState(evaluation?.concerns ?? '');
  const [notes, setNotes] = useState(evaluation?.notes ?? '');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Sinkronkan bila kandidat terpilih berganti atau data dimuat ulang.
  useEffect(() => {
    const init = {} as Record<RubricKey, number>;
    RUBRIC.forEach((c) => { init[c.key] = evaluation?.scores?.[c.key] ?? 0; });
    setScores(init);
    setStrengths(evaluation?.strengths ?? '');
    setConcerns(evaluation?.concerns ?? '');
    setNotes(evaluation?.notes ?? '');
    setDone(false); setFormErr(null);
  }, [applicationId, evaluation]);

  const scored = RUBRIC.map((c) => scores[c.key]).filter((v) => v >= 1);
  const composite = scored.length
    ? Math.round(((scored.reduce((a, b) => a + b, 0) / scored.length - 1) / 4) * 100)
    : null;

  const submit = async () => {
    setBusy(true); setFormErr(null); setDone(false);
    try {
      const rubric: Record<string, number | null> = {};
      RUBRIC.forEach((c) => { rubric[c.key] = scores[c.key] >= 1 ? scores[c.key] : null; });
      const res = await fetch('/api/v1/recruitment/interviews/score', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          rubric,
          strengths: strengths.trim() || undefined,
          concerns: concerns.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setFormErr(j?.detail || 'Gagal menyimpan penilaian.');
        return;
      }
      setDone(true);
      onSaved();
    } catch {
      setFormErr('Gagal menyimpan penilaian.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#e2e8f0] p-3">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left">
        <span className="flex items-center gap-1.5">
          <ClipboardCheck className="h-3.5 w-3.5 text-[#0f766e]" />
          <span className="text-[11px] font-bold text-[#0f172a]">Penilaian Wawancara (Rubrik)</span>
          {evaluation?.compositeScore != null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#e6f4ea] text-[#137333] font-bold">
              Skor {evaluation.compositeScore.toFixed(0)}
            </span>
          )}
        </span>
        <span className="text-[10px] text-[#64748b]">{open ? 'Tutup ▲' : 'Buka ▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-[10px] text-[#64748b]">
            Nilai tiap kriteria (1–5). Rata-rata otomatis dikonversi ke skor 0–100 dan
            diumpankan ke analisis Review (agregat asesmen 30/40/30). Skala: 1 = jauh di
            bawah ekspektasi, 5 = jauh di atas ekspektasi.
          </p>
          <div className="space-y-2">
            {RUBRIC.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3">
                <label className="text-[11px] text-[#334155] flex-1">{c.label}</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button"
                      onClick={() => setScores((s) => ({ ...s, [c.key]: n }))}
                      aria-label={`${c.label} = ${n}`}
                      className={`h-7 w-7 rounded-lg text-[11px] font-bold border transition ${
                        scores[c.key] === n
                          ? 'bg-[#0f172a] text-white border-[#0f172a]'
                          : 'bg-white text-[#334155] border-[#e2e8f0] hover:border-[#94a3b8]'
                      }`}>{n}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[#f8fafc] px-3 py-2">
            <span className="text-[10px] text-[#64748b]">Skor komposit (otomatis)</span>
            <span className="text-sm font-black text-[#0f172a]">{composite != null ? `${composite}/100` : '–'}</span>
          </div>
          <div className="space-y-2">
            <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2}
              placeholder="Kekuatan kandidat (opsional)"
              className="w-full rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-[11px] text-black" />
            <textarea value={concerns} onChange={(e) => setConcerns(e.target.value)} rows={2}
              placeholder="Area perhatian / kekhawatiran (opsional)"
              className="w-full rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-[11px] text-black" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Catatan wawancara tambahan (opsional)"
              className="w-full rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-[11px] text-black" />
          </div>
          {formErr && <p className="text-[10px] font-semibold text-[#b91c1c]">{formErr}</p>}
          {done && <p className="text-[10px] font-semibold text-[#137333]">Penilaian tersimpan. Analisis Review diperbarui.</p>}
          <button type="button" disabled={busy || composite == null} onClick={submit}
            className="w-full py-2 rounded-lg bg-[#007a5a] text-white text-xs font-bold hover:bg-[#006347] disabled:opacity-50">
            {busy ? 'Menyimpan…' : 'Simpan Penilaian Wawancara'}
          </button>
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Terjadwal', DONE: 'Selesai', CANCELED: 'Dibatalkan',
};
const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: 'bg-amber-50 text-amber-700 border-amber-200',
  DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELED: 'bg-slate-100 text-slate-600 border-slate-200',
};

/**
 * Panel penjadwalan wawancara (HR): buat tautan rapat untuk kandidat yang telah
 * lolos seleksi (SCREENING/INTERVIEW), lalu tandai selesai setelah wawancara.
 */
export default function InterviewSchedulerPanel() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<InterviewEvaluationDto | null>(null);

  const [form, setForm] = useState({
    scheduledAt: '',
    durationMinutes: '45',
    meetingUrl: '',
    interviewerUserId: '',
  });

  const schedulable = candidates.filter((c) => c.status === 'SCREENING' || c.status === 'INTERVIEW');

  const loadCandidates = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/recruitment/candidates');
      if (!res.ok) return;
      const json = await res.json();
      setCandidates(json.data.candidates ?? []);
    } catch { /* abaikan */ } finally {
      setLoading(false);
    }
  }, []);

  const loadInterviews = useCallback(async (applicationId: string) => {
    if (!applicationId) { setInterviews([]); return; }
    try {
      const res = await fetch(`/api/v1/recruitment/interviews?applicationId=${applicationId}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInterviews([]);
        setErrMsg(json?.detail || 'Gagal memuat daftar jadwal wawancara.');
        return;
      }
      setInterviews(json.data?.interviews ?? []);
    } catch (err: any) {
      setInterviews([]);
      setErrMsg(`Gagal memuat jadwal: ${err?.message ?? 'kesalahan jaringan'}`);
    }
  }, []);

  // Ambil penilaian rubrik existing untuk kandidat terpilih (dari kartu Review).
  const loadEvaluation = useCallback(async (applicationId: string) => {
    if (!applicationId) { setEvaluation(null); return; }
    try {
      const res = await fetch(`/api/v1/recruitment/candidates/${applicationId}/review`);
      const json = await res.json().catch(() => ({}));
      setEvaluation(res.ok ? (json?.data?.interviewEvaluation ?? null) : null);
    } catch {
      setEvaluation(null);
    }
  }, []);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);
  useEffect(() => { loadInterviews(selectedId); loadEvaluation(selectedId); }, [selectedId, loadInterviews, loadEvaluation]);

  useEffect(() => {
    const onChange = () => {
      loadCandidates();
      if (selectedId) { loadInterviews(selectedId); loadEvaluation(selectedId); }
    };
    window.addEventListener('recruitment:candidates-changed', onChange);
    return () => window.removeEventListener('recruitment:candidates-changed', onChange);
  }, [loadCandidates, loadInterviews, loadEvaluation, selectedId]);

  // Bila kandidat terpilih tidak lagi berstatus SCREENING/INTERVIEW (mis. HR
  // mengubahnya ke REJECTED), bersihkan pilihan agar dropdown tetap konsisten.
  useEffect(() => {
    if (!selectedId) return;
    const stillSchedulable = candidates.some(
      (c) => c.id === selectedId && (c.status === 'SCREENING' || c.status === 'INTERVIEW'),
    );
    if (!stillSchedulable && candidates.length > 0) setSelectedId('');
  }, [candidates, selectedId]);

  const generateRoom = async () => {
    setBusy(true); setMsg(null); setErrMsg(null);
    try {
      const res = await fetch('/api/v1/recruitment/interviews/generate-room', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErrMsg(json?.detail || 'Gagal membuat tautan ruang.'); return; }
      const url = json?.data?.meetingUrl as string | undefined;
      if (url) setForm((f) => ({ ...f, meetingUrl: url }));
      setMsg(
        json?.data?.provider === 'GOOGLE_MEET_API'
          ? 'Ruang Google Meet dibuat dan diisi otomatis.'
          : 'Tautan ruang dibuat (mode fallback) dan diisi otomatis.',
      );
    } catch (err: any) {
      setErrMsg(`Gagal membuat tautan ruang: ${err?.message ?? 'kesalahan jaringan'}`);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) { setMsg('Pilih kandidat terlebih dahulu.'); return; }
    if (!form.scheduledAt) { setMsg('Isi tanggal & waktu wawancara.'); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/v1/recruitment/interviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: selectedId,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          meetingUrl: form.meetingUrl || undefined,
          durationMinutes: Number(form.durationMinutes) || 45,
          interviewerUserId: form.interviewerUserId || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErrMsg(json?.detail || 'Gagal membuat jadwal.'); return; }

      // Pindahkan lamaran ke tahap INTERVIEW + notifikasi kandidat.
      await fetch(`/api/v1/recruitment/candidates/${selectedId}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INTERVIEW' }),
      });

      setMsg('Jadwal wawancara dibuat. Kandidat menerima tautan melalui notifikasi.');
      setForm({ scheduledAt: '', durationMinutes: '45', meetingUrl: '', interviewerUserId: '' });
      await loadInterviews(selectedId);
      await loadCandidates();
      window.dispatchEvent(new Event('recruitment:candidates-changed'));
    } catch (err: any) {
      setErrMsg(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const markDone = async (id: string, status: 'DONE' | 'CANCELED') => {
    setBusy(true); setMsg(null); setErrMsg(null);
    try {
      const res = await fetch(`/api/v1/recruitment/interviews/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { setErrMsg('Gagal memperbarui jadwal.'); return; }
      setMsg(status === 'DONE' ? 'Wawancara ditandai selesai.' : 'Wawancara dibatalkan.');
      await loadInterviews(selectedId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="stitch-card-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-[#007a5a]" />
        <h2 className="text-sm font-extrabold text-[#0f172a]">Jadwal Wawancara</h2>
        <span className="text-[11px] text-[#64748b]">Buat tautan rapat & tandai selesai</span>
      </div>

      {msg && <div className="text-xs text-[#047857] bg-[#ecfdf5] px-3 py-2 rounded-lg">{msg}</div>}
      {errMsg && <div className="text-xs text-[#b91c1c] bg-[#fef2f2] px-3 py-2 rounded-lg">{errMsg}</div>}

      {/* Form penjadwalan */}
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-[11px] font-semibold text-[#334155] space-y-1">
          Kandidat (SCREENING/INTERVIEW)
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
          >
            <option value="">— pilih kandidat —</option>
            {schedulable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} · {c.applicationNo} ({c.status})
              </option>
            ))}
          </select>
        </label>

        <label className="text-[11px] font-semibold text-[#334155] space-y-1">
          Tanggal & Waktu
          <input
            type="datetime-local" required value={form.scheduledAt}
            onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
          />
        </label>

        <label className="text-[11px] font-semibold text-[#334155] space-y-1">
          Durasi (menit)
          <input
            type="number" min={15} max={240} value={form.durationMinutes}
            onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
          />
        </label>

        <label className="text-[11px] font-semibold text-[#334155] space-y-1">
          Tautan Meeting (Zoom/Meet)
          <div className="flex gap-2">
            <input
              type="url" value={form.meetingUrl} placeholder="https://meet.google.com/..."
              onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] bg-white text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#007a5a]"
            />
            <button type="button" onClick={generateRoom}
              className="px-3 py-2 rounded-lg border border-[#cbd5e1] bg-white text-[11px] font-medium text-[#334155] hover:bg-[#f8fafc] whitespace-nowrap">
              <Video className="h-3.5 w-3.5 inline mr-1" /> Buat Ruang
            </button>
          </div>
        </label>

        <div className="md:col-span-2 flex justify-end">
          <button type="submit" disabled={busy || !selectedId}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
            Jadwalkan Wawancara
          </button>
        </div>
      </form>

      {/* Daftar jadwal */}
      {selectedId && (
        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Jadwal kandidat ini</p>
          {interviews.length === 0 ? (
            <p className="text-xs text-[#64748b]">Belum ada jadwal.</p>
          ) : (
            interviews.map((iv) => (
              <div key={iv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-[#e2e8f0]">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[iv.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      <Clock className="h-3 w-3" /> {STATUS_LABEL[iv.status] ?? iv.status}
                    </span>
                    <span className="text-[11px] text-[#334155]">
                      {new Date(iv.scheduledAt).toLocaleString('id-ID')} · {iv.durationMinutes ?? 45} mnt
                      {iv.interviewerName ? ` · ${iv.interviewerName}` : ''}
                    </span>
                  </div>
                  {iv.meetingUrl && (
                    <a href={iv.meetingUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#007a5a] hover:underline">
                      <ExternalLink className="h-3 w-3" /> {iv.meetingUrl}
                    </a>
                  )}
                  {iv.score != null && <p className="text-[11px] text-[#64748b]">Skor: {Number(iv.score).toFixed(0)}</p>}
                </div>
                {iv.status === 'SCHEDULED' && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => markDone(iv.id, 'DONE')} disabled={busy}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-[11px] font-semibold disabled:opacity-50">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Tandai Selesai
                    </button>
                    <button onClick={() => markDone(iv.id, 'CANCELED')} disabled={busy}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-[#334155] text-[11px] font-medium hover:bg-[#f8fafc] disabled:opacity-50">
                      <XCircle className="h-3.5 w-3.5" /> Batalkan
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {selectedId && (
        <InterviewEvaluationForm
          applicationId={selectedId}
          evaluation={evaluation}
          onSaved={() => loadEvaluation(selectedId)}
        />
      )}

      {!loading && schedulable.length === 0 && (
        <p className="text-[11px] text-[#64748b]">Belum ada kandidat pada tahap SCREENING/INTERVIEW. Ubah status pelamar menjadi SCREENING terlebih dahulu.</p>
      )}
    </section>
  );
}
