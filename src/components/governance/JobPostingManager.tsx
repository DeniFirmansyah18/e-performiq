'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Briefcase, Plus, Eye, EyeOff, Pencil } from 'lucide-react';

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
  salaryMin: '', salaryMax: '', employmentType: 'PERMANENT',
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

  const openCreate = () => { setEditingId(null); setForm({ ...EMPTY }); setShowForm(true); setMsg(null); setErr(null); };
  const openEdit = (p: HrPosting) => {
    setEditingId(p.id);
    setForm({
      postingTitle: p.postingTitle, description: p.description, skillsText: (p.requiredSkills ?? []).join(', '),
      departmentId: p.departmentId, positionId: p.positionId, manpowerPlanId: p.manpowerPlanId,
      status: p.status, isPublic: p.isPublic, minEducation: p.minEducation ?? '',
      minExperienceYears: p.minExperienceYears ?? '', workLocation: p.workLocation ?? '',
      salaryMin: p.salaryMin ?? '', salaryMax: p.salaryMax ?? '', employmentType: p.employmentType ?? 'PERMANENT',
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
    };
    const res = await fetch(editingId ? `/api/v1/recruitment/job-postings/${editingId}` : '/api/v1/recruitment/job-postings', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setMsg(editingId ? 'Lowongan diperbarui.' : 'Lowongan dibuat.'); setShowForm(false); await load(); }
    else setErr(j?.detail || 'Gagal menyimpan lowongan.');
    setBusy(false);
  };

  const setStatus = async (id: string, status: string, isPublic?: boolean) => {
    setBusy(true); setMsg(null); setErr(null);
    const res = await fetch(`/api/v1/recruitment/job-postings/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isPublic === undefined ? { status } : { status, isPublic }),
    });
    if (res.ok) { setMsg('Status lowongan diperbarui.'); await load(); }
    else setErr('Gagal memperbarui status.');
    setBusy(false);
  };

  const onPickMpp = (id: string) => {
    const mpp = ref?.mpps.find((m) => m.id === id);
    setForm((f) => ({ ...f, manpowerPlanId: id, departmentId: mpp?.departmentId ?? f.departmentId, positionId: mpp?.positionId ?? f.positionId }));
  };
  const positionsForDept = (ref?.positions ?? []).filter((p) => !form.departmentId || p.departmentId === form.departmentId);
  const field = (k: string, label: string, type = 'text') => (
    <label className="block text-[11px] text-[#334155]">
      <span className="font-semibold">{label}</span>
      <input type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" />
    </label>
  );

  return (
    <div className="mt-4 space-y-3 border-t border-[#f1f5f9] pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-[#007a5a]" /><span className="text-sm font-extrabold text-[#0f172a]">Kelola Lowongan</span></div>
        <button onClick={openCreate} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#007a5a] text-white text-[11px] font-semibold hover:bg-[#006347]"><Plus className="h-3 w-3" /> Buat Lowongan</button>
      </div>

      {msg && <p className="text-[11px] font-semibold text-[#047857]">{msg}</p>}
      {err && <p className="text-[11px] font-semibold text-rose-600">{err}</p>}

      {rows.length === 0 ? (
        <p className="text-xs text-[#64748b]">Belum ada lowongan. Klik &quot;Buat Lowongan&quot;.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-[#e2e8f0]">
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
                <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200" title="Ubah"><Pencil className="h-3.5 w-3.5 text-[#334155]" /></button>
                {p.status !== 'OPEN' && (
                  <button disabled={busy} onClick={() => setStatus(p.id, 'OPEN', true)} className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100">Buka &amp; Publikasikan</button>
                )}
                {p.status === 'OPEN' && (
                  <button disabled={busy} onClick={() => setStatus(p.id, 'CLOSED')} className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-bold hover:bg-rose-100">Tutup</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={submit} className="bg-white rounded-2xl border border-[#e2e8f0] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#0f172a] text-white px-5 py-3.5 flex items-center justify-between">
              <span className="text-sm font-bold">{editingId ? 'Ubah Lowongan' : 'Buat Lowongan'}</span>
              <button type="button" onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-white/10 text-lg leading-none">&times;</button>
            </div>
            <div className="p-5 space-y-3">
              {field('postingTitle', 'Judul Lowongan *')}
              <label className="block text-[11px] text-[#334155]"><span className="font-semibold">Deskripsi *</span>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required minLength={10} className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs h-20" /></label>
              <label className="block text-[11px] text-[#334155]"><span className="font-semibold">Kualifikasi / Skill (pisahkan dengan koma)</span>
                <input value={form.skillsText} onChange={(e) => setForm({ ...form, skillsText: e.target.value })} placeholder="TypeScript, React, PostgreSQL" className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" /></label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="text-[11px] text-[#334155]"><span className="font-semibold">MPP (kuota &amp; budget) *</span>
                  <select value={form.manpowerPlanId} onChange={(e) => onPickMpp(e.target.value)} required className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs">
                    <option value="">— Pilih MPP —</option>
                    {(ref?.mpps ?? []).map((m) => <option key={m.id} value={m.id}>{m.department} · {m.position} ({m.hiredCount}/{m.approvedQuota})</option>)}
                  </select></label>
                <label className="text-[11px] text-[#334155]"><span className="font-semibold">Departemen *</span>
                  <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value, positionId: '' })} required className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs">
                    <option value="">— Pilih —</option>
                    {(ref?.departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select></label>
                <label className="text-[11px] text-[#334155]"><span className="font-semibold">Posisi *</span>
                  <select value={form.positionId} onChange={(e) => setForm({ ...form, positionId: e.target.value })} required className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs">
                    <option value="">— Pilih —</option>
                    {positionsForDept.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select></label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {field('minEducation', 'Pendidikan Minimum')}
                {field('minExperienceYears', 'Pengalaman Min (tahun)', 'number')}
                {field('workLocation', 'Lokasi Kerja')}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {field('salaryMin', 'Gaji Min (Rp)', 'number')}
                {field('salaryMax', 'Gaji Max (Rp)', 'number')}
                <label className="text-[11px] text-[#334155]"><span className="font-semibold">Tipe</span>
                  <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs">
                    <option value="PERMANENT">Tetap (PKWTT)</option><option value="CONTRACT">Kontrak (PKWT)</option><option value="INTERNSHIP">Magang</option>
                  </select></label>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <label className="text-[11px] text-[#334155]"><span className="font-semibold mr-2">Status</span>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs">
                    <option value="DRAFT">Draft</option><option value="OPEN">Buka</option><option value="CLOSED">Tutup</option><option value="FILLED">Terisi</option>
                  </select></label>
                <label className="flex items-center gap-1.5 text-[11px] text-[#334155]">
                  <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} className="accent-[#007a5a]" /> Tampilkan di portal publik
                </label>
              </div>

              {err && <p className="text-[11px] font-semibold text-rose-600">{err}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 text-xs text-[#64748b] hover:bg-[#f1f5f9] rounded-lg">Batal</button>
                <button type="submit" disabled={busy} className="px-4 py-2 text-xs font-bold text-white bg-[#007a5a] rounded-lg hover:bg-[#006347] disabled:opacity-50">
                  {busy ? 'Menyimpan…' : (editingId ? 'Simpan Perubahan' : 'Buat Lowongan')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
