'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Mail, Plus, Send, Lock, CheckCircle2, X } from 'lucide-react';

interface Disposition {
  id: string;
  instruction: string;
  status: 'BELUM_DIBACA' | 'DIBACA' | 'DIKERJAKAN' | 'SELESAI' | 'DITOLAK';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueDate: string | null;
  toUserId: string;
}

interface Letter {
  id: string;
  agendaNumber: string;
  direction: 'INCOMING' | 'OUTGOING' | 'DIRECTIVE';
  classification: 'BIASA' | 'TERBATAS' | 'RAHASIA';
  subject: string;
  sender: string | null;
  letterDate: string;
  status: 'DRAFT' | 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  openDispositions: number;
  createdByName: string | null;
  dispositions: Disposition[];
}

interface UserOption {
  id: string;
  email: string;
  role: string;
  fullName: string | null;
}

const STATUS_LABEL: Record<Letter['status'], string> = {
  DRAFT: 'Draf', OPEN: 'Baru', IN_PROGRESS: 'Diproses', CLOSED: 'Selesai',
};

const STATUS_TONE: Record<Letter['status'], string> = {
  DRAFT: 'bg-[#f1f5f9] text-[#475569]',
  OPEN: 'bg-[#e0f2fe] text-[#0284c7]',
  IN_PROGRESS: 'bg-[#fef3c7] text-[#b45309]',
  CLOSED: 'bg-[#e6f4ea] text-[#007a5a]',
};

const CLASS_TONE: Record<Letter['classification'], string> = {
  BIASA: 'bg-[#f1f5f9] text-[#475569]',
  TERBATAS: 'bg-[#fef3c7] text-[#b45309]',
  RAHASIA: 'bg-[#fce8e6] text-[#b91c1c]',
};

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export default function LetterManagerPanel() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Paginasi di level data: tidak mengubah struktur JSX daftar (yang bersarang).
  const [cari, setCari] = useState('');
  const [halaman, setHalaman] = useState(1);

  const [form, setForm] = useState({
    agendaNumber: '',
    direction: 'INCOMING' as Letter['direction'],
    classification: 'BIASA' as Letter['classification'],
    subject: '',
    sender: '',
    letterDate: today(),
    fileUrl: '',
  });

  const [disposing, setDisposing] = useState<string | null>(null);
  const [disposeForm, setDisposeForm] = useState({
    toUserId: '', instruction: '', priority: 'NORMAL' as Disposition['priority'], dueDate: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, u] = await Promise.all([
        fetch('/api/v1/hr/letters').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/v1/hr/users').then((r) => (r.ok ? r.json() : null)),
      ]);
      setLetters(l?.data?.items ?? []);
      setUsers(u?.data?.items ?? []);
    } catch {
      /* biarkan kosong */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submitLetter = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/v1/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agendaNumber: form.agendaNumber,
          direction: form.direction,
          classification: form.classification,
          subject: form.subject,
          sender: form.sender || undefined,
          letterDate: form.letterDate,
          fileUrl: form.fileUrl || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice(json?.detail ?? 'Gagal mendaftarkan surat.'); return; }
      setNotice(`Surat ${form.agendaNumber} terdaftar.`);
      setForm((f) => ({ ...f, agendaNumber: '', subject: '', sender: '', fileUrl: '' }));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const submitDisposition = async (letterId: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/letters/${letterId}/dispositions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: disposeForm.toUserId,
          instruction: disposeForm.instruction,
          priority: disposeForm.priority,
          dueDate: disposeForm.dueDate || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice(json?.detail ?? 'Gagal mengirim disposisi.'); return; }
      setNotice('Disposisi terkirim.');
      setDisposing(null);
      setDisposeForm({ toUserId: '', instruction: '', priority: 'NORMAL', dueDate: '' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const closeLetter = async (letterId: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/letters/${letterId}/close`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice(json?.detail ?? 'Gagal menutup surat.'); return; }
      setNotice('Surat ditutup.');
      await load();
    } finally {
      setBusy(false);
    }
  };

  // Penyaringan + paginasi daftar surat (10 per halaman).
  const UKURAN_HALAMAN = 10;
  const suratTersaring = letters.filter((l) => {
    const q = cari.trim().toLowerCase();
    if (!q) return true;
    return `${l.agendaNumber} ${l.subject} ${l.sender ?? ''} ${l.classification}`
      .toLowerCase()
      .includes(q);
  });
  const totalHalaman = Math.max(1, Math.ceil(suratTersaring.length / UKURAN_HALAMAN));
  const halamanAman = Math.min(halaman, totalHalaman);
  const suratTampil = suratTersaring.slice(
    (halamanAman - 1) * UKURAN_HALAMAN,
    halamanAman * UKURAN_HALAMAN
  );

  return (
    <div className="p-5 rounded-2xl border border-[#e2e8f0] bg-white space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#0284c7]" aria-hidden="true" />
            <span>Register e-Surat & Disposisi</span>
          </h3>
          <p className="text-[11px] text-[#64748b]">
            Daftarkan surat, teruskan disposisi, dan tutup surat setelah semua disposisi selesai.
          </p>
        </div>
        <span className="text-[10px] font-bold text-[#0284c7] bg-[#e0f2fe] px-2 py-1 rounded-lg">
          {letters.length} surat
        </span>
      </div>

      {notice && (
        <p className="text-[11px] text-[#0f172a] bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      {/* Form pendaftaran */}
      <div className="rounded-xl border border-[#e2e8f0] p-3 space-y-2">
        <p className="text-[11px] font-bold text-[#0f172a] flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Daftarkan Surat Baru
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] text-[#475569]">
            Nomor agenda
            <input
              value={form.agendaNumber}
              onChange={(e) => setForm((f) => ({ ...f, agendaNumber: e.target.value }))}
              placeholder="AG-2026-0001"
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-[11px] text-[#475569]">
            Klasifikasi
            <select
              value={form.classification}
              onChange={(e) => setForm((f) => ({ ...f, classification: e.target.value as Letter['classification'] }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            >
              <option value="BIASA">Biasa</option>
              <option value="TERBATAS">Terbatas</option>
              <option value="RAHASIA">Rahasia</option>
            </select>
          </label>
          <label className="text-[11px] text-[#475569] sm:col-span-2">
            Perihal
            <input
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-[11px] text-[#475569]">
            Pengirim
            <input
              value={form.sender}
              onChange={(e) => setForm((f) => ({ ...f, sender: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-[11px] text-[#475569]">
            Tanggal surat
            <input
              type="date"
              value={form.letterDate}
              onChange={(e) => setForm((f) => ({ ...f, letterDate: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
          <label className="text-[11px] text-[#475569] sm:col-span-2">
            URL lampiran (PDF, opsional)
            <input
              value={form.fileUrl}
              onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
              placeholder="https://…/surat.pdf"
              className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={submitLetter}
          className="rounded-lg bg-[#007a5a] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#00684a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2 disabled:opacity-50"
        >
          Daftarkan surat
        </button>
      </div>

      {/* Register */}
      {loading && <p className="text-[11px] text-[#64748b]">Memuat surat…</p>}

      {!loading && letters.length > 10 && (
        <input
          type="search"
          value={cari}
          onChange={(e) => {
            setCari(e.target.value);
            setHalaman(1);
          }}
          placeholder="Cari nomor agenda, perihal, atau pengirim..."
          aria-label="Cari nomor agenda, perihal, atau pengirim..."
          className="w-full h-9 px-3 rounded-lg border border-[#cbd5e1] bg-white text-xs text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#007a5a]/30"
        />
      )}

      <ul className="divide-y divide-[#e2e8f0]">
        {suratTampil.map((l) => (
          <li key={l.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-[#0f172a]">{l.agendaNumber}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${CLASS_TONE[l.classification]}`}>
                {l.classification}
              </span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[l.status]}`}>
                {STATUS_LABEL[l.status]}
              </span>
              {l.openDispositions > 0 && (
                <span className="text-[10px] font-semibold text-[#b45309]">
                  {l.openDispositions} disposisi terbuka
                </span>
              )}
            </div>

            <p className="mt-1 text-xs font-semibold text-[#0f172a]">{l.subject}</p>
            <p className="text-[11px] text-[#64748b]">
              {l.sender ?? '—'} · {String(l.letterDate).slice(0, 10)}
              {l.createdByName ? ` · didaftarkan ${l.createdByName}` : ''}
            </p>

            {l.dispositions.length > 0 && (
              <ul className="mt-2 space-y-1">
                {l.dispositions.map((d) => (
                  <li key={d.id} className="rounded-lg bg-[#f8fafc] px-2 py-1 text-[10px] text-[#475569]">
                    {d.instruction} · {d.status}
                    {d.dueDate ? ` · tenggat ${String(d.dueDate).slice(0, 10)}` : ''}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-2 flex flex-wrap gap-2">
              {l.status !== 'CLOSED' && (
                <button
                  type="button"
                  onClick={() => setDisposing(disposing === l.id ? null : l.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#0284c7] px-2 py-1 text-[10px] font-semibold text-[#0284c7] hover:bg-[#e0f2fe] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0284c7] focus-visible:ring-offset-2"
                >
                  <Send className="h-3 w-3" aria-hidden="true" /> Beri disposisi
                </button>
              )}
              {l.status !== 'CLOSED' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => closeLetter(l.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#007a5a] px-2 py-1 text-[10px] font-semibold text-[#007a5a] hover:bg-[#e6f4ea] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a] focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Tutup surat
                </button>
              )}
            </div>

            {disposing === l.id && (
              <div className="mt-2 rounded-xl border border-[#e2e8f0] p-2.5 space-y-2">
                <label className="block text-[11px] text-[#475569]">
                  Penerima disposisi
                  <select
                    value={disposeForm.toUserId}
                    onChange={(e) => setDisposeForm((f) => ({ ...f, toUserId: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
                  >
                    <option value="">Pilih pengguna…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName ?? u.email} — {u.role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] text-[#475569]">
                  Instruksi
                  <input
                    value={disposeForm.instruction}
                    onChange={(e) => setDisposeForm((f) => ({ ...f, instruction: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[11px] text-[#475569]">
                    Prioritas
                    <select
                      value={disposeForm.priority}
                      onChange={(e) => setDisposeForm((f) => ({ ...f, priority: e.target.value as Disposition['priority'] }))}
                      className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
                    >
                      <option value="LOW">Rendah</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">Tinggi</option>
                      <option value="URGENT">Mendesak</option>
                    </select>
                  </label>
                  <label className="text-[11px] text-[#475569]">
                    Tenggat (opsional)
                    <input
                      type="date"
                      value={disposeForm.dueDate}
                      onChange={(e) => setDisposeForm((f) => ({ ...f, dueDate: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#cbd5e1] px-2 py-1.5 text-xs text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007a5a]"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => submitDisposition(l.id)}
                    className="rounded-lg bg-[#0284c7] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0369a1] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0284c7] focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    Kirim disposisi
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisposing(null)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#cbd5e1] px-2 py-1 text-[11px] font-semibold text-[#475569] hover:bg-[#f8fafc]"
                  >
                    <X className="h-3 w-3" aria-hidden="true" /> Batal
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {!loading && letters.length === 0 && (
          <li className="py-3 text-[11px] text-[#64748b]">Belum ada surat terdaftar.</li>
        )}
        {!loading && letters.length > 0 && suratTersaring.length === 0 && (
          <li className="py-3 text-[11px] text-[#64748b]">Tidak ada surat yang cocok dengan pencarian.</li>
        )}
      </ul>

      {letters.length > UKURAN_HALAMAN && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748b]">
          <span>
            {suratTersaring.length === 0
              ? '0 surat'
              : `Menampilkan ${(halamanAman - 1) * UKURAN_HALAMAN + 1}–${Math.min(halamanAman * UKURAN_HALAMAN, suratTersaring.length)} dari ${suratTersaring.length} surat`}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setHalaman(halamanAman - 1)}
              disabled={halamanAman <= 1}
              aria-label="Halaman sebelumnya"
              className="px-2 py-1 rounded-lg border border-[#cbd5e1] bg-white disabled:opacity-40 hover:bg-[#f8fafc]"
            >
              Sebelumnya
            </button>
            <span className="font-semibold text-[#334155]">
              Halaman {halamanAman} / {totalHalaman}
            </span>
            <button
              type="button"
              onClick={() => setHalaman(halamanAman + 1)}
              disabled={halamanAman >= totalHalaman}
              aria-label="Halaman berikutnya"
              className="px-2 py-1 rounded-lg border border-[#cbd5e1] bg-white disabled:opacity-40 hover:bg-[#f8fafc]"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}

      <p className="flex items-center gap-1 text-[10px] text-[#94a3b8]">
        <Lock className="h-3 w-3" aria-hidden="true" />
        Surat TERBATAS dan RAHASIA hanya tampil di register HR.
      </p>
    </div>
  );
}
