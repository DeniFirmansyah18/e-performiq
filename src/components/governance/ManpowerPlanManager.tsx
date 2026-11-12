'use client';

import DataTable from '@/components/ui/DataTable';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Target, Plus, Pencil, Trash2 } from 'lucide-react';
import OrgQuickAdd from '@/components/governance/OrgQuickAdd';

interface MppRow {
  id: string;
  departmentId: string;
  department: string;
  positionId: string;
  position: string;
  fiscalYear: number;
  approvedQuota: number;
  allocatedBudget: number;
  utilizedBudget: number;
  hiredCount: number;
  remainingQuota: number;
  budgetUtilizationPct: number;
}

interface Ref {
  departments: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; title: string; departmentId: string }>;
}

const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const EMPTY = {
  departmentId: '', positionId: '', fiscalYear: String(new Date().getFullYear()),
  approvedQuota: '', allocatedBudget: '', utilizedBudget: '', hiredCount: '',
  managerId: '',
};

/**
 * Panel kelola MPP (Manpower Planning): kuota formasi & budget per posisi/tahun.
 * Perubahan langsung tersinkron ke dropdown MPP pada form "Buat Lowongan"
 * karena keduanya membaca tabel `manpower_plans` yang sama.
 */
export default function ManpowerPlanManager() {
  const [rows, setRows] = useState<MppRow[]>([]);
  const [ref, setRef] = useState<Ref | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Atasan langsung yang boleh dipilih: hanya People Manager aktif.
  const [managers, setManagers] = useState<Array<{ id: string; fullName: string; departmentName: string | null }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/v1/recruitment/manpower-plans/approval?mode=manager');
        if (!res.ok) return;
        const json = await res.json();
        setManagers(json?.data ?? []);
      } catch {
        /* pilihan atasan opsional untuk tampilan; validasi tetap di server */
      }
    })();
  }, []);

  const load = useCallback(async () => {
    try {
      setErr(null);
      const res = await fetch('/api/v1/recruitment/manpower-plans');
      if (!res.ok) {
        setErr(res.status === 403 ? 'Anda tidak berwenang mengelola MPP.' : 'Gagal memuat data MPP.');
        return;
      }
      const json = await res.json();
      setRows(json.data?.plans ?? []);
      setRef({ departments: json.data?.departments ?? [], positions: json.data?.positions ?? [] });
    } catch {
      setErr('Gagal memuat data MPP.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const positionsForDept = useMemo(
    () => (ref?.positions ?? []).filter((p) => !form.departmentId || p.departmentId === form.departmentId),
    [ref, form.departmentId],
  );

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY });
    setMsg(null); setErr(null); setShowForm(true);
  }

  function openEdit(r: MppRow) {
    setEditingId(r.id);
    setForm({
      departmentId: r.departmentId, positionId: r.positionId, fiscalYear: String(r.fiscalYear),
      approvedQuota: String(r.approvedQuota), allocatedBudget: String(r.allocatedBudget),
      utilizedBudget: String(r.utilizedBudget), hiredCount: String(r.hiredCount),
    });
    setMsg(null); setErr(null); setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);

    // Pengajuan BARU melewati persetujuan BOD: masuk antrean PENDING lebih
    // dulu. Penyuntingan MPP yang sudah ada tetap memakai endpoint biasa agar
    // perubahan kuota/anggaran tidak perlu menunggu persetujuan ulang.
    if (!editingId) {
      const res = await fetch('/api/v1/recruitment/manpower-plans/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: form.departmentId,
          positionId: form.positionId,
          fiscalYear: Number(form.fiscalYear),
          approvedQuota: Number(form.approvedQuota),
          allocatedBudget: Number(form.allocatedBudget),
          managerId: form.managerId,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg('Pengajuan MPP dikirim ke BOD. Statusnya menunggu keputusan.');
        setShowForm(false);
        await load();
        window.dispatchEvent(new Event('mpp:changed'));
      } else {
        setErr(j?.detail || j?.message || 'Gagal mengajukan MPP.');
      }
      setBusy(false);
      return;
    }

    const payload: Record<string, unknown> = {
      departmentId: form.departmentId,
      positionId: form.positionId,
      fiscalYear: Number(form.fiscalYear),
      approvedQuota: Number(form.approvedQuota),
      allocatedBudget: Number(form.allocatedBudget),
      utilizedBudget: form.utilizedBudget === '' ? 0 : Number(form.utilizedBudget),
      hiredCount: form.hiredCount === '' ? 0 : Number(form.hiredCount),
    };
    const res = await fetch(
      `/api/v1/recruitment/manpower-plans/${editingId}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    );
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg('MPP diperbarui. Perubahan langsung tampil di form Buat Lowongan.');
      setShowForm(false);
      await load();
      // Beri tahu panel lain (mis. Kelola Lowongan) agar memuat ulang daftar MPP.
      window.dispatchEvent(new Event('mpp:changed'));
    } else {
      setErr(j?.detail || j?.message || 'Gagal menyimpan MPP.');
    }
    setBusy(false);
  }

  async function remove(r: MppRow) {
    if (!window.confirm(`Hapus MPP ${r.department} · ${r.position} (${r.fiscalYear})?`)) return;
    setBusy(true); setMsg(null); setErr(null);
    const res = await fetch(`/api/v1/recruitment/manpower-plans/${r.id}`, { method: 'DELETE' });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { setMsg('MPP dihapus.'); await load(); window.dispatchEvent(new Event('mpp:changed')); }
    else setErr(j?.detail || j?.message || 'Gagal menghapus MPP.');
    setBusy(false);
  }

  return (
    <div className="stitch-card-white p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3">
        <div>
          <h2 className="text-base font-extrabold text-[#0f172a] inline-flex items-center gap-2">
            <Target className="h-4 w-4 text-[#007a5a]" /> Manajemen MPP (Kuota &amp; Budget)
          </h2>
          <p className="text-[11px] text-[#64748b]">Rencana formasi SDM per posisi &amp; tahun. Perubahan di sini langsung tersinkron ke dropdown MPP pada form Buat Lowongan.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1 rounded-lg bg-[#007a5a] px-3 py-2 text-xs font-bold text-white hover:bg-[#006347]"
        >
          <Plus className="h-3.5 w-3.5" /> Tambah MPP
        </button>
      </div>

      {msg && <p className="text-xs text-[#047857] bg-[#ecfdf5] px-3 py-2 rounded-lg">{msg}</p>}
      {err && <p className="text-xs text-[#b91c1c] bg-[#fef2f2] px-3 py-2 rounded-lg">{err}</p>}

      {loading ? (
        <p className="text-xs text-[#64748b]">Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[#64748b]">Belum ada MPP. Klik &quot;Tambah MPP&quot;.</p>
      ) : (
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            searchPlaceholder="Cari posisi atau departemen..."
            itemLabel="rencana"
            emptyMessage="Belum ada rencana tenaga kerja."
            columns={[
            {
              key: 'posisi',
              header: 'Departemen · Posisi',
              value: (r) => `${r.position} ${r.department}`,
              render: (r) => (
                <>
                  <div className="font-bold text-[#0f172a]">{r.position}</div>
                  <div className="text-[10px] text-[#64748b]">{r.department}</div>
                </>
              ),
            },
            { key: 'tahun', header: 'Tahun', value: (r) => r.fiscalYear, render: (r) => <span className="font-mono text-[#334155]">{r.fiscalYear}</span> },
            {
              key: 'kuota',
              header: 'Kuota',
              value: (r) => `${r.hiredCount}/${r.approvedQuota}`,
              render: (r) => (
                <>
                  <div className="font-bold text-[#0f172a]">{r.hiredCount}/{r.approvedQuota}</div>
                  <div className="text-[10px] text-[#64748b]">sisa {r.remainingQuota}</div>
                </>
              ),
            },
            {
              key: 'budget',
              header: 'Budget',
              value: (r) => r.allocatedBudget,
              render: (r) => (
                <>
                  <div className="font-bold text-[#0f172a]">{IDR.format(r.allocatedBudget)}</div>
                  <div className="text-[10px] text-[#64748b]">terpakai {r.budgetUtilizationPct}%</div>
                </>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              value: (r: any) => r.status ?? 'APPROVED',
              render: (r: any) => {
                const s = r.status ?? 'APPROVED';
                const gaya =
                  s === 'PENDING' ? 'bg-amber-100 text-[#92400e]'
                  : s === 'REJECTED' ? 'bg-rose-100 text-[#c5221f]'
                  : 'bg-emerald-100 text-[#137333]';
                const label =
                  s === 'PENDING' ? 'Menunggu BOD'
                  : s === 'REJECTED' ? 'Ditolak BOD'
                  : 'Disetujui';
                return (
                  <div className="space-y-0.5">
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${gaya}`}>{label}</span>
                    {s === 'REJECTED' && r.decisionNote && (
                      <p className="text-[10px] text-[#64748b] max-w-[16rem]">Alasan: {r.decisionNote}</p>
                    )}
                  </div>
                );
              },
            },
            {
              key: 'aksi',
              header: 'Aksi',
              className: 'text-right',
              value: () => '',
              render: (r) => (
                <div className="flex justify-end gap-1.5">
                  <button type="button" onClick={() => openEdit(r)} disabled={busy} aria-label={`Ubah ${r.position}`} className="p-1.5 rounded-lg hover:bg-[#f8fafc]">
                    <Pencil className="h-3.5 w-3.5 text-[#334155]" />
                  </button>
                  <button type="button" onClick={() => remove(r)} disabled={busy} aria-label={`Hapus ${r.position}`} className="p-1.5 rounded-lg hover:bg-[#f8fafc]">
                    <Trash2 className="h-3.5 w-3.5 text-[#b91c1c]" />
                  </button>
                </div>
              ),
            },
            ]}
          />
      )}

      {showForm && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
          <form onSubmit={submit} className="bg-white rounded-t-2xl sm:rounded-2xl border border-[#e2e8f0] shadow-2xl w-full sm:max-w-2xl lg:max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="shrink-0 bg-[#0f172a] text-white px-5 py-3.5 flex items-center justify-between">
              <span className="text-sm font-bold">{editingId ? 'Ubah MPP' : 'Tambah MPP'}</span>
              <button type="button" onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-white/10 text-lg leading-none" aria-label="Tutup">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">{/* scrollable body */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="text-[11px] text-[#334155]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Departemen *</span>
                    <OrgQuickAdd kind="department" disabled={busy}
                      onCreated={async (d) => { await load(); setForm((f) => ({ ...f, departmentId: d.id, positionId: '' })); }} />
                  </div>
                  <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value, positionId: '' })} required className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs">
                    <option value="">— Pilih —</option>
                    {(ref?.departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="text-[11px] text-[#334155]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Posisi *</span>
                    <OrgQuickAdd kind="position" departmentId={form.departmentId} disabled={busy}
                      onCreated={async (p) => { await load(); setForm((f) => ({ ...f, positionId: p.id })); }} />
                  </div>
                  <select value={form.positionId} onChange={(e) => setForm({ ...form, positionId: e.target.value })} required className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs">
                    <option value="">— Pilih —</option>
                    {positionsForDept.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-[11px] text-[#334155]"><span className="font-semibold">Tahun Fiskal *</span>
                  <input type="number" value={form.fiscalYear} onChange={(e) => setForm({ ...form, fiscalYear: e.target.value })} required className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" /></label>
                <label className="block text-[11px] text-[#334155]"><span className="font-semibold">Kuota Disetujui *</span>
                  <input type="number" min={0} value={form.approvedQuota} onChange={(e) => setForm({ ...form, approvedQuota: e.target.value })} required className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" /></label>
              </div>

              <label className="block text-[11px] text-[#334155]"><span className="font-semibold">Budget Dialokasikan (Rp) *</span>
                <input type="number" min={0} value={form.allocatedBudget} onChange={(e) => setForm({ ...form, allocatedBudget: e.target.value })} required className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" /></label>

              {/* Atasan langsung bertugas memantau pegawai di departemennya,
                  sehingga hanya People Manager terdaftar yang boleh dipilih. */}
              <label className="block text-[11px] text-[#334155]">
                <span className="font-semibold">Atasan Langsung (People Manager) *</span>
                <select
                  value={form.managerId}
                  onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                  required={!editingId}
                  aria-label="Atasan langsung (People Manager)"
                  className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs bg-white"
                >
                  <option value="">— Pilih People Manager —</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName}{m.departmentName ? ` — ${m.departmentName}` : ''}
                    </option>
                  ))}
                </select>
                <span className="block mt-1 text-[10px] text-[#64748b]">
                  Atasan langsung akan memantau pegawai pada formasi ini setelah mereka bergabung.
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-[11px] text-[#334155]"><span className="font-semibold">Budget Terpakai (Rp)</span>
                  <input type="number" min={0} value={form.utilizedBudget} placeholder="0" onChange={(e) => setForm({ ...form, utilizedBudget: e.target.value })} className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" /></label>
                <label className="block text-[11px] text-[#334155]"><span className="font-semibold">Jumlah Terisi (hired)</span>
                  <input type="number" min={0} value={form.hiredCount} placeholder="0" onChange={(e) => setForm({ ...form, hiredCount: e.target.value })} className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs" /></label>
              </div>

              {err && <p className="text-[11px] font-semibold text-[#b91c1c] bg-[#fef2f2] px-3 py-2 rounded-lg">{err}</p>}
            </div>
            <div className="shrink-0 border-t border-[#e2e8f0] px-5 py-3 flex justify-end gap-2 bg-[#f8fafc]">
              <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 text-xs text-[#64748b] hover:bg-[#f1f5f9] rounded-lg">Batal</button>
              <button type="submit" disabled={busy} className="px-4 py-2 text-xs font-bold text-white bg-[#007a5a] rounded-lg hover:bg-[#006347] disabled:opacity-50">
                {busy ? 'Menyimpan…' : (editingId ? 'Simpan Perubahan' : 'Tambah MPP')}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}
