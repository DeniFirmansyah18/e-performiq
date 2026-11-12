'use client';
import ListPager from '@/components/ui/ListPager';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, Plus, Eye, EyeOff, Pencil } from 'lucide-react';
import OrgQuickAdd from '@/components/governance/OrgQuickAdd';

interface HrPosting {
  id: string; postingTitle: string; description: string; requiredSkills: string[];
  departmentId: string; department: string; positionId: string; position: string;
  manpowerPlanId: string; status: string; isPublic: boolean;
  minEducation: string | null; minExperienceYears: number | null; workLocation: string | null;
  salaryMin: number | null; salaryMax: number | null; employmentType: string | null;
  quota: number; hired: number; remaining: number; availability: string;
}
interface Ref { departments: Array<{ id: string; name: string }>; positions: Array<{ id: string; title: string; departmentId: string }>; mpps: Array<{ id: string; department: string; position: string; approvedQuota: number; hiredCount: number; departmentId: string; positionId: string }> }

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600', OPEN: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-rose-50 text-rose-700', FILLED: 'bg-amber-50 text-amber-700',
};

const EMPTY = {
  postingTitle: '', description: '', skillsText: '', departmentId: '', positionId: '', manpowerPlanId: '',
  status: 'DRAFT', isPublic: false, minEducation: '', minExperienceYears: '', workLocation: '',
  salaryMin: '', salaryMax: '', employmentType: 'PERMANENT', quota: '',
};

/** Manajer lowongan HR (WS-12): buat, ubah, publikasikan, tutup. */
export default function JobPostingManager() {
  const [rows, setRows] = useState<HrPosting[]>([]);
  const [ref, setRef] = useState<Ref | null>(null);
  const [form, setForm] = useState<Record<string, any>>({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, r] = await Promise.all([
      fetch('/api/v1/recruitment/job-postings').then((x) => (x.ok ? x.json() : null)),
      fetch('/api/v1/recruitment/job-postings?reference=1').then((x) => (x.ok ? x.json() : null)),
    ]);
    setRows(p?.data?.postings ?? []);
    setRef(r?.data ?? null);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Muat ulang referensi saat MPP ditambah/diubah/dihapus di panel Manajemen MPP
  // (komponen terpisah pada halaman yang sama) agar dropdown MPP langsung terbaru.
  useEffect(() => {
    const onMppChanged = () => { void load(); };
    window.addEventListener('mpp:changed', onMppChanged);
    return () => window.removeEventListener('mpp:changed', onMppChanged);
  }, [load]);

  const openCreate = () => { setEditingId(null); setForm({ ...EMPTY }); setShowForm(true); setMsg(null); setErr(null); };
  const openEdit = (p: HrPosting) => {
    setEditingId(p.id);
    setForm({
      postingTitle: p.postingTitle, description: p.description, skillsText: (p.requiredSkills ?? []).join(', '),
      departmentId: p.departmentId, positionId: p.positionId, manpowerPlanId: p.manpowerPlanId,
      status: p.status, isPublic: p.isPublic, minEducation: p.minEducation ?? '',
      minExperienceYears: p.minExperienceYears ?? '', workLocation: p.workLocation ?? '',
      salaryMin: p.salaryMin ?? '', salaryMax: p.salaryMax ?? '', employmentType: p.employmentType ?? 'PERMANENT',
      quota: p.quota != null ? String(p.quota) : '',
    });
    setShowForm(true); setMsg(null); setErr(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    const payload = {
      postingTitle: form.postingTitle, description: form.description,
      requiredSkills: String(form.skillsText || '').split(',').map((s) => s.trim()).filter(Boolean),
      departmentId: form.departmentId, positionId: form.positionId, manpowerPlanId: form.manpowerPlanId,
      status: form.status, isPublic: form.isPublic,
      minEducation: form.minEducation || null,
      minExperienceYears: form.minExperienceYears === '' ? null : Number(form.minExperienceYears),
      workLocation: form.workLocation || null,
      salaryMin: form.salaryMin === '' ? null : Number(form.salaryMin),
      salaryMax: form.salaryMax === '' ? null : Number(form.salaryMax),
      employmentType: form.employmentType || null,
      quota: form.quota === '' ? null : Number(form.quota),
    };
    const res = await fetch(editingId ? `/api/v1/recruitment/job-postings/${editingId}` : '/api/v1/recruitment/job-postings', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setMsg(editingId ? 'Lowongan diperbarui.' : 'Lowongan dibuat.'); setShowForm(false); await load(); window.dispatchEvent(new Event('recruitment:postings-changed')); }
    else setErr(j?.detail || 'Gagal menyimpan lowongan.');
    setBusy(false);
  };

  const setStatus = async (id: string, status: string, isPublic?: boolean) => {
    setBusy(true); setMsg(null); setErr(null);
    const res = await fetch(`/api/v1/recruitment/job-postings/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isPublic === undefined ? { status } : { status, isPublic }),
    });
    if (res.ok) { setMsg('Status lowongan diperbarui.'); await load(); window.dispatchEvent(new Event('recruitment:postings-changed')); }
    else setErr('Gagal memperbarui status.');
    setBusy(false);
  };

  const onPickMpp = (id: string) => {
    const mpp = ref?.mpps.find((m) => m.id === id);
    setForm((f) => ({ ...f, manpowerPlanId: id, departmentId: mpp?.departmentId ?? f.departmentId, positionId: mpp?.positionId ?? f.positionId }));
  };
  const positionsForDept = (ref?.positions ?? []).filter((p) => !form.departmentId || p.departmentId === form.departmentId);
  // Gaya input yang seragam supaya seluruh form terbaca konsisten.
  const INPUT =
    'mt-1.5 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-[13px] text-[#0f172a] ' +
    'placeholder:text-[#94a3b8] focus:border-[#007a5a] focus:outline-none focus:ring-2 focus:ring-[#007a5a]/20';

  const field = (k: string, label: string, type = 'text', hint?: string) => (
    <label className="block">
      <span className="block text-[12px] font-semibold text-[#334155]">{label}</span>
      <input
        type={type}
        value={form[k]}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        className={INPUT}
      />
      {hint && <span className="mt-1 block text-[11px] text-[#64748b]">{hint}</span>}
    </label>
  );

  /** Judul bagian bernomor agar mata mudah memindai. */
  const Bagian = ({
    nomor,
    judul,
    ket,
    children,
  }: {
    nomor: number;
    judul: string;
    ket: string;
    children: React.ReactNode;
  }) => (
    <section className="rounded-xl border border-[#e2e8f0] bg-[#fbfcfd] p-4 space-y-3.5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e6f4ea] text-[11px] font-extrabold text-[#137333]">
          {nomor}
        </span>
        <div>
          <p className="text-[13px] font-bold text-[#0f172a]">{judul}</p>
          <p className="text-[11px] text-[#64748b]">{ket}</p>
        </div>
      </div>
      {children}
    </section>
  );

  return (
    <div className="mt-4 space-y-3 border-t border-[#f1f5f9] pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-[#007a5a]" /><span className="text-sm font-extrabold text-[#0f172a]">Kelola Lowongan</span></div>
        <button onClick={openCreate} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#007a5a] text-white text-[11px] font-semibold hover:bg-[#006347]"><Plus className="h-3 w-3" /> Buat Lowongan</button>
      </div>

      {msg && <p className="text-xs text-[#047857] bg-[#ecfdf5] px-3 py-2 rounded-lg">{msg}</p>}
      {err && <p className="text-xs text-[#b91c1c] bg-[#fef2f2] px-3 py-2 rounded-lg">{err}</p>}

      <ListPager
        items={rows}
        itemKey={(p) => p.id}
        itemLabel="lowongan"
        emptyMessage="Belum ada lowongan. Klik 'Buat Lowongan' untuk menambah."
        searchPlaceholder="Cari judul lowongan, departemen, atau posisi..."
        searchText={(p) => `${p.postingTitle} ${p.department ?? ''} ${p.position ?? ''} ${p.status}`}
        maxHeight="460px"
        renderItem={(p) => (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-bold text-[#0f172a] truncate">{p.postingTitle}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_COLOR[p.status] ?? 'bg-slate-100'}`}>{p.status}</span>
                  {p.isPublic ? <span className="text-[10px] text-emerald-600 inline-flex items-center gap-0.5"><Eye className="h-3 w-3" /> Publik</span>
                    : <span className="text-[10px] text-[#94a3b8] inline-flex items-center gap-0.5"><EyeOff className="h-3 w-3" /> Internal</span>}
                </div>
                <p className="text-[10px] text-[#64748b]">{p.department} · {p.position} · Kuota {p.hired}/{p.quota} (sisa {p.remaining})</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                <button
                  onClick={() => openEdit(p)}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-[#334155] hover:bg-slate-200"
                  title="Ubah lowongan"
                >
                  <Pencil className="h-3.5 w-3.5" /> Ubah
                </button>
                {p.status !== 'OPEN' && (
                  <button disabled={busy} onClick={() => setStatus(p.id, 'OPEN', true)} className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100">Buka &amp; Publikasikan</button>
                )}
                {p.status === 'OPEN' && (
                  <button disabled={busy} onClick={() => setStatus(p.id, 'CLOSED')} className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-bold hover:bg-rose-100">Tutup</button>
                )}
              </div>
          </div>
        )}
      />

      {showForm && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
          <form onSubmit={submit} className="bg-white rounded-t-2xl sm:rounded-2xl border border-[#e2e8f0] shadow-2xl w-full sm:max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="shrink-0 bg-[#0f172a] text-white px-5 py-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-[#7dd3b0]" />
                <div>
                  <p className="text-sm font-bold leading-tight">
                    {editingId ? 'Ubah Lowongan' : 'Buat Lowongan'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#94a3b8]">
                    Isi 4 bagian di bawah ini. Bagian bertanda * wajib diisi.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-lg leading-none text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Tutup"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#f8fafc]">
              {/* 1. Informasi utama yang dibaca pelamar */}
              <Bagian nomor={1} judul="Informasi Lowongan" ket="Judul dan penjelasan yang akan dibaca pelamar.">
                {field('postingTitle', 'Judul Lowongan', 'text', 'Contoh: Senior Software Engineer (Full Stack)')}
                <label className="block">
                  <span className="block text-[12px] font-semibold text-[#334155]">Deskripsi Pekerjaan</span>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                    minLength={10}
                    rows={5}
                    placeholder="Jelaskan tanggung jawab, tugas harian, dan hal yang menarik dari posisi ini."
                    className={INPUT + ' resize-y leading-relaxed'}
                  />
                  <span className="mt-1 block text-[11px] text-[#64748b]">
                    Minimal 10 karakter. Tulis dalam kalimat yang mudah dipahami pelamar.
                  </span>
                </label>
                <label className="block">
                  <span className="block text-[12px] font-semibold text-[#334155]">Keahlian yang Dibutuhkan</span>
                  <input
                    value={form.skillsText}
                    onChange={(e) => setForm({ ...form, skillsText: e.target.value })}
                    placeholder="TypeScript, React, PostgreSQL"
                    className={INPUT}
                  />
                  <span className="mt-1 block text-[11px] text-[#64748b]">
                    Pisahkan dengan koma. Dipakai untuk menilai kecocokan CV pelamar.
                  </span>
                </label>
              </Bagian>

              {/* 2. Kaitan ke kuota & formasi */}
              <Bagian nomor={2} judul="Formasi & Posisi" ket="Lowongan ini mengambil kuota dari MPP yang mana.">
                <label className="block">
                  <span className="block text-[12px] font-semibold text-[#334155]">MPP (kuota &amp; anggaran)</span>
                  <select
                    value={form.manpowerPlanId}
                    onChange={(e) => onPickMpp(e.target.value)}
                    required
                    className={INPUT}
                  >
                    <option value="">— Pilih MPP —</option>
                    {(ref?.mpps ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.department} · {m.position} ({m.hiredCount}/{m.approvedQuota})
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[11px] text-[#64748b]">
                    Angka dalam kurung: terisi / kuota. Departemen &amp; posisi terisi otomatis.
                  </span>
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="block text-[12px] font-semibold text-[#334155]">Departemen</span>
                      <OrgQuickAdd
                        kind="department"
                        disabled={busy}
                        onCreated={async (d) => {
                          await load();
                          setForm((f) => ({ ...f, departmentId: d.id, positionId: '' }));
                        }}
                      />
                    </div>
                    <select
                      value={form.departmentId}
                      onChange={(e) =>
                        setForm({ ...form, departmentId: e.target.value, positionId: '' })
                      }
                      required
                      className={INPUT}
                    >
                      <option value="">— Pilih departemen —</option>
                      {(ref?.departments ?? []).map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="block text-[12px] font-semibold text-[#334155]">Posisi</span>
                      <OrgQuickAdd
                        kind="position"
                        departmentId={form.departmentId}
                        disabled={busy}
                        onCreated={async (p) => {
                          await load();
                          setForm((f) => ({ ...f, positionId: p.id }));
                        }}
                      />
                    </div>
                    <select
                      value={form.positionId}
                      onChange={(e) => setForm({ ...form, positionId: e.target.value })}
                      required
                      className={INPUT}
                    >
                      <option value="">— Pilih posisi —</option>
                      {positionsForDept.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </Bagian>

              {/* 3. Syarat & ketentuan kerja */}
              <Bagian nomor={3} judul="Kualifikasi & Ketentuan" ket="Syarat minimum dan bentuk kerja yang ditawarkan.">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {field('minEducation', 'Pendidikan Minimum', 'text', 'Contoh: S1 Teknik Informatika')}
                  {field('minExperienceYears', 'Pengalaman Minimum (tahun)', 'number', 'Isi 0 bila tidak dipersyaratkan.')}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="block text-[12px] font-semibold text-[#334155]">Lokasi Kerja</span>
                    <select
                      value={form.workLocation}
                      onChange={(e) => setForm({ ...form, workLocation: e.target.value })}
                      className={INPUT}
                    >
                      <option value="">— Pilih lokasi —</option>
                      <option value="Onsite">Onsite (di kantor)</option>
                      <option value="Remote">Remote (dari mana saja)</option>
                      <option value="Hybrid">Hybrid (campuran)</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-[12px] font-semibold text-[#334155]">Tipe Kepegawaian</span>
                    <select
                      value={form.employmentType}
                      onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                      className={INPUT}
                    >
                      <option value="PERMANENT">Tetap (PKWTT)</option>
                      <option value="CONTRACT">Kontrak (PKWT)</option>
                      <option value="INTERNSHIP">Magang</option>
                    </select>
                  </label>
                </div>
              </Bagian>

              {/* 4. Angka & publikasi */}
              <Bagian nomor={4} judul="Gaji & Publikasi" ket="Rentang gaji dan cara lowongan ditampilkan.">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {field('salaryMin', 'Gaji Minimum (Rp)', 'number')}
                  {field('salaryMax', 'Gaji Maksimum (Rp)', 'number')}
                  <label className="block">
                    <span className="block text-[12px] font-semibold text-[#334155]">Kuota</span>
                    <input
                      type="number"
                      min={0}
                      value={form.quota}
                      placeholder="Ikut MPP"
                      onChange={(e) => setForm({ ...form, quota: e.target.value })}
                      className={INPUT}
                    />
                    <span className="mt-1 block text-[11px] text-[#64748b]">
                      Kosongkan untuk memakai kuota MPP.
                    </span>
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-start">
                  <label className="block">
                    <span className="block text-[12px] font-semibold text-[#334155]">Status Lowongan</span>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className={INPUT}
                    >
                      <option value="DRAFT">Draf — belum dibuka</option>
                      <option value="OPEN">Buka — menerima pelamar</option>
                      <option value="CLOSED">Tutup — tidak menerima pelamar</option>
                      <option value="FILLED">Terisi — posisi sudah terpenuhi</option>
                    </select>
                  </label>
                  <label className="mt-1 flex items-start gap-2.5 rounded-lg border border-[#e2e8f0] bg-white p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isPublic}
                      onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-[#007a5a]"
                    />
                    <span>
                      <span className="block text-[12px] font-semibold text-[#334155]">
                        Tampilkan di portal publik
                      </span>
                      <span className="block text-[11px] text-[#64748b]">
                        Bila tidak dicentang, lowongan hanya terlihat internal.
                      </span>
                    </span>
                  </label>
                </div>
              </Bagian>

              {err && (
                <p className="text-[12px] font-semibold text-[#b91c1c] bg-[#fef2f2] border border-[#f5c6c0] px-3 py-2 rounded-lg">
                  {err}
                </p>
              )}
            </div>
            <div className="shrink-0 border-t border-[#e2e8f0] px-5 py-3.5 flex items-center justify-between gap-3 bg-white">
              <p className="text-[11px] text-[#64748b]">
                <span className="text-[#c5221f]">*</span> wajib diisi
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-[#cbd5e1] px-4 py-2 text-[12px] font-semibold text-[#475569] hover:bg-[#f1f5f9]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#007a5a] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#006347] disabled:opacity-50"
                >
                  {busy ? 'Menyimpan…' : editingId ? 'Simpan Perubahan' : 'Buat Lowongan'}
                </button>
              </div>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}
