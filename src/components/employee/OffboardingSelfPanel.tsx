'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LogOut, ClipboardCheck, CheckCircle2, Clock, Star, Send, Loader2 } from 'lucide-react';

interface Handover { id: string; itemName: string; category: string; isVerified: boolean; notes: string | null }
interface RequestInfo { id: string; reasonForLeaving: string; resignationNoticeDate: string; lastWorkingDay: string; status: string; createdAt: string }
interface OffboardingData {
  request: RequestInfo | null;
  handovers: Handover[];
  handoverProgress: number;
  severance: { serviceYears: number; baseSalary: number; totalDisbursement: number; isPaid: boolean } | null;
  exitInterview: { feedback: string; overallRating: number | null; wouldRecommend: boolean | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  INITIATED: 'Dimulai', CLEARANCE_IN_PROGRESS: 'Proses Serah Terima', COMPLETED: 'Selesai', DISPUTED: 'Disengketakan',
};

/** Panel self-service fase "Setelah Kerja": resign, serah terima, exit interview (read & write). */
export default function OffboardingSelfPanel() {
  const [data, setData] = useState<OffboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState({ reasonForLeaving: 'Resign', resignationNoticeDate: '', lastWorkingDay: '' });
  const [exit, setExit] = useState({ feedback: '', overallRating: 5, wouldRecommend: true });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/offboarding/me');
      const j = await res.json().catch(() => ({}));
      if (res.ok) setData(j.data as OffboardingData);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submitResign = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/v1/offboarding/me', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? 'Pengajuan resign berhasil dikirim.' : (j?.detail || 'Gagal mengajukan resign.'));
      if (res.ok) load();
    } finally { setBusy(false); }
  };

  const markHandover = async (id: string) => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/v1/offboarding/me/handover/${id}`, { method: 'PATCH' });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? 'Item serah terima ditandai siap.' : (j?.detail || 'Gagal menandai item.'));
      if (res.ok) load();
    } finally { setBusy(false); }
  };

  const submitExit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/v1/offboarding/me/exit-interview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: exit.feedback, overallRating: Number(exit.overallRating), wouldRecommend: exit.wouldRecommend }),
      });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? 'Exit interview tersimpan. Terima kasih.' : (j?.detail || 'Gagal menyimpan exit interview.'));
      if (res.ok) load();
    } finally { setBusy(false); }
  };

  if (loading) return <div className="stitch-card-white p-6 text-xs text-[#64748b]">Memuat data offboarding…</div>;

  return (
    <section className="stitch-card-white p-6 space-y-4">
      <div className="flex items-center gap-2 border-b border-[#f1f5f9] pb-3">
        <LogOut className="h-4 w-4 text-[#007a5a]" />
        <h2 className="text-base font-extrabold text-[#0f172a]">Offboarding &amp; Serah Terima</h2>
        {data?.request && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#f1f5f9] text-[#475569]">
            {STATUS_LABEL[data.request.status] ?? data.request.status}
          </span>
        )}
      </div>

      {msg && <p className="text-[11px] font-semibold text-[#047857]">{msg}</p>}

      {!data?.request ? (
        <form onSubmit={submitResign} className="space-y-3">
          <p className="text-xs text-[#64748b]">
            Belum ada proses offboarding. Bila Anda hendak mengakhiri kerja, ajukan resign di bawah ini.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-[11px] font-semibold text-[#334155]">Alasan
              <input value={form.reasonForLeaving} onChange={(e) => setForm({ ...form, reasonForLeaving: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs text-[#0f172a]" />
            </label>
            <label className="text-[11px] font-semibold text-[#334155]">Tanggal Pengajuan
              <input type="date" required value={form.resignationNoticeDate} onChange={(e) => setForm({ ...form, resignationNoticeDate: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs text-[#0f172a]" />
            </label>
            <label className="text-[11px] font-semibold text-[#334155]">Hari Kerja Terakhir
              <input type="date" required value={form.lastWorkingDay} onChange={(e) => setForm({ ...form, lastWorkingDay: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs text-[#0f172a]" />
            </label>
          </div>
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#007a5a] hover:bg-[#00684a] text-white text-xs font-semibold disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Ajukan Resign
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl border border-[#e2e8f0] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#64748b]">Alasan</p>
              <p className="font-semibold text-[#0f172a]">{data.request.reasonForLeaving}</p>
            </div>
            <div className="rounded-xl border border-[#e2e8f0] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#64748b]">Hari Kerja Terakhir</p>
              <p className="font-semibold text-[#0f172a]">{new Date(data.request.lastWorkingDay).toLocaleDateString('id-ID')}</p>
            </div>
            <div className="rounded-xl border border-[#e2e8f0] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#64748b]">Progres Serah Terima</p>
              <p className="font-semibold text-[#0f172a]">{data.handoverProgress}%</p>
            </div>
          </div>

          {data.severance && (
            <div className="rounded-xl border border-[#e2e8f0] p-3 text-xs">
              <p className="font-bold text-[#0f172a] mb-1">Ringkasan Pesangon</p>
              <p className="text-[#334155]">Masa kerja {data.severance.serviceYears} tahun · Total Rp {Number(data.severance.totalDisbursement).toLocaleString('id-ID')} · {data.severance.isPaid ? 'Sudah dibayar' : 'Belum dibayar'}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider flex items-center gap-1">
              <ClipboardCheck className="h-3.5 w-3.5" /> Checklist Serah Terima
            </p>
            {data.handovers.length === 0 ? (
              <p className="text-xs text-[#64748b]">Belum ada item serah terima.</p>
            ) : data.handovers.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-3 rounded-xl border border-[#e2e8f0]">
                <div>
                  <p className="text-xs font-semibold text-[#0f172a]">{h.itemName}</p>
                  <p className="text-[10px] text-[#64748b]">{h.category}{h.notes ? ` · ${h.notes}` : ''}</p>
                </div>
                {h.isVerified ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#137333]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Terverifikasi HR
                  </span>
                ) : (
                  <button onClick={() => markHandover(h.id)} disabled={busy}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-[11px] font-medium text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50">
                    <Clock className="h-3.5 w-3.5" /> Tandai Siap
                  </button>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={submitExit} className="space-y-2 rounded-xl border border-[#e2e8f0] p-3">
            <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider flex items-center gap-1">
              <Star className="h-3.5 w-3.5" /> Exit Interview
            </p>
            <div className="flex items-center gap-3 text-xs">
              <label>Rating
                <select value={exit.overallRating} onChange={(e) => setExit({ ...exit, overallRating: Number(e.target.value) })}
                  className="ml-2 rounded-lg border border-[#e2e8f0] px-2 py-1 text-xs text-[#0f172a]">
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={exit.wouldRecommend} onChange={(e) => setExit({ ...exit, wouldRecommend: e.target.checked })} />
                Bersedia merekomendasikan
              </label>
            </div>
            <textarea required value={exit.feedback} onChange={(e) => setExit({ ...exit, feedback: e.target.value })}
              placeholder="Ceritakan pengalaman kerja Anda…" rows={3}
              className="w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs text-[#0f172a] placeholder-[#94a3b8]" />
            {data.exitInterview && <p className="text-[10px] text-[#64748b]">Terakhir dikirim: {data.exitInterview.feedback.slice(0, 60)}…</p>}
            <button type="submit" disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-semibold disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Kirim Exit Interview
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
