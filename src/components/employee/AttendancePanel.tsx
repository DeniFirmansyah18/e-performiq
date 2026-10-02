'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Camera, LogIn, LogOut, MapPin, CheckCircle2, AlertCircle, Send } from 'lucide-react';

interface AttendanceLog {
  id: string;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
  status: string;
  totalWorkHours: number | null;
  totalOvertimeHours: number | null;
}
interface TimesheetRow {
  id: string;
  workDate: string;
  regularHours: number;
  overtimeHours: number;
  taskSummary: string;
  activityCategory: string | null;
  photos: string[];
  approvalStatus: string;
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Sedang Bekerja', CLOSED: 'Selesai', MISSING_CHECKOUT: 'Lupa Check-out',
  APPROVED: 'Disetujui', REJECTED: 'Ditolak', SUBMITTED: 'Menunggu Persetujuan',
};
const STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-indigo-50 text-indigo-700', CLOSED: 'bg-emerald-50 text-emerald-700',
  SUBMITTED: 'bg-amber-50 text-amber-700', APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
};

/** Menyusutkan gambar ke data URL kecil agar aman dikirim & disimpan (serverless). */
async function fileToDataUrl(file: File, maxDim = 800): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca berkas.'));
    reader.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gagal memuat gambar.'));
      el.src = dataUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return dataUrl;
  }
}

export default function AttendancePanel() {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [timesheets, setTimesheets] = useState<TimesheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [overtime, setOvertime] = useState('0');
  const [category, setCategory] = useState('GENERAL');
  const [location, setLocation] = useState('');
  const [summary, setSummary] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const checkInPhotoRef = useRef<HTMLInputElement>(null);
  const checkOutPhotoRef = useRef<HTMLInputElement>(null);
  const tsPhotoRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [c, t] = await Promise.all([
        fetch('/api/v1/attendance/clock').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/v1/attendance/timesheets').then((r) => (r.ok ? r.json() : null)),
      ]);
      setLogs(c?.data?.logs ?? []);
      setTimesheets(t?.data?.timesheets ?? []);
    } catch {
      /* biarkan kosong */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getGeo = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { timeout: 4000 },
      );
    });

  const clockIn = async (photo?: string) => {
    setBusy(true); setErr(null); setMsg(null);
    const geo = await getGeo();
    const res = await fetch('/api/v1/attendance/clock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check-in', photoUrl: photo, geo }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) setMsg('Check-in berhasil.'); else setErr(j?.detail || 'Gagal check-in.');
    setBusy(false); await load();
  };

  const clockOut = async (photo?: string) => {
    setBusy(true); setErr(null); setMsg(null);
    const geo = await getGeo();
    const res = await fetch('/api/v1/attendance/clock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check-out', photoUrl: photo, geo }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) setMsg('Check-out berhasil.'); else setErr(j?.detail || 'Gagal check-out.');
    setBusy(false); await load();
  };

  const submitTimesheet = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    const res = await fetch('/api/v1/attendance/timesheets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workDate, overtimeHours: Number(overtime), taskSummary: summary,
        activityCategory: category, location: location || undefined, photos,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setMsg('Timesheet dikirim untuk persetujuan atasan.'); setSummary(''); setPhotos([]); }
    else setErr(j?.detail || 'Gagal mengirim timesheet.');
    setBusy(false); await load();
  };

  const onPickTsPhoto = async (file?: File | null) => {
    if (!file || photos.length >= 5) return;
    const url = await fileToDataUrl(file);
    setPhotos((p) => [...p, url]);
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayLog = logs.find((l) => l.workDate?.slice(0, 10) === today);
  const isWorking = todayLog?.status === 'OPEN';
  const fmtTime = (v: string | null) => (v ? new Date(v).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '–');

  return (
    <div className="stitch-card-white p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
        <div className="flex items-center gap-2.5">
          <Clock className="h-4 w-4 text-[#007a5a]" />
          <h2 className="text-base font-extrabold text-[#0f172a]">Absensi &amp; Timesheet</h2>
        </div>
        {todayLog && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_COLOR[todayLog.status] ?? 'bg-slate-100 text-slate-600'}`}>
            {STATUS_LABEL[todayLog.status] ?? todayLog.status}
          </span>
        )}
      </div>

      {msg && <p className="text-[11px] font-semibold text-[#047857] flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{msg}</p>}
      {err && <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{err}</p>}

      <div className="flex flex-wrap gap-2 items-center">
        <input ref={checkInPhotoRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) await clockIn(await fileToDataUrl(f)); e.target.value = ''; }} />
        <input ref={checkOutPhotoRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) await clockOut(await fileToDataUrl(f)); e.target.value = ''; }} />
        <button disabled={busy || isWorking} onClick={() => checkInPhotoRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#007a5a] text-white text-xs font-bold hover:bg-[#006347] disabled:opacity-40">
          <LogIn className="h-3.5 w-3.5" /> Check-in (foto)
        </button>
        <button disabled={busy || !isWorking} onClick={() => checkOutPhotoRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0f172a] text-white text-xs font-bold hover:bg-[#1e293b] disabled:opacity-40">
          <LogOut className="h-3.5 w-3.5" /> Check-out (foto)
        </button>
        {todayLog && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[#64748b]">
            <MapPin className="h-3 w-3" />
            {todayLog.totalWorkHours != null ? `${todayLog.totalWorkHours} jam kerja` : 'Belum check-out'}
            {todayLog.totalOvertimeHours ? ` · lembur ${todayLog.totalOvertimeHours} jam` : ''}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-[#64748b]">Memuat…</p>
      ) : (
        <>
          {logs.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-[#334155]">Riwayat Absensi</p>
              {logs.slice(0, 5).map((l) => (
                <div key={l.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[#e2e8f0] text-[11px]">
                  <span className="font-mono text-[#334155]">{l.workDate?.slice(0, 10)}</span>
                  <span className="text-[#64748b]">{fmtTime(l.checkInAt)} → {fmtTime(l.checkOutAt)}</span>
                  <span className={`px-2 py-0.5 rounded ${STATUS_COLOR[l.status] ?? 'bg-slate-100 text-slate-600'}`}>{STATUS_LABEL[l.status] ?? l.status}</span>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={submitTimesheet} className="space-y-2.5 border-t border-[#f1f5f9] pt-3">
            <p className="text-[11px] font-bold text-[#334155]">Isi Timesheet Harian</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="text-[11px] text-[#334155]">
                <span className="font-semibold">Tanggal</span>
                <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" />
              </label>
              <label className="text-[11px] text-[#334155]">
                <span className="font-semibold">Lembur (jam)</span>
                <input type="number" min="0" max="4" step="0.5" value={overtime} onChange={(e) => setOvertime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" />
              </label>
              <label className="text-[11px] text-[#334155]">
                <span className="font-semibold">Kategori</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs">
                  <option value="GENERAL">Umum</option>
                  <option value="PROJECT">Proyek</option>
                  <option value="MEETING">Rapat</option>
                  <option value="SUPPORT">Dukungan</option>
                  <option value="TRAINING">Pelatihan</option>
                </select>
              </label>
            </div>
            <label className="block text-[11px] text-[#334155]">
              <span className="font-semibold">Lokasi (opsional)</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="mis. Kantor Jakarta / Remote"
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" />
            </label>
            <label className="block text-[11px] text-[#334155]">
              <span className="font-semibold">Ringkasan kegiatan</span>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} required minLength={3}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs h-16" />
            </label>

            <div className="flex items-center gap-2">
              <input ref={tsPhotoRef} type="file" accept="image/*" className="hidden"
                onChange={async (e) => { await onPickTsPhoto(e.target.files?.[0]); e.target.value = ''; }} />
              <button type="button" disabled={photos.length >= 5} onClick={() => tsPhotoRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-[#334155] text-[11px] font-semibold hover:bg-slate-200 disabled:opacity-40">
                <Camera className="h-3 w-3" /> Foto bukti ({photos.length}/5)
              </button>
              {photos.map((p, i) => (
                <img key={i} src={p} alt={`bukti ${i + 1}`} className="h-8 w-8 rounded object-cover border border-[#e2e8f0]" />
              ))}
            </div>

            <button type="submit" disabled={busy || summary.trim().length < 3}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#007a5a] text-white text-xs font-bold hover:bg-[#006347] disabled:opacity-40">
              <Send className="h-3.5 w-3.5" /> Kirim Timesheet
            </button>
          </form>

          {timesheets.length > 0 && (
            <div className="space-y-1.5 border-t border-[#f1f5f9] pt-3">
              <p className="text-[11px] font-bold text-[#334155]">Riwayat Timesheet</p>
              {timesheets.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[#e2e8f0] text-[11px]">
                  <span className="font-mono text-[#334155]">{t.workDate?.slice(0, 10)}</span>
                  <span className="text-[#64748b] truncate max-w-[40%]">{t.taskSummary}</span>
                  <span className={`px-2 py-0.5 rounded ${STATUS_COLOR[t.approvalStatus] ?? 'bg-slate-100 text-slate-600'}`}>{STATUS_LABEL[t.approvalStatus] ?? t.approvalStatus}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
