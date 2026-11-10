'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, PackageCheck, Plus, Trash2, Undo2 } from 'lucide-react';

/**
 * Panel serah terima aset & persetujuan unit kerja (clearance).
 * Satu karyawan dipilih lebih dulu karena clearance selalu per orang.
 */
const ASSET_CATEGORIES = [
  { value: 'LAPTOP', label: 'Laptop / komputer' },
  { value: 'PHONE', label: 'Telepon seluler' },
  { value: 'ACCESS_CARD', label: 'Kartu akses' },
  { value: 'VEHICLE', label: 'Kendaraan' },
  { value: 'DOCUMENT', label: 'Dokumen' },
  { value: 'OTHER', label: 'Lainnya' },
];

export default function ClearanceAssetPanel() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  // Pencarian karyawan: dropdown berisi ratusan orang pada cakupan HR.
  const [cariKaryawan, setCariKaryawan] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    asset_name: '',
    asset_category: 'LAPTOP',
    asset_code: '',
    notes: '',
  });

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/v1/hr/employee-directory');
        if (res.ok) {
          const json = await res.json();
          const list = json?.data?.items ?? json?.data ?? [];
          setEmployees(Array.isArray(list) ? list : []);
        }
      } catch {
        // abaikan
      }
    })();
  }, []);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/post-employment/clearance?employeeId=${id}`);
      const json = await res.json();
      if (res.ok) setData(json?.data ?? null);
    } catch {
      // abaikan
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(employeeId);
  }, [employeeId, load]);

  const addAsset = async () => {
    setBusy('add');
    setNotice(null);
    try {
      const res = await fetch('/api/v1/post-employment/clearance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          asset_name: form.asset_name,
          asset_category: form.asset_category,
          asset_code: form.asset_code || null,
          notes: form.notes || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setNotice(json?.message ?? 'Aset ditambahkan.');
        setForm({ asset_name: '', asset_category: 'LAPTOP', asset_code: '', notes: '' });
        void load(employeeId);
      } else {
        setNotice(json?.detail || json?.error?.message || json?.message || 'Gagal menambah aset.');
      }
    } catch (err: any) {
      setNotice(err.message);
    } finally {
      setBusy(null);
    }
  };

  const toggleReturned = async (assetId: string, isReturned: boolean) => {
    setBusy(assetId);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/post-employment/clearance/asset/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_returned: isReturned }),
      });
      const json = await res.json();
      setNotice(res.ok ? json?.message ?? 'Status aset diperbarui.' : json?.detail || json?.message || 'Gagal memperbarui aset.');
      if (res.ok) void load(employeeId);
    } catch (err: any) {
      setNotice(err.message);
    } finally {
      setBusy(null);
    }
  };

  const removeAsset = async (assetId: string) => {
    setBusy(assetId);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/post-employment/clearance/asset/${assetId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      setNotice(res.ok ? json?.message ?? 'Aset dihapus.' : json?.detail || json?.message || 'Gagal menghapus aset.');
      if (res.ok) void load(employeeId);
    } catch (err: any) {
      setNotice(err.message);
    } finally {
      setBusy(null);
    }
  };

  const toggleSignoff = async (department: string, isCleared: boolean) => {
    setBusy(department);
    setNotice(null);
    try {
      const res = await fetch('/api/v1/post-employment/clearance/signoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          department,
          is_cleared: isCleared,
        }),
      });
      const json = await res.json();
      setNotice(res.ok ? json?.message ?? 'Persetujuan diperbarui.' : json?.detail || json?.message || 'Gagal memperbarui persetujuan.');
      if (res.ok) void load(employeeId);
    } catch (err: any) {
      setNotice(err.message);
    } finally {
      setBusy(null);
    }
  };

  const assets: any[] = data?.assets ?? [];
  const signoffs: any[] = data?.signoffs ?? [];
  const summary = data?.summary;
  const departments = ['HR', 'IT', 'FINANCE', 'MANAGER', 'LEGAL'];

  // Penyaringan pilihan karyawan (aset per-orang, jadi yang besar adalah dropdown).
  const anggotaTersaring = employees.filter((emp) => {
    const q = cariKaryawan.trim().toLowerCase();
    if (!q) return true;
    const nama = String(emp.fullName ?? emp.full_name ?? emp.name ?? '');
    return `${nama} ${emp.employeeCode ?? ''}`.toLowerCase().includes(q);
  });

  return (
    <div className="p-5 rounded-2xl border border-[#e2e8f0] bg-white space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-[#0f172a] flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-[#007a5a]" />
            <span>Serah Terima Aset &amp; Clearance</span>
          </h3>
          <p className="text-[11px] text-[#64748b]">
            Checklist pengembalian aset dan persetujuan bebas tanggungan per unit kerja.
          </p>
        </div>
        {summary && (
          <span className="text-[10px] font-bold text-[#007a5a] bg-[#e6f4f0] px-2 py-1 rounded-lg">
            {summary.completionPercentage}% selesai
          </span>
        )}
      </div>

      <label className="block text-[11px] font-semibold text-[#0f172a]">
        Pilih karyawan
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="mt-1 w-full text-[11px] px-2 py-1.5 border border-[#e2e8f0] rounded-lg"
        >
          <option value="">— Pilih karyawan —</option>
          {anggotaTersaring.map((emp) => (
            <option key={emp.employeeId ?? emp.id} value={emp.employeeId ?? emp.id}>
              {emp.fullName ?? emp.full_name ?? emp.name}
              {emp.employeeCode ? ` (${emp.employeeCode})` : ''}
            </option>
          ))}
        </select>
        {employees.length > 10 && (
          <input
            type="search"
            value={cariKaryawan}
            onChange={(e) => setCariKaryawan(e.target.value)}
            placeholder={`Cari dari ${employees.length} karyawan...`}
            aria-label="Cari karyawan"
            className="mt-1.5 w-full h-8 px-2.5 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none focus:ring-2 focus:ring-[#007a5a]/30"
          />
        )}
      </label>

      {notice && (
        <p className="text-[11px] text-[#0f172a] bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      {!employeeId ? (
        <p className="text-[11px] text-[#64748b] p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
          Pilih karyawan untuk menampilkan checklist serah terima.
        </p>
      ) : loading ? (
        <p className="text-[11px] text-[#64748b]">Memuat checklist...</p>
      ) : (
        <>
          <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 space-y-2">
            <p className="text-[11px] font-bold text-[#0f172a]">Tambah aset</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={form.asset_name}
                onChange={(e) => setForm({ ...form, asset_name: e.target.value })}
                placeholder="Nama aset, mis. Laptop ThinkPad"
                className="text-[11px] px-2 py-1.5 border border-[#e2e8f0] rounded-lg"
              />
              <select
                value={form.asset_category}
                onChange={(e) => setForm({ ...form, asset_category: e.target.value })}
                className="text-[11px] px-2 py-1.5 border border-[#e2e8f0] rounded-lg"
              >
                {ASSET_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={form.asset_code}
                onChange={(e) => setForm({ ...form, asset_code: e.target.value })}
                placeholder="Nomor inventaris (opsional)"
                className="text-[11px] px-2 py-1.5 border border-[#e2e8f0] rounded-lg"
              />
              <button
                type="button"
                onClick={addAsset}
                disabled={busy === 'add' || !form.asset_name.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#007a5a] hover:bg-[#00674c] text-white text-[11px] font-bold disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> {busy === 'add' ? 'Menyimpan...' : 'Tambah aset'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-bold text-[#0f172a]">Daftar aset ({assets.length})</p>
            {assets.length === 0 ? (
              <p className="text-[11px] text-[#64748b] p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
                Belum ada aset tercatat untuk karyawan ini.
              </p>
            ) : (
              assets.map((a) => (
                <div
                  key={a.id}
                  className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="text-[11px]">
                    <p className="font-bold text-[#0f172a]">
                      {a.assetName}
                      {a.assetCode ? ` · ${a.assetCode}` : ''}
                    </p>
                    <p className="text-[#64748b]">
                      {a.categoryLabel}
                      {a.isReturned ? ' · sudah dikembalikan' : ' · belum dikembalikan'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleReturned(a.id, !a.isReturned)}
                      disabled={busy === a.id}
                      className="px-2.5 py-1 rounded-lg bg-white border border-[#e2e8f0] hover:bg-[#f1f5f9] text-[10px] font-bold text-[#007a5a] flex items-center gap-1 disabled:opacity-50"
                    >
                      {a.isReturned ? (
                        <>
                          <Undo2 className="h-3 w-3" /> Batalkan
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> Kembali
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAsset(a.id)}
                      disabled={busy === a.id}
                      className="px-2.5 py-1 rounded-lg bg-white border border-[#e2e8f0] hover:bg-[#fef2f2] text-[10px] font-bold text-[#b91c1c] flex items-center gap-1 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" /> Hapus
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-bold text-[#0f172a]">Persetujuan unit kerja</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {departments.map((dept) => {
                const row = signoffs.find((s) => s.department === dept);
                const cleared = !!row?.isCleared;
                return (
                  <div
                    key={dept}
                    className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between gap-2"
                  >
                    <div className="text-[11px]">
                      <p className="font-bold text-[#0f172a]">{row?.departmentLabel ?? dept}</p>
                      <p className="text-[#64748b]">{cleared ? 'Bebas tanggungan' : 'Belum disetujui'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSignoff(dept, !cleared)}
                      disabled={busy === dept}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border disabled:opacity-50 ${
                        cleared
                          ? 'bg-white border-[#e2e8f0] text-[#64748b] hover:bg-[#f1f5f9]'
                          : 'bg-[#007a5a] border-[#007a5a] text-white hover:bg-[#00674c]'
                      }`}
                    >
                      {cleared ? 'Batalkan' : 'Setujui'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
